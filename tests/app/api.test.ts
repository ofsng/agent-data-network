// API security/recovery tests (T18–T22) against the running local validator, using the
// deployment, SQLite store and receipts produced by `npm run cli -- bootstrap|seed|demo`.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AddressInfo } from "net";
import { readFileSync } from "fs";
import { join } from "path";
import { expect } from "chai";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { ROOT, loadConfig } from "../../src/config";
import { createApp } from "../../src/api/server";
import { openDb } from "../../src/data/store";
import { wallets, reconcileQuotes } from "../../src/chain/ops";
import { Api, Budget } from "../../src/agent/agent";

describe("api (T18–T22, T33)", () => {
  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const w = wallets(cfg);
  const purchase = JSON.parse(readFileSync(join(ROOT, "evidence", `${cfg.cluster}-purchase.json`), "utf8"));
  const receipt: string = purchase.receipts[0].pda;
  let api: Api;
  let server: ReturnType<typeof createApp>;

  before(async () => {
    server = createApp(cfg, db);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    api = new Api(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  });
  after(() => server.close());

  const sign = (kp: Keypair, msg: string) => bs58.encode(nacl.sign.detached(Buffer.from(msg, "utf8"), kp.secretKey));
  async function attempt(kp: Keypair, receiptPda: string, signer: Keypair = kp) {
    const ch = await api.ok("POST", "/challenges", { buyer: kp.publicKey.toBase58(), receiptPda });
    return { ch, res: await api.call("POST", "/deliveries", { buyer: kp.publicKey.toBase58(), receiptPda, nonce: ch.nonce, signature: sign(signer, ch.message) }) };
  }

  it("T18 no receipt / forged PDA / wrong buyer / bad signature -> no body", async () => {
    const missing = await attempt(w.buyer, Keypair.generate().publicKey.toBase58());
    expect(missing.res.status).to.equal(404);
    // Forged: an existing account not owned by the program (the asset PDA is program-owned but not a receipt; buyer wallet is system-owned).
    const forged = await attempt(w.buyer, w.buyer.publicKey.toBase58());
    expect(forged.res.status).to.equal(422);
    const notReceipt = await attempt(w.buyer, purchase.facts[0].source);
    expect(notReceipt.res.status).to.equal(422);
    const wrongBuyer = await attempt(w.providerB, receipt);
    expect(wrongBuyer.res.status).to.equal(403);
    const badSig = await attempt(w.buyer, receipt, w.providerB);
    expect(badSig.res.status).to.equal(401);
    for (const r of [missing, forged, notReceipt, wrongBuyer, badSig]) expect(r.res.json.bodyBase64).to.equal(undefined);
  });

  it("T19 nonce replay and expired challenge rejected; fresh proof works", async () => {
    const ok = await attempt(w.buyer, receipt);
    expect(ok.res.status).to.equal(200);
    const replay = await api.call("POST", "/deliveries", { buyer: w.buyer.publicKey.toBase58(), receiptPda: receipt, nonce: ok.ch.nonce, signature: sign(w.buyer, ok.ch.message) });
    expect(replay.status).to.equal(409);
    const ch = await api.ok("POST", "/challenges", { buyer: w.buyer.publicKey.toBase58(), receiptPda: receipt });
    db.prepare("UPDATE challenges SET expires_at=0 WHERE receipt_pda=? AND consumed_at IS NULL").run(receipt);
    const expired = await api.call("POST", "/deliveries", { buyer: w.buyer.publicKey.toBase58(), receiptPda: receipt, nonce: ch.nonce, signature: sign(w.buyer, ch.message) });
    expect(expired.status).to.equal(409);
    expect((await attempt(w.buyer, receipt)).res.status).to.equal(200);
  });

  it("T20 tampered stored bytes -> HASH_MISMATCH, no body; restore -> free retry", async () => {
    const asset = purchase.facts[0].source;
    const orig = (db.prepare("SELECT body FROM assets WHERE asset_pda=?").get(asset) as { body: Buffer }).body;
    db.prepare("UPDATE assets SET body=? WHERE asset_pda=?").run(Buffer.from("tampered"), asset);
    try {
      const bad = await attempt(w.buyer, receipt);
      expect(bad.res.status).to.equal(422);
      expect(bad.res.json.code).to.equal("HASH_MISMATCH");
      expect(bad.res.json.bodyBase64).to.equal(undefined);
    } finally {
      db.prepare("UPDATE assets SET body=? WHERE asset_pda=?").run(orig, asset);
    }
    const good = await attempt(w.buyer, receipt);
    expect(good.res.status).to.equal(200);
    expect(Buffer.from(good.res.json.bodyBase64, "base64").toString("hex").length / 2).to.equal(purchase.facts[0].bodyBytes);
    const log = db.prepare("SELECT result FROM delivery_log WHERE receipt_pda=? ORDER BY id DESC LIMIT 2").all(receipt) as { result: string }[];
    expect(log.map((l) => l.result)).to.deep.equal(["VERIFIED", "HASH_MISMATCH"]);
  });

  it("T21 crash/timeout recovery: PENDING quote reconciles to FINALIZED; lost cache rebuilt from chain", async () => {
    await new Promise((r) => setTimeout(r, 1100)); // stay under the per-wallet challenge rate limit
    db.prepare("UPDATE quotes SET state='PENDING' WHERE order_id=?").run(purchase.orderId);
    db.prepare("DELETE FROM delivery_log WHERE receipt_pda=?").run(receipt);
    db.prepare("DELETE FROM receipts WHERE pda=?").run(receipt);
    const res = await reconcileQuotes(new Connection(cfg.rpcUrl, "confirmed"), db);
    expect(res[purchase.orderId]).to.equal("FINALIZED");
    expect((await attempt(w.buyer, receipt)).res.status).to.equal(200);
    expect(db.prepare("SELECT 1 FROM receipts WHERE pda=?").get(receipt)).to.not.equal(undefined);
    const r = await api.ok("GET", `/receipts/${receipt}`);
    expect(r.buyer).to.equal(w.buyer.publicKey.toBase58());
  });

  it("T22 quote limits and oversized search reject", async () => {
    const [a, b] = purchase.facts.map((f: any) => f.source);
    const buyer = w.buyer.publicKey.toBase58();
    const dup = await api.call("POST", "/quotes", { buyer, assetPdas: [a, a], maxSpend: "60000" });
    expect(dup.status).to.equal(400);
    const sameProvider = db.prepare("SELECT asset_pda FROM assets WHERE provider=? AND asset_pda<>? AND active=1 LIMIT 1").get(purchase.facts[0].provider, a) as { asset_pda: string };
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [a, sameProvider.asset_pda], maxSpend: "60000" })).status).to.equal(400);
    const over = await api.call("POST", "/quotes", { buyer, assetPdas: [a, b], maxSpend: "59999" });
    expect(over.status).to.equal(400);
    expect(over.json.code).to.equal("OVER_BUDGET");
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [a, b, sameProvider.asset_pda], maxSpend: "90000" })).status).to.equal(400);
    expect((await api.call("GET", `/assets?q=${"x".repeat(257)}`)).status).to.equal(400);
    expect((await api.call("GET", `/assets?q=x&limit=21`)).status).to.equal(400);
    const search = await api.ok("GET", "/assets?q=inverter&limit=20");
    for (const i of search.items) expect(Object.keys(i)).to.not.include.members(["body", "license", "bodyBase64"]);
  });

  it("T33 per-run budget blocks a bounty beyond the remaining cap before any signing", () => {
    const b = new Budget();
    b.reserve(60_000n, 5_322_440n, "purchase");
    expect(() => b.reserve(2_100_000n, 1n, "bounty")).to.throw(/BUDGET/);
    expect(b.tokens).to.equal(60_000n);
    b.reserve(2_000_000n, 1n, "bounty");
    expect(b.tokens).to.equal(2_060_000n);
  });
});
