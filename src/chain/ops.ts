// Operator/provider/requester chain operations used by the local CLI. Each signer's
// key is loaded from a local path; nothing here is reachable from the API.
import { BN } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { createMint, getAccount, getMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Config, saveDeployment } from "../config";
import { AssetRow, Db, canonicalBytes, markFinalized, putAssetBytes, sha256, sha256hex } from "../data/store";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, ata, fromHex, loadKeypair, pda, programFor, toHex } from "./adn";

export function wallets(cfg: Config) {
  const k = cfg.keys;
  return {
    deployer: loadKeypair(k.deployer),
    buyer: loadKeypair(k.buyer),
    providerA: loadKeypair(k.providerA),
    providerB: loadKeypair(k.providerB),
    requester: loadKeypair(k.requester),
    treasury: loadKeypair(k.treasury),
  };
}
export type Wallets = ReturnType<typeof wallets>;

export async function waitFinalized(connection: Connection, sig: string) {
  for (let i = 0; i < 120; i++) {
    const st = (await connection.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0];
    if (st?.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(st.err)}`);
    if (st?.confirmationStatus === "finalized") return st.slot;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`tx ${sig} not finalized in time (PENDING)`);
}

/**
 * Idempotent bootstrap: TEST mint (6 decimals, legacy SPL), config (upgrade
 * authority only), ATAs precreated for every role, demo test-token balances.
 */
export async function bootstrap(cfg: Config, connection: Connection, w: Wallets, log = console.log) {
  let mint = cfg.mint;
  if (!mint) {
    mint = await createMint(connection, w.deployer, w.deployer.publicKey, null, 6);
    log(`created TEST mint ${mint.toBase58()}`);
  }
  const m = await getMint(connection, mint);
  if (m.decimals !== 6) throw new Error("mint must have 6 decimals");
  const program = programFor(connection, w.deployer);
  const configPda = pda.config();
  if (!(await connection.getAccountInfo(configPda))) {
    const sig = await program.methods
      .initializeConfig(w.treasury.publicKey)
      .accountsStrict({
        authority: w.deployer.publicKey,
        config: configPda,
        mint,
        program: program.programId,
        programData: pda.programData(),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    log(`initialize_config ${sig}`);
  }
  const onchain = await program.account.config.fetch(configPda);
  if (!onchain.mint.equals(mint)) throw new Error(`config mint ${onchain.mint.toBase58()} != ${mint.toBase58()}`);
  for (const k of [w.buyer, w.providerA, w.providerB, w.requester, w.treasury])
    await getOrCreateAssociatedTokenAccount(connection, w.deployer, mint, k.publicKey);
  // Demo balances in TEST base units (never dollars): buyer 1.0 TEST, requester 5.0 TEST.
  for (const [k, target] of [[w.buyer, 1_000_000n], [w.requester, 5_000_000n]] as const) {
    const bal = (await getAccount(connection, ata(k.publicKey, mint))).amount;
    if (bal < target) await mintTo(connection, w.deployer, mint, ata(k.publicKey, mint), w.deployer, target - bal);
  }
  saveDeployment(cfg, {
    cluster: cfg.cluster,
    programId: program.programId.toBase58(),
    mint: mint.toBase58(),
    treasury: onchain.treasury.toBase58(),
    mintLabel: "TEST (custom Devnet/local demo mint, 6 decimals, no monetary value)",
    wallets: Object.fromEntries(Object.entries(w).map(([n, k]) => [n, k.publicKey.toBase58()])),
    createdAt: new Date().toISOString(),
  });
  return mint;
}

export interface NewAsset {
  label: string;
  provider: Keypair;
  title: string;
  tags: string;
  teaser: string;
  body: string;
  license: Buffer;
  price: bigint;
  active: boolean;
}

/** Store immutable bytes, register on chain (if absent), then index after a finalized match. */
export async function publishAsset(connection: Connection, db: Db, a: NewAsset, log = console.log) {
  const assetId = Uint8Array.from(sha256(a.label).subarray(0, 16));
  const body = canonicalBytes(a.body);
  const contentHash = sha256(body);
  const licenseHash = sha256(a.license);
  const assetPda = pda.asset(a.provider.publicKey, assetId, 1);
  putAssetBytes(db, {
    asset_pda: assetPda.toBase58(),
    provider: a.provider.publicKey.toBase58(),
    asset_id: toHex(assetId),
    version: 1,
    title: a.title,
    tags: a.tags,
    teaser: a.teaser,
    body,
    license: a.license,
    content_hash: contentHash.toString("hex"),
    license_hash: licenseHash.toString("hex"),
    price: a.price.toString(),
  });
  const program = programFor(connection, a.provider);
  if (!(await connection.getAccountInfo(assetPda))) {
    const sig = await program.methods
      .registerDataAsset(Array.from(assetId), 1, Array.from(contentHash), Array.from(licenseHash), new BN(a.price.toString()), a.active)
      .accountsStrict({ provider: a.provider.publicKey, config: pda.config(), asset: assetPda, systemProgram: SystemProgram.programId })
      .rpc();
    log(`  register ${a.label} -> ${assetPda.toBase58()} (${sig})`);
    await waitFinalized(connection, sig);
  }
  await syncAsset(connection, db, assetPda);
  return assetPda;
}

/** Re-read the finalized DataAsset; index only when every term matches stored bytes. */
export async function syncAsset(connection: Connection, db: Db, assetPda: PublicKey) {
  const program = programFor(connection, Keypair.generate());
  const res = await connection.getAccountInfoAndContext(assetPda, "finalized");
  if (!res.value) throw new Error(`asset ${assetPda.toBase58()} not finalized`);
  const a = program.coder.accounts.decode("dataAsset", res.value.data);
  const row = db.prepare("SELECT * FROM assets WHERE asset_pda=?").get(assetPda.toBase58()) as AssetRow;
  const ok =
    row &&
    row.provider === a.provider.toBase58() &&
    row.asset_id === toHex(a.assetId) &&
    row.version === a.version &&
    row.content_hash === toHex(a.contentHash) &&
    row.license_hash === toHex(a.licenseHash) &&
    row.price === a.price.toString() &&
    sha256hex(row.body) === row.content_hash &&
    sha256hex(row.license) === row.license_hash;
  if (!ok) throw new Error(`asset ${assetPda.toBase58()} chain/store mismatch; not indexed`);
  markFinalized(db, assetPda.toBase58(), a.active, res.context.slot);
  return a;
}

export async function setActive(connection: Connection, db: Db, provider: Keypair, assetPda: PublicKey, active: boolean) {
  const sig = await programFor(connection, provider)
    .methods.setAssetActive(active)
    .accountsStrict({ provider: provider.publicKey, asset: assetPda })
    .rpc();
  await waitFinalized(connection, sig);
  await syncAsset(connection, db, assetPda);
  return sig;
}

/**
 * Reconcile PENDING quotes from chain after a crash/timeout. Never issues a new order
 * ID: a landed tx is recovered from its signature + receipt PDAs; a failed one is
 * FAILED; an unknown one stays UNKNOWN (the same order ID may be rebuilt, and an
 * existing receipt makes any duplicate fail on-chain).
 */
export async function reconcileQuotes(connection: Connection, db: Db) {
  const pending = db.prepare("SELECT order_id, buyer, items_json, tx_signature FROM quotes WHERE state='PENDING'").all() as {
    order_id: string; buyer: string; items_json: string; tx_signature: string | null;
  }[];
  const out: Record<string, string> = {};
  for (const q of pending) {
    let state = "UNKNOWN";
    if (q.tx_signature) {
      const st = (await connection.getSignatureStatuses([q.tx_signature], { searchTransactionHistory: true })).value[0];
      if (st?.err) state = "FAILED";
      else if (st?.confirmationStatus === "finalized") {
        const items = JSON.parse(q.items_json) as { assetPda: string }[];
        const receipts = await Promise.all(
          items.map((i) => connection.getAccountInfo(pda.receipt(new PublicKey(q.buyer), fromHex(q.order_id), new PublicKey(i.assetPda)), "finalized")),
        );
        state = receipts.every(Boolean) ? "FINALIZED" : "UNKNOWN";
      } else if (st) state = "PENDING";
    }
    db.prepare("UPDATE quotes SET state=? WHERE order_id=?").run(state, q.order_id);
    out[q.order_id] = state;
  }
  return out;
}

export { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, fromHex };
