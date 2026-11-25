// Typed agent tool surface (AGENT-INTEGRATION-SPEC). The deterministic driver and
// any optional external client use exactly these tools. There is no generic signing
// tool: purchase_data only signs a purchase_unit bundle built from a stored quote,
// and create_bounty only an allowlisted requirement, both under a durable budget.
import { BN } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { randomBytes } from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, ata, buildBundleTx, fromHex, pda, programFor, toHex } from "../chain/adn";
import { waitFinalized } from "../chain/ops";
import { canonicalJson, sha256, sha256hex } from "../data/store";
import { Quote, Service, ServiceError } from "../api/service";
import { BudgetError, RunBudget } from "./budget";

export interface TraceEntry {
  at: string;
  actor: string;
  tool: string;
  input: Record<string, unknown>;
  output: string;
  status: "ok" | "error";
  ms: number;
}

export const ALLOWED_REQUIREMENTS = ["X100_RECYCLING_V2"] as const;

export class AgentTools {
  constructor(
    private svc: Service,
    private wallet: Keypair,
    private budget: RunBudget,
    private trace: TraceEntry[],
    public actor: string,
    private publicRequirement: Record<string, string>,
  ) {}

  private async call<T>(tool: string, input: Record<string, unknown>, f: () => Promise<T>, summarize: (r: T) => string): Promise<T> {
    const t0 = Date.now();
    try {
      const r = await f();
      this.trace.push({ at: new Date().toISOString(), actor: this.actor, tool, input, output: summarize(r), status: "ok", ms: Date.now() - t0 });
      return r;
    } catch (e) {
      const msg = e instanceof ServiceError ? `${e.code}: ${e.message}` : (e as Error).message;
      this.trace.push({ at: new Date().toISOString(), actor: this.actor, tool, input, output: msg.slice(0, 240), status: "error", ms: Date.now() - t0 });
      throw e;
    }
  }

  search_data(query: string, requiredTag?: string) {
    return this.call("search_data", { query, requiredTag }, async () => this.svc.searchAssets(query, requiredTag, 10),
      (r) => `${r.items.length} metadata results${r.gap ? ", GAP: no active unit has tag '" + requiredTag + "'" : ""}${r.items[0] ? `; top: ${r.items[0].title}` : ""}`);
  }

  get_data_quote(assetPdas: string[], maxSpend: bigint, kind: "bundle" | "single") {
    return this.call("get_data_quote", { assetPdas, maxSpend: maxSpend.toString(), kind },
      () => this.svc.quote(this.wallet.publicKey.toBase58(), assetPdas, maxSpend.toString(), kind),
      (q) => `order ${q.orderId.slice(0, 8)}…: ${q.items.length} unit(s), total ${q.total} base units, preflight passed (trust VALID, bytes == chain hashes, snapshot VERIFIED)`);
  }

