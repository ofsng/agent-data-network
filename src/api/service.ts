// Application service shared by the HTTP API, the typed agent tools and the guided
// demo. It never signs transactions and never returns paid bytes outside a verified
// wallet-bound delivery.
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { randomBytes } from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Config } from "../config";
import { BOUNTY_STATUS, ata, pda, split, toHex } from "../chain/adn";
import { ChainUnavailable, readOnlyProgram, verifyReceipt } from "../chain/verify";
import { AssetRow, Db, search, sha256hex } from "../data/store";
import { restoreFromSnapshot, snapshotDir, trustView } from "../data/trust";

export const QUOTE_TTL_SECS = 120;
export const CHALLENGE_TTL_SECS = 60;

export class ServiceError extends Error {
  constructor(public status: number, public code: string, msg: string, public retryable = false) {
    super(msg);
  }
}

const now = () => Math.floor(Date.now() / 1000);

export function pubkey(v: unknown, field: string): PublicKey {
  if (typeof v !== "string" || v.length > 44) throw new ServiceError(400, "INVALID", `${field} must be base58 pubkey`);
  try {
    return new PublicKey(v);
  } catch {
    throw new ServiceError(400, "INVALID", `${field} must be base58 pubkey`);
  }
}

export function challengeMessage(cfg: Config, buyer: string, receipt: string, nonceHex: string, expiry: number) {
  return Buffer.from(
    ["ADN-DELIVER-v1", cfg.deliveryDomain, cfg.cluster, cfg.programId.toBase58(), buyer, receipt, nonceHex, String(expiry)].join("\n"),
    "utf8",
  );
}

export interface QuoteItem {
  assetPda: string;
  provider: string;
  version: number;
  title: string;
  price: string;
  providerAmount: string;
  platformAmount: string;
  contentHash: string;
  licenseHash: string;
  trust: ReturnType<typeof trustView>;
}
export interface Quote {
  orderId: string;
  buyer: string;
  items: QuoteItem[];
  total: string;
  feeBps: number;
  mint: string;
  expiresAt: number;
  estimatedSolLamports: string;
}

