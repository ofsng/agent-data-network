// Deterministic research agent: search -> quote -> budget -> simulate/sign the exact
// two-instruction bundle -> finalized receipts -> wallet-proof delivery -> report.
// Gap path: fund bounty -> provider submits -> local fixture review -> requester
// accepts -> deliver via bounty receipt -> provider activates. No LLM, no free facts.
import { BN } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Config, ROOT, explorer } from "../config";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ata,
  buildBundleTx,
  fromHex,
  pda,
  programFor,
  split,
  toHex,
} from "../chain/adn";
import { Wallets, publishAsset, setActive, waitFinalized } from "../chain/ops";
import { Db, canonicalJson, sha256, sha256hex } from "../data/store";

export const RUN_TOKEN_CAP = 2_100_000n; // TEST base units per agent run (purchases + escrow commitments)
export const RUN_SOL_CAP_LAMPORTS = 50_000_000n; // fees + receipt/escrow rent deposits

export class Budget {
  tokens = 0n;
  lamports = 0n;
  constructor(public tokenCap = RUN_TOKEN_CAP, public solCap = RUN_SOL_CAP_LAMPORTS) {}
  reserve(tokens: bigint, lamports: bigint, what: string) {
    if (this.tokens + tokens > this.tokenCap)
      throw new Error(`BUDGET: ${what} needs ${tokens} TEST units; ${this.tokenCap - this.tokens} remaining of ${this.tokenCap}`);
    if (this.lamports + lamports > this.solCap)
      throw new Error(`BUDGET: ${what} needs ${lamports} lamports; ${this.solCap - this.lamports} remaining`);
    this.tokens += tokens;
    this.lamports += lamports;
  }
}

export class Api {
  constructor(private base: string) {}
  async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
    const r = await fetch(`${this.base}/api/v1${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: await r.json() };
  }
  async ok(method: string, path: string, body?: unknown) {
    const r = await this.call(method, path, body);
    if (r.status !== 200) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r.json)}`);
    return r.json;
  }
}

/** Challenge -> local wallet signature -> delivery; verifies hashes client-side too. */
export async function deliver(api: Api, signer: Keypair, receiptPda: string) {
  const ch = await api.ok("POST", "/challenges", { buyer: signer.publicKey.toBase58(), receiptPda });
  const signature = bs58.encode(nacl.sign.detached(Buffer.from(ch.message, "utf8"), signer.secretKey));
  for (let i = 0; i < 60; i++) {
    const r = await api.call("POST", "/deliveries", { buyer: signer.publicKey.toBase58(), receiptPda, nonce: ch.nonce, signature });
    if (r.status === 202) {
      await new Promise((res) => setTimeout(res, 1000));
      continue;
    }
    if (r.status !== 200) throw new Error(`delivery ${r.status} ${JSON.stringify(r.json)}`);
    const body = Buffer.from(r.json.bodyBase64, "base64");
    const license = Buffer.from(r.json.licenseBase64, "base64");
    if (sha256hex(body) !== r.json.contentHash || sha256hex(license) !== r.json.licenseHash)
      throw new Error("client-side hash mismatch");
    return { body: body.toString("utf8"), contentHash: r.json.contentHash, licenseHash: r.json.licenseHash };
  }
  throw new Error("receipt still pending finality");
}

async function bal(connection: Connection, owner: PublicKey, mint: PublicKey) {
  try {
    return (await getAccount(connection, ata(owner, mint), "finalized")).amount;
  } catch {
    return 0n;
  }
}