  /** Reserve → simulate → sign → persist signature → send. Settlement is settle_purchase. */
  purchase_data(q: Quote) {
    return this.call("purchase_data", { orderId: q.orderId, units: q.items.length }, async () => {
      if (q.buyer !== this.wallet.publicKey.toBase58()) throw new BudgetError("quote is for another buyer");
      const row = this.svc.db.prepare("SELECT state, expires_at, total FROM quotes WHERE order_id=?").get(q.orderId) as { state: string; expires_at: number; total: string } | undefined;
      if (!row || row.state !== "QUOTED" || row.total !== q.total) throw new BudgetError("quote unknown, altered or already used");
      if (row.expires_at <= Math.floor(Date.now() / 1000)) throw new BudgetError("quote expired");
      this.budget.reserve(q.orderId, "PURCHASE", BigInt(q.total), BigInt(q.estimatedSolLamports));
      const conn = this.svc.connection;
      const program = programFor(conn, this.wallet);
      const items = q.items.map((i) => ({ assetPda: new PublicKey(i.assetPda), provider: new PublicKey(i.provider), price: BigInt(i.price), contentHash: fromHex(i.contentHash), licenseHash: fromHex(i.licenseHash) }));
      const tx = await buildBundleTx(program, this.wallet.publicKey, this.svc.mint, this.svc.treasury!, fromHex(q.orderId), items, q.expiresAt);
      tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
      tx.sign(this.wallet);
      const raw = tx.serialize();
      const sim = await conn.simulateTransaction(tx);
      if (sim.value.err) {
        this.budget.mark(q.orderId, "NOT_LANDED");
        this.svc.db.prepare("UPDATE quotes SET state='FAILED' WHERE order_id=?").run(q.orderId);
        throw new Error(`simulation rejected: ${JSON.stringify(sim.value.err)}`);
      }
      const signature = bs58.encode(tx.signature!);
      this.budget.mark(q.orderId, "PENDING", { signature });
      this.svc.db.prepare("UPDATE quotes SET state='PENDING', tx_signature=? WHERE order_id=?").run(signature, q.orderId);
      const solBefore = await conn.getBalance(this.wallet.publicKey, "confirmed");
      await conn.sendRawTransaction(raw, { skipPreflight: true });
      return {
        signature, solBefore, sizeBytes: raw.length, instructions: tx.instructions.length, simulatedCU: sim.value.unitsConsumed ?? null,
        receipts: items.map((i) => pda.receipt(this.wallet.publicKey, fromHex(q.orderId), i.assetPda).toBase58()),
      };
    }, (r) => `signed + sent 1 tx with ${r.instructions} purchase_unit ix (${r.sizeBytes} B, simulated ${r.simulatedCU} CU); budget reservation PENDING`);
  }

  settle_purchase(orderId: string, signature: string, solBefore?: number) {
    return this.call("settle_purchase", { orderId, signature: signature.slice(0, 12) + "…" }, async () => {
      const conn = this.svc.connection;
      let slot: number;
      try {
        slot = await waitFinalized(conn, signature);
      } catch (e) {
        this.budget.mark(orderId, /failed/.test(String(e)) ? "NOT_LANDED" : "UNKNOWN");
        throw e;
      }
      const info = await conn.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
      const before = solBefore;
      const solDelta = before === undefined ? null : BigInt(before - (await conn.getBalance(this.wallet.publicKey, "finalized")));
      this.budget.mark(orderId, "FINALIZED", solDelta === null ? {} : { solActual: solDelta });
      this.svc.db.prepare("UPDATE quotes SET state='FINALIZED' WHERE order_id=?").run(orderId);
      return { slot, landedCU: info?.meta?.computeUnitsConsumed ?? null, feeLamports: info?.meta?.fee ?? null, solSpentLamports: solDelta?.toString() ?? null };
    }, (r) => `finalized at slot ${r.slot}; ${r.landedCU} CU, fee ${r.feeLamports} lamports; SOL spent incl. receipt rent ${r.solSpentLamports} lamports`);
  }

  verify_receipt(receiptPda: string) {
    return this.call("verify_receipt", { receiptPda }, async () => {
      for (let i = 0; i < 30; i++) {
        const r = await this.svc.receipt(receiptPda);
        if (!("pending" in r)) {
          if (r.buyer !== this.wallet.publicKey.toBase58()) throw new ServiceError(403, "WRONG_BUYER", "receipt belongs to another wallet");
          return r;
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
      throw new ServiceError(202, "PENDING", "receipt not finalized");
    }, (r) => `owner=program, PDA recomputed, buyer/mint/version/hashes/amount match; ${r.amount} = ${r.providerAmount} + ${r.platformAmount}`);
  }

  /** Wallet challenge signed locally (key never leaves this process); exact bytes, hash re-checked. */
  retrieve_data(receiptPda: string) {
    return this.call("retrieve_data", { receiptPda }, async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const ch = this.svc.issueChallenge(this.wallet.publicKey.toBase58(), receiptPda);
        const signature = bs58.encode(nacl.sign.detached(Buffer.from(ch.message, "utf8"), this.wallet.secretKey));
        try {
          const r = await this.svc.deliver(this.wallet.publicKey.toBase58(), receiptPda, ch.nonce, signature);
          if ("pending" in r) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
          const body = Buffer.from(r.bodyBase64, "base64");
          const license = Buffer.from(r.licenseBase64, "base64");
          if (sha256hex(body) !== r.contentHash || sha256hex(license) !== r.licenseHash) throw new Error("client-side hash mismatch");
          return { body: body.toString("utf8"), bytes: body.length, contentHash: r.contentHash, licenseHash: r.licenseHash, assetPda: r.assetPda, restoredRetries: attempt };
        } catch (e) {
          if (e instanceof ServiceError && e.code === "RESTORED_RETRY") continue;
          throw e;
        }
      }
      throw new ServiceError(503, "UNAVAILABLE", "delivery not completed");
    }, (r) => `${r.bytes} bytes delivered, sha256 ${r.contentHash.slice(0, 12)}… == receipt${r.restoredRetries ? ` (after ${r.restoredRetries} snapshot restore retry, no new payment)` : ""}`);
  }

