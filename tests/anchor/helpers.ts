import { BN, Program } from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { createHash, randomBytes } from "crypto";
import { expect } from "chai";
import type { Adn } from "../../idl/adn";
import { ata, pda } from "../../src/chain/adn";

export const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
export const connection = new Connection(RPC, "confirmed");

export const sha = (s: string | Buffer) => Uint8Array.from(createHash("sha256").update(s).digest());
export const rand16 = () => Uint8Array.from(randomBytes(16));

export async function fund(kp: PublicKey, sol = 5) {
  const sig = await connection.requestAirdrop(kp, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

export async function newFunded(sol = 5) {
  const kp = Keypair.generate();
  await fund(kp.publicKey, sol);
  return kp;
}

export async function tokenBal(owner: PublicKey, mint: PublicKey): Promise<bigint> {
  try {
    return (await getAccount(connection, ata(owner, mint))).amount;
  } catch {
    return 0n;
  }
}

export async function setupMint(authority: Keypair, decimals = 6) {
  return createMint(connection, authority, authority.publicKey, null, decimals);
}

export async function ensureAta(payer: Keypair, mint: PublicKey, owner: PublicKey, amount = 0n, mintAuthority?: Keypair) {
  const acc = await getOrCreateAssociatedTokenAccount(connection, payer, mint, owner, true);
  if (amount > 0n && mintAuthority) await mintTo(connection, payer, mint, acc.address, mintAuthority, amount);
  return acc.address;
}

export async function send(ixs: TransactionInstruction[], signers: Keypair[], skipPreflight = false) {
  const tx = new Transaction().add(...ixs);
  return sendAndConfirmTransaction(connection, tx, signers, { commitment: "confirmed", skipPreflight });
}

/** Asserts the transaction fails and that the logs/message mention `needle`. */
export async function expectFail(p: Promise<unknown>, needle: string | RegExp) {
  let err: any;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err, `expected failure matching ${needle}`).to.not.equal(undefined);
  let text = String(err?.message ?? err);
  if (err instanceof SendTransactionError || err?.logs || err?.transactionLogs) {
    const logs = err.logs ?? err.transactionLogs ?? (await err.getLogs?.(connection).catch(() => [])) ?? [];
    text += "\n" + logs.join("\n");
  }
  if (process.env.ADN_TEST_VERBOSE) {
    const line = text.split("\n").find((l) => /Error Code|custom program error|already in use|Error Message/.test(l)) ?? text.split("\n")[0];
    console.log("      ↳ rejected:", line.trim().slice(0, 160));
  }
  if (typeof needle === "string") expect(text).to.contain(needle);
  else expect(text).to.match(needle);
  return text;
}

export async function chainNow(): Promise<number> {
  const slot = await connection.getSlot("confirmed");
  return (await connection.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function registerAsset(
  program: Program<Adn>,
  provider: Keypair,
  opts: { price?: bigint; active?: boolean; body?: string; version?: number; assetId?: Uint8Array } = {},
) {
  const assetId = opts.assetId ?? rand16();
  const version = opts.version ?? 1;
  const contentHash = sha(opts.body ?? `body-${Buffer.from(assetId).toString("hex")}`);
  const licenseHash = sha("SYNTHETIC-DEMO v1");
  const price = opts.price ?? 30000n;
  const asset = pda.asset(provider.publicKey, assetId, version, program.programId);
  await program.methods
    .registerDataAsset(
      Array.from(assetId),
      version,
      Array.from(contentHash),
      Array.from(licenseHash),
      new BN(price.toString()),
      opts.active ?? true,
    )
    .accountsStrict({
      provider: provider.publicKey,
      config: pda.config(program.programId),
      asset,
      systemProgram: new PublicKey("11111111111111111111111111111111"),
    })
    .signers([provider])
    .rpc();
  return { assetPda: asset, provider: provider.publicKey, price, contentHash, licenseHash, assetId, version };
}