function writeEvidence(cfg: Config, name: string, data: unknown) {
  mkdirSync(join(ROOT, "evidence"), { recursive: true });
  const file = join(ROOT, "evidence", `${cfg.cluster}-${name}.json`);
  writeFileSync(file, JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");
  return file;
}

const roles = (w: Wallets) => ({ buyer: w.buyer.publicKey, providerA: w.providerA.publicKey, providerB: w.providerB.publicKey, treasury: w.treasury.publicKey, requester: w.requester.publicKey });

async function snapshot(connection: Connection, w: Wallets, mint: PublicKey, extra: Record<string, PublicKey> = {}) {
  const all = { ...roles(w), ...extra };
  const out: Record<string, bigint> = {};
  for (const [k, v] of Object.entries(all)) out[k] = await bal(connection, v, mint);
  return out;
}
const delta = (a: Record<string, bigint>, b: Record<string, bigint>) =>
  Object.fromEntries(Object.keys(b).map((k) => [k, (b[k] - (a[k] ?? 0n)).toString()]));

export async function runPurchase(cfg: Config, connection: Connection, db: Db, w: Wallets, budget: Budget, log = console.log) {
  const api = new Api(cfg.apiUrl);
  const mint = cfg.mint!;
  const treasury = cfg.treasury!;
  log("Agent task: find X100 efficiency (technical) and lead time (availability) from two providers.");
  const q1 = await api.ok("GET", `/assets?q=${encodeURIComponent("inverter x100 efficiency")}&limit=5`);
  const q2 = await api.ok("GET", `/assets?q=${encodeURIComponent("inverter x100 lead time")}&limit=5`);
  const first = q1.items[0];
  const second = q2.items.find((i: any) => i.provider !== first.provider);
  if (!first || !second) throw new Error("no two-provider result set");
  log(`  selected ${first.title} [${first.provider.slice(0, 6)}…] and ${second.title} [${second.provider.slice(0, 6)}…] (metadata only)`);

  const quote = await api.ok("POST", "/quotes", { buyer: w.buyer.publicKey.toBase58(), assetPdas: [first.assetPda, second.assetPda], maxSpend: "60000" });
  log(`  quote ${quote.orderId}: total ${quote.total} TEST base units (= ${Number(quote.total) / 1e6} TEST, not dollars), est. ${quote.estimatedSolLamports} lamports SOL`);
  budget.reserve(BigInt(quote.total), BigInt(quote.estimatedSolLamports), "purchase bundle");

  const program = programFor(connection, w.buyer);
  const orderId = fromHex(quote.orderId);
  const items = quote.items.map((i: any) => ({
    assetPda: new PublicKey(i.assetPda),
    provider: new PublicKey(i.provider),
    price: BigInt(i.price),
    contentHash: fromHex(i.contentHash),
    licenseHash: fromHex(i.licenseHash),
  }));
  const tx = await buildBundleTx(program, w.buyer.publicKey, mint, treasury, orderId, items, quote.expiresAt);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.sign(w.buyer);
  const raw = tx.serialize();
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) throw new Error(`simulation failed: ${JSON.stringify(sim.value.err)} ${sim.value.logs?.slice(-5).join(" | ")}`);
  const signature = bs58.encode(tx.signature!);
  db.prepare("UPDATE quotes SET state='PENDING', tx_signature=? WHERE order_id=?").run(signature, quote.orderId);
  log(`  bundle: ${tx.instructions.length} purchase_unit instructions, ${raw.length} bytes, simulated ${sim.value.unitsConsumed} CU; signature ${signature}`);

  const before = await snapshot(connection, w, mint);
  const solBefore = await connection.getBalance(w.buyer.publicKey, "finalized");
  await connection.sendRawTransaction(raw, { skipPreflight: false });
  const slot = await waitFinalized(connection, signature);
  db.prepare("UPDATE quotes SET state='FINALIZED' WHERE order_id=?").run(quote.orderId);
  const after = await snapshot(connection, w, mint);
  const solAfter = await connection.getBalance(w.buyer.publicKey, "finalized");
  const txInfo = await connection.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
  const d = delta(before, after);
  log(`  finalized slot ${slot}; token deltas ${JSON.stringify(d)}`);

  const receipts = items.map((i: any) => pda.receipt(w.buyer.publicKey, orderId, i.assetPda).toBase58());
  const facts = [];
  const report: { source: string; receipt: string; fact: string }[] = [];
  for (const [i, r] of receipts.entries()) {
    const verified = await api.ok("GET", `/receipts/${r}`);
    const got = await deliver(api, w.buyer, r);
    // Evidence keeps hashes only; paid bytes go to the buyer's local report, never to shared evidence.
    facts.push({ source: quote.items[i].assetPda, provider: quote.items[i].provider, receipt: r, bodyBytes: Buffer.byteLength(got.body), contentHash: got.contentHash, licenseHash: got.licenseHash, hashVerified: true, receiptVerified: verified });
    report.push({ source: quote.items[i].assetPda, receipt: r, fact: got.body });
    log(`  ✓ delivered ${r}: ${Buffer.byteLength(got.body)} bytes, sha256 ${got.contentHash.slice(0, 12)}… matches receipt`);
  }
  const expected = { buyer: "-60000", providerA: "24000", providerB: "24000", treasury: "12000" };
  const exact = Object.entries(expected).every(([k, v]) => d[k] === v);
  const evidence = {
    kind: "atomic-two-provider-purchase",
    cluster: cfg.cluster,
    programId: program.programId.toBase58(),
    mint: mint.toBase58(),
    mintLabel: "TEST (no monetary value)",
    orderId: quote.orderId,
    signature,
    explorer: explorer(cfg.cluster, "tx", signature),
    finalizedSlot: slot,
    instructions: tx.instructions.length,
    serializedBytes: raw.length,
    simulatedCU: sim.value.unitsConsumed,
    landedCU: txInfo?.meta?.computeUnitsConsumed,
    feeLamports: txInfo?.meta?.fee,
    buyerSolDeltaLamports: (solAfter - solBefore).toString(),
    receiptRentLamportsEach: await connection.getMinimumBalanceForRentExemption(254),
    tokenDeltas: d,
    expectedDeltas: expected,
    deltasExact: exact,
    receipts: receipts.map((r: string) => ({ pda: r, explorer: explorer(cfg.cluster, "address", r) })),
    facts,
    budget: { tokensReserved: budget.tokens, tokenCap: budget.tokenCap },
    recordedAt: new Date().toISOString(),
  };
  if (!exact) throw new Error(`deltas not exact: ${JSON.stringify(d)}`);
  log(`  evidence -> ${writeEvidence(cfg, "purchase", evidence)}`);
  log("Agent report (local, buyer-only):");
  for (const f of report) log(`  - ${f.fact}  [source ${f.source}, receipt ${f.receipt}]`);
  return evidence;
}