  create_bounty(requirementKey: (typeof ALLOWED_REQUIREMENTS)[number], reward: bigint, deadlineSecs: number) {
    return this.call("create_bounty", { requirementKey, reward: reward.toString(), deadlineSecs }, async () => {
      if (!ALLOWED_REQUIREMENTS.includes(requirementKey)) throw new BudgetError("requirement not allowlisted");
      if (deadlineSecs < 10 || deadlineSecs > 7 * 24 * 3600) throw new BudgetError("deadline outside policy");
      const conn = this.svc.connection;
      const bountyId = Uint8Array.from(randomBytes(16));
      const bounty = pda.bounty(this.wallet.publicKey, bountyId);
      const rent = await conn.getMinimumBalanceForRentExemption(8 + 32 + 16 + 32 + 8 + 8 + 1 + 32 + 1);
      this.budget.reserve(`bounty:${toHex(bountyId)}`, "BOUNTY", reward, BigInt(rent + 2_100_000 + 10_000));
      const requirementJson = canonicalJson(this.publicRequirement);
      const requirementHash = sha256(requirementJson);
      const slotTime = (await conn.getBlockTime(await conn.getSlot("confirmed"))) ?? Math.floor(Date.now() / 1000);
      const deadline = slotTime + deadlineSecs;
      const solBefore = await conn.getBalance(this.wallet.publicKey, "confirmed");
      let signature: string;
      try {
        signature = await programFor(conn, this.wallet)
          .methods.createBounty(Array.from(bountyId), Array.from(requirementHash), new BN(reward.toString()), new BN(deadline))
          .accountsStrict({
            requester: this.wallet.publicKey, config: pda.config(), bounty, mint: this.svc.mint, requesterToken: ata(this.wallet.publicKey, this.svc.mint),
            vault: ata(bounty, this.svc.mint), tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });
      } catch (e) {
        this.budget.mark(`bounty:${toHex(bountyId)}`, "NOT_LANDED");
        throw e;
      }
      this.budget.mark(`bounty:${toHex(bountyId)}`, "PENDING", { signature });
      const slot = await waitFinalized(conn, signature);
      this.budget.mark(`bounty:${toHex(bountyId)}`, "FINALIZED", { solActual: BigInt(solBefore - (await conn.getBalance(this.wallet.publicKey, "finalized"))) });
      this.svc.db
        .prepare("INSERT INTO bounties(pda,requester,bounty_id,requirement_json,requirement_hash,reward,deadline,vault,state,finalized_slot) VALUES(?,?,?,?,?,?,?,?,'OPEN',?)")
        .run(bounty.toBase58(), this.wallet.publicKey.toBase58(), toHex(bountyId), requirementJson, requirementHash.toString("hex"), reward.toString(), deadline, ata(bounty, this.svc.mint).toBase58(), slot);
      return { bountyPda: bounty.toBase58(), bountyId: toHex(bountyId), requirementHash: requirementHash.toString("hex"), deadline, signature, slot, vault: ata(bounty, this.svc.mint).toBase58() };
    }, (r) => `bounty ${r.bountyPda.slice(0, 8)}… funded, reward locked in PDA vault, finalized slot ${r.slot}`);
  }

  get_bounty_status(bountyPda: string) {
    return this.call("get_bounty_status", { bountyPda }, () => this.svc.getBounty(bountyPda),
      (b) => `${b.status}; vault ${b.vaultBalance}; ${b.submissions.length} submission(s)`);
  }
}
