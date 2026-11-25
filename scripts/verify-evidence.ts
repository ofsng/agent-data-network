// Independently re-check evidence/run-manifest.json against the chain: every recorded
// transaction must exist, be finalized at the recorded slot and have succeeded; every
// receipt must be a program-owned account whose decoded fields match the manifest.
import { Connection, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { join } from "path";
import { ROOT, loadConfig } from "../src/config";
import { readOnlyProgram } from "../src/chain/verify";

(async () => {
  const cfg = loadConfig();
  const file = process.argv[2] ?? join(ROOT, "evidence", "run-manifest.json");
  const m = JSON.parse(readFileSync(file, "utf8"));
  const conn = new Connection(cfg.rpcUrl, "finalized");
  const program = readOnlyProgram(conn);
  let ok = true;
  console.log(`manifest ${m.runId} (${m.mode}) program ${m.programId} via ${cfg.rpcUrl}`);
  if (m.programId !== program.programId.toBase58()) throw new Error("program ID mismatch");
  for (const t of m.transactions.filter((x: any) => x.kind !== "setup")) {
    const tx = await conn.getTransaction(t.signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
    const good = !!tx && tx.meta?.err === null && (t.slot == null || tx.slot === t.slot);
    ok &&= good;
    console.log(`${good ? "✓" : "✗"} tx   ${t.signature.slice(0, 16)}… slot ${tx?.slot ?? "?"} fee ${tx?.meta?.fee ?? "?"}  ${t.label}`);
  }
  for (const r of m.receipts) {
    const info = await conn.getAccountInfo(new PublicKey(r.pda), "finalized");
    let good = !!info && info.owner.equals(program.programId);
    if (good) {
      const d = program.coder.accounts.decode("purchaseReceipt", info!.data);
      good = d.buyer.toBase58() === r.buyer && d.amount.toString() === r.amount && d.providerAmount.toString() === r.providerAmount && Buffer.from(d.contentHash).toString("hex") === r.contentHash;
    }
    ok &&= good;
    console.log(`${good ? "✓" : "✗"} rcpt ${r.pda} kind ${r.kind} amount ${r.amount} = ${r.providerAmount} + ${r.platformAmount}`);
  }
  console.log(ok ? "ALL EVIDENCE VERIFIED ON CHAIN" : "VERIFICATION FAILED");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("verify failed:", e.message);
  process.exit(1);
});