const REQUIREMENT = { equipment: "X100", field: "recycling_certificate", requiredValue: "FICT-RECYCLE-2026" };

/** Local requester review of a synthetic submission (deterministic fixture check, no oracle). */
export function reviewSubmission(db: Db, assetPda: string) {
  const row = db.prepare("SELECT body, content_hash FROM assets WHERE asset_pda=?").get(assetPda) as { body: Buffer; content_hash: string } | undefined;
  if (!row || sha256hex(row.body) !== row.content_hash) return { ok: false, reason: "bytes unavailable or hash mismatch" };
  let parsed: any;
  try {
    parsed = JSON.parse(row.body.toString("utf8"));
  } catch {
    return { ok: false, reason: "not JSON" };
  }
  const ok = parsed.equipment === REQUIREMENT.equipment && parsed[REQUIREMENT.field] === REQUIREMENT.requiredValue;
  return { ok, reason: ok ? "required fields match" : `${REQUIREMENT.field}=${parsed[REQUIREMENT.field]}` };
}

async function createBounty(connection: Connection, w: Wallets, mint: PublicKey, reward: bigint, deadline: number) {
  const requirementHash = sha256(canonicalJson(REQUIREMENT));
  const bountyId = Uint8Array.from(randomBytes(16));
  const bounty = pda.bounty(w.requester.publicKey, bountyId);
  const sig = await programFor(connection, w.requester)
    .methods.createBounty(Array.from(bountyId), Array.from(requirementHash), new BN(reward.toString()), new BN(deadline))
    .accountsStrict({
      requester: w.requester.publicKey,
      config: pda.config(),
      bounty,
      mint,
      requesterToken: ata(w.requester.publicKey, mint),
      vault: ata(bounty, mint),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const slot = await waitFinalized(connection, sig);
  return { bounty, bountyId, requirementHash, sig, slot };
}

export async function runBounty(cfg: Config, connection: Connection, db: Db, w: Wallets, budget: Budget, license: Buffer, log = console.log) {
  const api = new Api(cfg.apiUrl);
  const mint = cfg.mint!;
  const reward = 2_000_000n;
  log("Agent task: X100 recycling certificate.");
  const s = await api.ok("GET", `/assets?q=${encodeURIComponent("inverter x100 recycling certificate")}&requiredTag=recycling`);
  log(`  search requiredTag=recycling -> gap=${s.gap}, items=${s.items.length}`);
  if (!s.gap) throw new Error("expected a data gap");
  const rent = await connection.getMinimumBalanceForRentExemption(8 + 32 + 16 + 32 + 8 + 8 + 1 + 32 + 1);
  budget.reserve(reward, BigInt(rent + 2_100_000 + 10_000), "bounty reward");
  log(`  budget ok: ${budget.tokens} / ${budget.tokenCap} TEST units committed this run`);

  const before = await snapshot(connection, w, mint);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const b = await createBounty(connection, w, mint, reward, deadline);
  const vault = ata(b.bounty, mint);
  const funded = await snapshot(connection, w, mint, { vault: b.bounty });
  log(`  create_bounty ${b.sig}; vault ${vault.toBase58()} holds ${funded.vault}`);

  // Provider prepares two inactive candidates: one wrong, one correct (synthetic).
  const wrong = await publishAsset(connection, db, {
    label: `BOUNTY-X100-RECYCLING-WRONG:${toHex(b.bountyId)}`, provider: w.providerA, title: "Solar inverter X100 recycling certificate", tags: "inverter recycling certificate",
    teaser: "Synthetic recycling certificate for X100", body: canonicalJson({ equipment: "X100", recycling_certificate: "WRONG" }), license, price: 30000n, active: false,
  }, log);
  const good = await publishAsset(connection, db, {
    label: `BOUNTY-X100-RECYCLING:${toHex(b.bountyId)}`, provider: w.providerA, title: "Solar inverter X100 recycling certificate", tags: "inverter recycling certificate",
    teaser: "Synthetic recycling certificate for X100", body: canonicalJson({ equipment: "X100", recycling_certificate: "FICT-RECYCLE-2026" }), license, price: 30000n, active: false,
  }, log);
  const subSigs: string[] = [];
  for (const asset of [wrong, good]) {
    const sig = await programFor(connection, w.providerA)
      .methods.submitBountySolution()
      .accountsStrict({ provider: w.providerA.publicKey, config: pda.config(), bounty: b.bounty, asset, submission: pda.submission(b.bounty, w.providerA.publicKey, asset), systemProgram: SystemProgram.programId })
      .rpc();
    await waitFinalized(connection, sig);
    subSigs.push(sig);
  }
  const afterSubmit = await snapshot(connection, w, mint, { vault: b.bounty });
  log(`  2 submissions recorded; vault still ${afterSubmit.vault} (no payout on upload)`);

  const reviews = [wrong, good].map((a) => ({ asset: a.toBase58(), ...reviewSubmission(db, a.toBase58()) }));
  for (const r of reviews) log(`  review ${r.asset.slice(0, 8)}…: ${r.ok ? "ACCEPTABLE" : "REJECTED"} (${r.reason})`);
  const chosen = reviews.find((r) => r.ok);
  if (!chosen) throw new Error("no valid submission");
  const chosenPk = new PublicKey(chosen.asset);
  const program = programFor(connection, w.requester);
  const asset = await program.account.dataAsset.fetch(chosenPk, "finalized");
  const acceptSig = await program.methods
    .acceptBountySolution(Array.from(b.requirementHash), asset.contentHash, asset.licenseHash)
    .accountsStrict({
      requester: w.requester.publicKey, config: pda.config(), bounty: b.bounty,
      submission: pda.submission(b.bounty, w.providerA.publicKey, chosenPk), asset: chosenPk, mint, vault,
      providerToken: ata(w.providerA.publicKey, mint), treasuryToken: ata(cfg.treasury!, mint),
      bountyReceipt: pda.bountyReceipt(b.bounty, chosenPk), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .rpc();
  const acceptSlot = await waitFinalized(connection, acceptSig);
  const afterAccept = await snapshot(connection, w, mint, { vault: b.bounty });
  const bountyReceipt = pda.bountyReceipt(b.bounty, chosenPk).toBase58();
  log(`  accept ${acceptSig}; deltas since funding ${JSON.stringify(delta(funded, afterAccept))}`);

  const got = await deliver(api, w.requester, bountyReceipt);
  log(`  ✓ delivered via bounty receipt ${bountyReceipt}: ${Buffer.byteLength(got.body)} bytes, sha256 ${got.contentHash.slice(0, 12)}… matches`);
  log("Agent report (local, requester-only):");
  log(`  - ${got.body}  [source ${chosenPk.toBase58()}, bounty receipt ${bountyReceipt}]`);
  const activateSig = await setActive(connection, db, w.providerA, chosenPk, true);
  const s2 = await api.ok("GET", `/assets?q=${encodeURIComponent("inverter x100 recycling certificate")}&requiredTag=recycling`);
  log(`  provider activated asset (${activateSig}); search gap now ${s2.gap}`);
  const fundDelta = delta(before, funded);
  const acceptDelta = delta(funded, afterAccept);
  const exact = fundDelta.requester === "-2000000" && fundDelta.vault === "2000000" && acceptDelta.vault === "-2000000" && acceptDelta.providerA === "1600000" && acceptDelta.treasury === "400000";
  const bountyState = await api.ok("GET", `/bounties/${b.bounty.toBase58()}`);
  const evidence = {
    kind: "bounty-accept",
    cluster: cfg.cluster,
    programId: program.programId.toBase58(),
    mint: mint.toBase58(),
    mintLabel: "TEST (no monetary value)",
    requirement: REQUIREMENT,
    requirementHash: toHex(b.requirementHash),
    bounty: b.bounty.toBase58(),
    vault: vault.toBase58(),
    createSignature: b.sig,
    submissionSignatures: subSigs,
    reviews,
    acceptSignature: acceptSig,
    acceptFinalizedSlot: acceptSlot,
    bountyReceipt,
    activateSignature: activateSig,
    explorer: {
      create: explorer(cfg.cluster, "tx", b.sig),
      accept: explorer(cfg.cluster, "tx", acceptSig),
      bounty: explorer(cfg.cluster, "address", b.bounty.toBase58()),
      receipt: explorer(cfg.cluster, "address", bountyReceipt),
    },
    fundingDeltas: fundDelta,
    acceptDeltas: acceptDelta,
    deltasExact: exact,
    delivered: { bodyBytes: Buffer.byteLength(got.body), contentHash: got.contentHash, hashVerified: true },
    gapAfterActivation: s2.gap,
    finalBountyState: bountyState,
    recordedAt: new Date().toISOString(),
  };
  if (!exact) throw new Error(`bounty deltas not exact`);
  log(`  evidence -> ${writeEvidence(cfg, "bounty", evidence)}`);
  return evidence;
}

export async function runRefund(cfg: Config, connection: Connection, w: Wallets, waitSecs: number, log = console.log) {
  const mint = cfg.mint!;
  const reward = 2_000_000n;
  const slotTime = async () => (await connection.getBlockTime(await connection.getSlot("confirmed"))) ?? Math.floor(Date.now() / 1000);
  const deadline = (await slotTime()) + waitSecs;
  const before = await snapshot(connection, w, mint);
  const b = await createBounty(connection, w, mint, reward, deadline);
  const vault = ata(b.bounty, mint);
  const program = programFor(connection, w.requester);
  const refundIx = () =>
    program.methods.refundExpiredBounty().accountsStrict({
      requester: w.requester.publicKey, config: pda.config(), bounty: b.bounty, mint, vault,
      requesterToken: ata(w.requester.publicKey, mint), tokenProgram: TOKEN_PROGRAM_ID,
    });
  let earlyRejected = "";
  try {
    await refundIx().rpc();
  } catch (e) {
    earlyRejected = String((e as Error).message).match(/DeadlineNotReached/)?.[0] ?? String(e).slice(0, 120);
  }
  log(`  refund bounty ${b.bounty.toBase58()} created (${b.sig}); early refund -> ${earlyRejected || "UNEXPECTEDLY SUCCEEDED"}`);
  const funded = await snapshot(connection, w, mint, { vault: b.bounty });
  while ((await slotTime()) < deadline) await new Promise((r) => setTimeout(r, 2000));
  const sig = await refundIx().rpc();
  const slot = await waitFinalized(connection, sig);
  const after = await snapshot(connection, w, mint, { vault: b.bounty });
  const d = delta(funded, after);
  log(`  refund ${sig}; deltas ${JSON.stringify(d)}`);
  const exact = d.requester === "2000000" && d.vault === "-2000000" && d.treasury === "0";
  const evidence = {
    kind: "bounty-expiry-refund",
    cluster: cfg.cluster,
    programId: program.programId.toBase58(),
    mint: mint.toBase58(),
    bounty: b.bounty.toBase58(),
    deadline,
    createSignature: b.sig,
    earlyRefundRejected: earlyRejected,
    refundSignature: sig,
    refundFinalizedSlot: slot,
    explorer: { create: explorer(cfg.cluster, "tx", b.sig), refund: explorer(cfg.cluster, "tx", sig) },
    fundingDeltas: delta(before, funded),
    refundDeltas: d,
    deltasExact: exact,
    feeCharged: d.treasury !== "0",
    recordedAt: new Date().toISOString(),
  };
  if (!exact || !earlyRejected.includes("DeadlineNotReached")) throw new Error("refund evidence not exact");
  log(`  evidence -> ${writeEvidence(cfg, "refund", evidence)}`);
  return evidence;
}

export { split };