export function createService(cfg: Config, db: Db) {
  if (!cfg.mint || !cfg.treasury) throw new Error("deployment not bootstrapped (no mint/treasury)");
  const connection = new Connection(cfg.rpcUrl, "finalized");
  const program = readOnlyProgram(connection);
  const mint = cfg.mint;
  const snapDir = snapshotDir(cfg.cluster);

  async function chain<T>(f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (e) {
      if (e instanceof ServiceError) throw e;
      throw new ServiceError(503, "CHAIN_UNAVAILABLE", "chain unavailable", true);
    }
  }

  function searchAssets(q: string, requiredTag?: string, limit = 10) {
    if (q.length > 256 || (requiredTag && requiredTag.length > 64)) throw new ServiceError(400, "INVALID", "query too long");
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new ServiceError(400, "INVALID", "limit 1-20");
    const res = search(db, q, requiredTag, limit);
    return { items: res.items.map((i) => ({ ...i, mint: mint.toBase58(), trust: trustView(db, snapDir, i.assetPda) })), gap: res.gap };
  }

  /**
   * Exact quote. Initial bundle: exactly two assets from distinct providers. Resale
   * (`single`): exactly one asset for a separate buyer. Every unit passes preflight:
   * finalized active chain terms, VALID trust, stored bytes == chain hashes and a
   * verified recoverable snapshot. Fails closed (422/503); no quote = no signing.
   */
  async function quote(buyerIn: unknown, assetPdasIn: unknown, maxSpendIn: unknown, kind: "bundle" | "single" = "bundle"): Promise<Quote> {
    const buyer = pubkey(buyerIn, "buyer");
    const n = kind === "bundle" ? 2 : 1;
    if (!Array.isArray(assetPdasIn) || assetPdasIn.length !== n) throw new ServiceError(400, "INVALID", `exactly ${n} assetPdas`);
    const pdas = assetPdasIn.map((a, i) => pubkey(a, `assetPdas[${i}]`));
    if (n === 2 && pdas[0].equals(pdas[1])) throw new ServiceError(400, "INVALID", "duplicate asset");
    if (typeof maxSpendIn !== "string" || !/^\d{1,20}$/.test(maxSpendIn)) throw new ServiceError(400, "INVALID", "maxSpend u64 string");
    const maxSpend = BigInt(maxSpendIn);
    const assets = await chain(() => Promise.all(pdas.map((p) => program.account.dataAsset.fetchNullable(p, "finalized"))));
    const items: QuoteItem[] = assets.map((a, i) => {
      const key = pdas[i].toBase58();
      if (!a) throw new ServiceError(404, "NOT_FOUND", `asset ${key} not finalized`);
      if (!a.active) throw new ServiceError(409, "STALE", "asset inactive");
      if (a.provider.equals(buyer)) throw new ServiceError(400, "INVALID", "buyer is provider");
      const row = db.prepare("SELECT * FROM assets WHERE asset_pda=?").get(key) as AssetRow | undefined;
      if (!row) throw new ServiceError(503, "UNAVAILABLE", "asset bytes not available");
      const trust = trustView(db, snapDir, key);
      if (!trust || trust.validationStatus !== "VALID") throw new ServiceError(422, "TRUST_INVALID", "missing or invalid trust declaration");
      const chainHash = toHex(a.contentHash), chainLic = toHex(a.licenseHash);
      if (row.content_hash !== chainHash || row.license_hash !== chainLic || sha256hex(row.body) !== chainHash || sha256hex(row.license) !== chainLic)
        throw new ServiceError(422, "HASH_MISMATCH", "stored bytes do not match on-chain hashes; not quotable");
      if (trust.snapshot !== "VERIFIED") throw new ServiceError(503, "SNAPSHOT_UNAVAILABLE", `recoverable snapshot ${trust.snapshot.toLowerCase()}`, true);
      const s = split(BigInt(a.price.toString()));
      return {
        assetPda: key, provider: a.provider.toBase58(), version: a.version, title: row.title, price: a.price.toString(),
        providerAmount: s.provider.toString(), platformAmount: s.platform.toString(), contentHash: chainHash, licenseHash: chainLic, trust,
      };
    });
    if (n === 2 && items[0].provider === items[1].provider) throw new ServiceError(400, "INVALID", "two distinct providers required");
    const total = items.reduce((s, i) => s + BigInt(i.price), 0n);
    if (total > maxSpend) throw new ServiceError(400, "OVER_BUDGET", `total ${total} exceeds maxSpend ${maxSpend}`);
    const rent = await chain(() => connection.getMinimumBalanceForRentExemption(254));
    const orderId = randomBytes(16).toString("hex");
    const expiresAt = now() + QUOTE_TTL_SECS;
    db.prepare("INSERT INTO quotes(order_id,buyer,items_json,total,expires_at,state) VALUES(?,?,?,?,?,'QUOTED')").run(
      orderId, buyer.toBase58(), JSON.stringify(items), total.toString(), expiresAt,
    );
    return { orderId, buyer: buyer.toBase58(), items, total: total.toString(), feeBps: 2000, mint: mint.toBase58(), expiresAt, estimatedSolLamports: String(n * rent + 5000) };
  }

  async function receipt(pdaIn: unknown) {
    const res = await chain(() => verifyReceipt(connection, pubkey(pdaIn, "pda"), { mint }));
    if (res.status === "pending") return { pending: true as const };
    if (res.status === "missing") throw new ServiceError(404, "NOT_FOUND", "receipt not found");
    if (res.status === "invalid") throw new ServiceError(422, "INVALID_RECEIPT", res.reason);
    return res.receipt;
  }

  function issueChallenge(buyerIn: unknown, receiptIn: unknown) {
    const buyer = pubkey(buyerIn, "buyer");
    const receipt = pubkey(receiptIn, "receiptPda");
    const nonce = randomBytes(32).toString("hex");
    const expiresAt = now() + CHALLENGE_TTL_SECS;
    const message = challengeMessage(cfg, buyer.toBase58(), receipt.toBase58(), nonce, expiresAt);
    db.prepare("INSERT INTO challenges(nonce_hash,buyer,receipt_pda,message,expires_at) VALUES(?,?,?,?,?)").run(
      sha256hex(nonce), buyer.toBase58(), receipt.toBase58(), message, expiresAt,
    );
    return { nonce, message: message.toString("utf8"), expiresAt };
  }

  /** Wallet-bound delivery of exact bytes; repairs corrupted bytes from snapshot (fresh nonce, no new charge). */
  async function deliver(buyerIn: unknown, receiptIn: unknown, nonce: unknown, signature: unknown) {
    const buyer = pubkey(buyerIn, "buyer");
    const receiptPk = pubkey(receiptIn, "receiptPda");
    if (typeof nonce !== "string" || !/^[0-9a-f]{64}$/.test(nonce)) throw new ServiceError(400, "INVALID", "nonce");
    if (typeof signature !== "string" || signature.length > 100) throw new ServiceError(400, "INVALID", "signature");
    const ch = db.prepare("SELECT * FROM challenges WHERE nonce_hash=?").get(sha256hex(nonce)) as
      | { buyer: string; receipt_pda: string; message: Buffer; expires_at: number; consumed_at: number | null }
      | undefined;
    if (!ch || ch.buyer !== buyer.toBase58() || ch.receipt_pda !== receiptPk.toBase58()) throw new ServiceError(401, "BAD_PROOF", "unknown challenge");
    if (ch.consumed_at !== null || ch.expires_at <= now()) throw new ServiceError(409, "NONCE_USED", "challenge used or expired");
    let sig: Uint8Array;
    try {
      sig = bs58.decode(signature);
    } catch {
      throw new ServiceError(401, "BAD_PROOF", "signature encoding");
    }
    if (sig.length !== 64 || !nacl.sign.detached.verify(ch.message, sig, buyer.toBytes())) throw new ServiceError(401, "BAD_PROOF", "invalid wallet signature");

    const res = await chain(() => verifyReceipt(connection, receiptPk, { mint }));
    if (res.status === "pending") return { pending: true as const };
    if (res.status === "missing") throw new ServiceError(404, "NOT_FOUND", "receipt not found");
    if (res.status === "invalid") throw new ServiceError(422, "INVALID_RECEIPT", res.reason);
    const r = res.receipt;
    if (r.buyer !== buyer.toBase58()) throw new ServiceError(403, "WRONG_BUYER", "receipt belongs to another wallet");

    const asset = db.prepare("SELECT * FROM assets WHERE asset_pda=?").get(r.asset) as AssetRow | undefined;
    if (!asset) throw new ServiceError(503, "UNAVAILABLE", "bytes temporarily unavailable", true);
    const ok = sha256hex(asset.body) === r.contentHash && asset.content_hash === r.contentHash &&
      sha256hex(asset.license) === r.licenseHash && asset.license_hash === r.licenseHash;

    const consumed = db.transaction(() => {
      const u = db.prepare("UPDATE challenges SET consumed_at=? WHERE nonce_hash=? AND consumed_at IS NULL AND expires_at > ?").run(now(), sha256hex(nonce), now());
      if (u.changes !== 1) return false;
      db.prepare(
        `INSERT INTO receipts(pda,buyer,asset_pda,order_id,kind,finalized_slot,amount,provider_amount,platform_amount,content_hash,license_hash,mint,version,verified_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pda) DO UPDATE SET verified_at=excluded.verified_at`,
      ).run(r.pda, r.buyer, r.asset, r.orderId, r.kind, r.finalizedSlot, r.amount, r.providerAmount, r.platformAmount, r.contentHash, r.licenseHash, r.mint, r.version, now());
      db.prepare("INSERT INTO delivery_log(receipt_pda,delivered_at,result) VALUES(?,?,?)").run(r.pda, now(), ok ? "VERIFIED" : "HASH_MISMATCH");
      return true;
    })();
    if (!consumed) throw new ServiceError(409, "NONCE_USED", "challenge used or expired");
    if (!ok) {
      // Fail closed. Repair only this asset's bytes from the verified snapshot.
      if (restoreFromSnapshot(db, snapDir, r.asset, r.contentHash, r.licenseHash))
        throw new ServiceError(503, "RESTORED_RETRY", "stored bytes were corrupted and have been restored from a verified snapshot; retry with a fresh challenge (no new payment)", true);
      throw new ServiceError(422, "HASH_MISMATCH", "stored bytes do not match receipt and no verified snapshot exists; delivery unresolved");
    }
    return {
      assetPda: r.asset, version: r.version, bodyBase64: asset.body.toString("base64"), licenseBase64: asset.license.toString("base64"),
      contentHash: r.contentHash, licenseHash: r.licenseHash, receiptPda: r.pda,
    };
  }

  async function bountyView(pk: PublicKey, b: any) {
    let vaultBalance = "0";
    try {
      vaultBalance = (await getAccount(connection, ata(pk, mint), "confirmed")).amount.toString();
    } catch {}
    let bountyReceipt: string | null = null;
    if (!b.winnerSubmission.equals(PublicKey.default)) {
      const s = await program.account.submission.fetchNullable(b.winnerSubmission, "confirmed");
      bountyReceipt = s ? pda.bountyReceipt(pk, s.asset, program.programId).toBase58() : null;
    }
    const meta = db.prepare("SELECT requirement_json FROM bounties WHERE pda=?").get(pk.toBase58()) as { requirement_json: string } | undefined;
    return {
      bountyPda: pk.toBase58(), requester: b.requester.toBase58(), bountyId: toHex(b.bountyId), requirementHash: toHex(b.requirementHash),
      requirement: meta ? JSON.parse(meta.requirement_json) : null, requirementVersion: meta ? "v2" : "LEGACY",
      reward: b.reward.toString(), deadline: Number(b.deadline.toString()), status: BOUNTY_STATUS[b.status],
      winnerSubmission: b.winnerSubmission.equals(PublicKey.default) ? null : b.winnerSubmission.toBase58(),
      vault: ata(pk, mint).toBase58(), vaultBalance, bountyReceipt,
    };
  }

  async function listBounties(status?: string | null) {
    const all = await chain(() => program.account.bounty.all());
    return Promise.all(all.filter((b) => !status || BOUNTY_STATUS[b.account.status] === status).map((b) => bountyView(b.publicKey, b.account)));
  }

  async function getBounty(pdaIn: unknown) {
    const pk = pubkey(pdaIn, "pda");
    const b = await chain(() => program.account.bounty.fetchNullable(pk, "confirmed"));
    if (!b) throw new ServiceError(404, "NOT_FOUND", "bounty not found");
    const subs = await chain(() => program.account.submission.all([{ memcmp: { offset: 8, bytes: pk.toBase58() } }]));
    return { ...(await bountyView(pk, b)), submissions: subs.map((s) => ({ submissionPda: s.publicKey.toBase58(), provider: s.account.provider.toBase58(), asset: s.account.asset.toBase58() })) };
  }

  async function health() {
    let rpcOk = false;
    try {
      await connection.getSlot("finalized");
      rpcOk = true;
    } catch {}
    return {
      cluster: cfg.cluster, mode: cfg.cluster === "devnet" ? "DEVNET" : "LOCAL_VALIDATOR", programId: cfg.programId.toBase58(), mint: mint.toBase58(),
      mintLabel: cfg.deployment?.mintLabel ?? "TEST", treasury: cfg.treasury!.toBase58(), rpcOk, dbOk: !!db.prepare("SELECT 1 AS ok").get(),
    };
  }

  return { cfg, db, connection, program, mint, treasury: cfg.treasury, snapDir, searchAssets, quote, receipt, issueChallenge, deliver, listBounties, getBounty, health };
}

export type Service = ReturnType<typeof createService>;
export { ChainUnavailable };
