// Finalized receipt verification: owner, exact PDA recomputation, mint/kind/buyer,
// asset/version/hashes/amount against the asset's on-chain terms.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program } from "@anchor-lang/core";
import type { Adn } from "../../idl/adn";
import { KIND_BOUNTY, KIND_PURCHASE, pda, programFor, toHex } from "./adn";

export class ChainUnavailable extends Error {}

export function readOnlyProgram(connection: Connection): Program<Adn> {
  return programFor(connection, Keypair.generate());
}

export interface VerifiedReceipt {
  pda: string;
  buyer: string;
  provider: string;
  asset: string;
  mint: string;
  orderId: string;
  version: number;
  contentHash: string;
  licenseHash: string;
  amount: string;
  providerAmount: string;
  platformAmount: string;
  timestamp: number;
  kind: number;
  finalizedSlot: number;
}

export type ReceiptCheck =
  | { status: "ok"; receipt: VerifiedReceipt }
  | { status: "pending" }
  | { status: "missing" }
  | { status: "invalid"; reason: string };

export async function verifyReceipt(
  connection: Connection,
  receiptPda: PublicKey,
  expect: { mint: PublicKey; buyer?: PublicKey },
): Promise<ReceiptCheck> {
  const program = readOnlyProgram(connection);
  let info, slot: number;
  try {
    const res = await connection.getAccountInfoAndContext(receiptPda, "finalized");
    info = res.value;
    slot = res.context.slot;
    if (!info) {
      const conf = await connection.getAccountInfo(receiptPda, "confirmed");
      return conf ? { status: "pending" } : { status: "missing" };
    }
  } catch (e) {
    throw new ChainUnavailable(String(e));
  }
  if (!info.owner.equals(program.programId)) return { status: "invalid", reason: "owner" };
  let r;
  try {
    r = program.coder.accounts.decode("purchaseReceipt", info.data);
  } catch {
    return { status: "invalid", reason: "decode" };
  }
  const assetPk: PublicKey = r.asset;
  let expected: PublicKey;
  if (r.kind === KIND_PURCHASE) expected = pda.receipt(r.buyer, Uint8Array.from(r.orderId), assetPk, program.programId);
  else if (r.kind === KIND_BOUNTY)
    expected = pda.bountyReceipt(pda.bounty(r.buyer, Uint8Array.from(r.orderId), program.programId), assetPk, program.programId);
  else return { status: "invalid", reason: "kind" };
  if (!expected.equals(receiptPda)) return { status: "invalid", reason: "pda" };
  if (!r.mint.equals(expect.mint)) return { status: "invalid", reason: "mint" };
  if (expect.buyer && !r.buyer.equals(expect.buyer)) return { status: "invalid", reason: "buyer" };

  // Terms must match the immutable on-chain asset.
  const assetInfo = await connection.getAccountInfo(assetPk, "finalized");
  if (!assetInfo || !assetInfo.owner.equals(program.programId)) return { status: "invalid", reason: "asset" };
  const a = program.coder.accounts.decode("dataAsset", assetInfo.data);
  if (
    a.version !== r.version ||
    toHex(a.contentHash) !== toHex(r.contentHash) ||
    toHex(a.licenseHash) !== toHex(r.licenseHash) ||
    !a.provider.equals(r.provider)
  )
    return { status: "invalid", reason: "asset-terms" };
  if (r.kind === KIND_PURCHASE && a.price.toString() !== r.amount.toString())
    return { status: "invalid", reason: "amount" };
  if (BigInt(r.providerAmount.toString()) + BigInt(r.platformAmount.toString()) !== BigInt(r.amount.toString()))
    return { status: "invalid", reason: "split" };

  return {
    status: "ok",
    receipt: {
      pda: receiptPda.toBase58(),
      buyer: r.buyer.toBase58(),
      provider: r.provider.toBase58(),
      asset: assetPk.toBase58(),
      mint: r.mint.toBase58(),
      orderId: toHex(r.orderId),
      version: r.version,
      contentHash: toHex(r.contentHash),
      licenseHash: toHex(r.licenseHash),
      amount: r.amount.toString(),
      providerAmount: r.providerAmount.toString(),
      platformAmount: r.platformAmount.toString(),
      timestamp: Number(r.timestamp.toString()),
      kind: r.kind,
      finalizedSlot: slot,
    },
  };
}
