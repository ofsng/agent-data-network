// Shared chain helpers: PDA derivation (same seeds as programs/adn), program client,
// exact two-instruction purchase bundle builder and receipt decoding.
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFileSync } from "fs";
import idlJson from "../../idl/adn.json";
import type { Adn } from "../../idl/adn";

export const IDL = idlJson as Adn;
export const PROGRAM_ID = new PublicKey(IDL.address);
export const FEE_BPS = 2000n;
export const KIND_PURCHASE = 0;
export const KIND_BOUNTY = 1;
export const BOUNTY_STATUS = ["OPEN", "ACCEPTED", "REFUNDED"] as const;
export const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

const enc = (s: string) => Buffer.from(s, "utf8");
const u32le = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

export function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

export function programFor(connection: Connection, signer: Keypair): Program<Adn> {
  const provider = new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" });
  return new Program<Adn>(IDL, provider);
}

export const pda = {
  config: (programId = PROGRAM_ID) => PublicKey.findProgramAddressSync([enc("config")], programId)[0],
  asset: (provider: PublicKey, assetId: Uint8Array, version: number, programId = PROGRAM_ID) =>
    PublicKey.findProgramAddressSync(
      [enc("asset"), provider.toBuffer(), Buffer.from(assetId), u32le(version)],
      programId,
    )[0],
  receipt: (buyer: PublicKey, orderId: Uint8Array, asset: PublicKey, programId = PROGRAM_ID) =>
    PublicKey.findProgramAddressSync(
      [enc("receipt"), buyer.toBuffer(), Buffer.from(orderId), asset.toBuffer()],
      programId,
    )[0],
  bounty: (requester: PublicKey, bountyId: Uint8Array, programId = PROGRAM_ID) =>
    PublicKey.findProgramAddressSync([enc("bounty"), requester.toBuffer(), Buffer.from(bountyId)], programId)[0],
  submission: (bounty: PublicKey, provider: PublicKey, asset: PublicKey, programId = PROGRAM_ID) =>
    PublicKey.findProgramAddressSync(
      [enc("submission"), bounty.toBuffer(), provider.toBuffer(), asset.toBuffer()],
      programId,
    )[0],
  bountyReceipt: (bounty: PublicKey, asset: PublicKey, programId = PROGRAM_ID) =>
    PublicKey.findProgramAddressSync([enc("bounty_receipt"), bounty.toBuffer(), asset.toBuffer()], programId)[0],
  programData: (programId = PROGRAM_ID) =>
    PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_LOADER_UPGRADEABLE)[0],
};

export const ata = (owner: PublicKey, mint: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);

export function split(amount: bigint): { provider: bigint; platform: bigint } {
  const platform = (amount * FEE_BPS) / 10000n;
  return { provider: amount - platform, platform };
}

export interface QuoteItem {
  assetPda: PublicKey;
  provider: PublicKey;
  price: bigint;
  contentHash: Uint8Array;
  licenseHash: Uint8Array;
}

/** One purchase_unit instruction with every account passed explicitly. */
export async function purchaseIx(
  program: Program<Adn>,
  buyer: PublicKey,
  mint: PublicKey,
  treasury: PublicKey,
  orderId: Uint8Array,
  item: QuoteItem,
  expiresAt: number,
): Promise<TransactionInstruction> {
  return program.methods
    .purchaseUnit(
      Array.from(orderId),
      new BN(item.price.toString()),
      Array.from(item.contentHash),
      Array.from(item.licenseHash),
      new BN(expiresAt),
    )
    .accountsStrict({
      buyer,
      config: pda.config(program.programId),
      asset: item.assetPda,
      receipt: pda.receipt(buyer, orderId, item.assetPda, program.programId),
      mint,
      buyerToken: ata(buyer, mint),
      providerToken: ata(item.provider, mint),
      treasuryToken: ata(treasury, mint),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * The atomic bundle: exactly the given purchase_unit instructions (normally two,
 * distinct providers) sharing one buyer/order ID, one signer = fee payer.
 * Optional compute-unit limit only; no memo or unrelated instructions.
 */
export async function buildBundleTx(
  program: Program<Adn>,
  buyer: PublicKey,
  mint: PublicKey,
  treasury: PublicKey,
  orderId: Uint8Array,
  items: QuoteItem[],
  expiresAt: number,
  computeUnitLimit?: number,
): Promise<Transaction> {
  const tx = new Transaction();
  if (computeUnitLimit) tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }));
  for (const item of items) tx.add(await purchaseIx(program, buyer, mint, treasury, orderId, item, expiresAt));
  tx.feePayer = buyer;
  return tx;
}

export const toHex = (b: Uint8Array | number[]) => Buffer.from(b as Uint8Array).toString("hex");
export const fromHex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

export { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID };
