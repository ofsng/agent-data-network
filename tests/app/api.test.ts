// Application tests (T18–T22, T40–T47, T50, T52–T53, demo guards) against the running
// local validator, using the deployment, store and at least one COMPLETE guided run
// (evidence/run-manifest.json) produced by `npm run cli -- demo` or the UI.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AddressInfo } from "net";
import { readFileSync, readdirSync, renameSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { expect } from "chai";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { ROOT, loadConfig } from "../../src/config";
import { createApp } from "../../src/api/server";
import { createService } from "../../src/api/service";
import { canonicalBytes, openDb, sha256hex } from "../../src/data/store";
import { TrustError, snapshotDir, validateUnit } from "../../src/data/trust";
import { loadKeypair } from "../../src/chain/adn";
import { reconcileQuotes, setActive, wallets } from "../../src/chain/ops";
import { Api } from "../../src/agent/agent";
import { BudgetError, RunBudget } from "../../src/agent/budget";
import { AgentTools } from "../../src/agent/tools";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("app (T18–T22, T40–T47, T50, T52–T53)", () => {
  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const svc = createService(cfg, db);
  const w = wallets(cfg);
  const m = JSON.parse(readFileSync(join(ROOT, "evidence", "run-manifest.json"), "utf8"));
  const runKey = (r: string) => loadKeypair(join(homedir(), ".config/adn-demo/runs", cfg.cluster, m.runId, `${r}.json`));
  const agent = runKey("agent");
  const agent2 = runKey("agent2");
  const purchaseReceipt: string = m.receipts[0].pda;
  const purchaseAsset: string = m.receipts[0].asset;
  const otherAsset: string = m.receipts[1].asset;
  const resaleReceipt: string = m.receipts.find((r: any) => r.buyer === agent2.publicKey.toBase58()).pda;
  const commissioned: string = m.bounties[0].accept.assetPda;
  const conn = new Connection(cfg.rpcUrl, "confirmed");
  const agentAta = getAssociatedTokenAddressSync(new PublicKey(m.mint), agent.publicKey);
  let api: Api;
  let server: ReturnType<typeof createApp>;
  let port: number;

  before(async () => {
    server = createApp(cfg, db);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as AddressInfo).port;
    api = new Api(`http://127.0.0.1:${port}`);
  });
  after(() => server.close());

  const sign = (kp: Keypair, msg: string) => bs58.encode(nacl.sign.detached(Buffer.from(msg, "utf8"), kp.secretKey));
  async function attempt(kp: Keypair, receiptPda: string, signer: Keypair = kp) {
    const ch = await api.ok("POST", "/challenges", { buyer: kp.publicKey.toBase58(), receiptPda });
    return { ch, res: await api.call("POST", "/deliveries", { buyer: kp.publicKey.toBase58(), receiptPda, nonce: ch.nonce, signature: sign(signer, ch.message) }) };
  }
  const row = (pda: string) => db.prepare("SELECT body, license, content_hash FROM assets WHERE asset_pda=?").get(pda) as { body: Buffer; license: Buffer; content_hash: string };

  it("T18 no receipt / forged / wrong buyer / bad signature -> no body", async () => {
    expect((await attempt(agent, Keypair.generate().publicKey.toBase58())).res.status).to.equal(404);
    expect((await attempt(agent, agent.publicKey.toBase58())).res.status).to.equal(422);
    expect((await attempt(agent, purchaseAsset)).res.status).to.equal(422);
    expect((await attempt(agent2, purchaseReceipt)).res.status).to.equal(403);
    const bad = await attempt(agent, purchaseReceipt, agent2);
    expect(bad.res.status).to.equal(401);
    expect(bad.res.json.bodyBase64).to.equal(undefined);
  });

  it("T19 nonce replay and expired challenge rejected; fresh proof works", async () => {
    await sleep(1100);
    const ok = await attempt(agent, purchaseReceipt);
    expect(ok.res.status).to.equal(200);
    const replay = await api.call("POST", "/deliveries", { buyer: agent.publicKey.toBase58(), receiptPda: purchaseReceipt, nonce: ok.ch.nonce, signature: sign(agent, ok.ch.message) });
    expect(replay.status).to.equal(409);
    const ch = await api.ok("POST", "/challenges", { buyer: agent.publicKey.toBase58(), receiptPda: purchaseReceipt });
    db.prepare("UPDATE challenges SET expires_at=0 WHERE receipt_pda=? AND consumed_at IS NULL").run(purchaseReceipt);
    expect((await api.call("POST", "/deliveries", { buyer: agent.publicKey.toBase58(), receiptPda: purchaseReceipt, nonce: ch.nonce, signature: sign(agent, ch.message) })).status).to.equal(409);
    expect((await attempt(agent, purchaseReceipt)).res.status).to.equal(200);
  });

  it("T20/T43 corrupted bytes after payment: fail closed, exact snapshot restore, free retry; no snapshot -> unresolved", async () => {
    await sleep(1100);
    const orig = row(purchaseAsset);
    const balBefore = (await conn.getTokenAccountBalance(agentAta)).value.amount;
    db.prepare("UPDATE assets SET body=? WHERE asset_pda=?").run(Buffer.from("tampered"), purchaseAsset);
    const r1 = await attempt(agent, purchaseReceipt);
    expect([r1.res.status, r1.res.json.code]).to.deep.equal([503, "RESTORED_RETRY"]);
    expect(r1.res.json.bodyBase64).to.equal(undefined);
    expect(row(purchaseAsset).body.equals(orig.body)).to.equal(true);
    const r2 = await attempt(agent, purchaseReceipt);
    expect(r2.res.status).to.equal(200);
    expect(sha256hex(Buffer.from(r2.res.json.bodyBase64, "base64"))).to.equal(orig.content_hash);
    const snap = join(snapshotDir(cfg.cluster), `${purchaseAsset}.json`);
    renameSync(snap, `${snap}.bak`);
    try {
      await sleep(1100);
      db.prepare("UPDATE assets SET body=? WHERE asset_pda=?").run(Buffer.from("tampered"), purchaseAsset);
      const r3 = await attempt(agent, purchaseReceipt);
      expect([r3.res.status, r3.res.json.code]).to.deep.equal([422, "HASH_MISMATCH"]);
      expect(r3.res.json.bodyBase64).to.equal(undefined);
    } finally {
      renameSync(`${snap}.bak`, snap);
      db.prepare("UPDATE assets SET body=? WHERE asset_pda=?").run(orig.body, purchaseAsset);
    }
    expect((await conn.getTokenAccountBalance(agentAta)).value.amount).to.equal(balBefore); // no new charge
  });

  it("T43 withdrawn listing keeps prior entitlement; no new sale while inactive", async () => {
    await sleep(1100);
    const active = (db.prepare("SELECT active FROM assets WHERE asset_pda=?").get(commissioned) as { active: number }).active === 1;
    if (active) await setActive(svc.connection, db, w.providerA, new PublicKey(commissioned), false);
    expect((await attempt(agent2, resaleReceipt)).res.status).to.equal(200);
    const q = await api.call("POST", "/quotes", { buyer: Keypair.generate().publicKey.toBase58(), assetPdas: [commissioned], maxSpend: "30000", kind: "single" });
    expect([q.status, q.json.code]).to.deep.equal([409, "STALE"]);
  });

  it("T21 PENDING quote reconciles to FINALIZED from chain; no new order", async () => {
    const order = (db.prepare("SELECT order_id FROM quotes WHERE state='FINALIZED' ORDER BY rowid DESC LIMIT 1").get() as { order_id: string }).order_id;
    db.prepare("UPDATE quotes SET state='PENDING' WHERE order_id=?").run(order);
    const n = (db.prepare("SELECT count(*) AS n FROM quotes").get() as { n: number }).n;
    const res = await reconcileQuotes(conn, db);
    expect(res[order]).to.equal("FINALIZED");
    expect((db.prepare("SELECT count(*) AS n FROM quotes").get() as { n: number }).n).to.equal(n);
  });

  it("T22 quote limits and oversized search reject", async () => {
    const buyer = Keypair.generate().publicKey.toBase58();
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, purchaseAsset], maxSpend: "60000" })).status).to.equal(400);
    const sameProv = (db.prepare("SELECT asset_pda FROM assets WHERE provider=(SELECT provider FROM assets WHERE asset_pda=?) AND asset_pda<>? AND active=1 LIMIT 1").get(purchaseAsset, purchaseAsset) as { asset_pda: string }).asset_pda;
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, sameProv], maxSpend: "60000" })).status).to.equal(400);
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, otherAsset], maxSpend: "59999" })).json.code).to.equal("OVER_BUDGET");
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, otherAsset, sameProv], maxSpend: "90000" })).status).to.equal(400);
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, otherAsset], maxSpend: "90000", kind: "single" })).status).to.equal(400);
    expect((await api.call("GET", `/assets?q=${"x".repeat(257)}`)).status).to.equal(400);
    expect((await api.call("GET", `/assets?q=x&limit=21`)).status).to.equal(400);
  });

  it("T40 trust validation: fixture valid; malformed inputs rejected before publishing", () => {
    const lic = canonicalBytes("SYNTHETIC-DEMO v1\nx\n");
    const meta = { title: "Unit title", tags: "inverter test", teaser: "Synthetic teaser" };
    const decl = { sourceLabel: "Synthetic fixture / NorthLab", observedAt: Math.floor(Date.now() / 1000), rightsDeclared: true, schemaId: "TEXT_V1" as const };
    expect(() => validateUnit(canonicalBytes("Peak efficiency 97.4%"), lic, meta, decl)).to.not.throw();
    expect(() => validateUnit(canonicalBytes('{"equipment":"X100","recycling_certificate":"A"}'), lic, meta, { ...decl, schemaId: "BOUNTY_JSON_V2" })).to.not.throw();
    const bad: [Buffer, any, any, string][] = [
      [Buffer.from([0xff, 0xfe, 0x41]), meta, decl, "UTF8"],
      [Buffer.alloc(0), meta, decl, "SIZE"],
      [Buffer.alloc(65537, 0x41), meta, decl, "SIZE"],
      [canonicalBytes("x"), meta, { ...decl, rightsDeclared: false }, "RIGHTS"],
      [canonicalBytes("x"), meta, { ...decl, sourceLabel: "" }, "SOURCE"],
      [canonicalBytes("x"), meta, { ...decl, observedAt: Math.floor(Date.now() / 1000) + 3600 }, "TIMESTAMP"],
      [canonicalBytes("not json"), meta, { ...decl, schemaId: "BOUNTY_JSON_V2" }, "SCHEMA"],
      [canonicalBytes('{"equipment":"X100","recycling_certificate":"A","extra":"1"}'), meta, { ...decl, schemaId: "BOUNTY_JSON_V2" }, "SCHEMA"],
      [canonicalBytes("x"), { ...meta, title: "<script>" }, decl, "TITLE"],
    ];
    for (const [body, mt, d, code] of bad) {
      let err: any;
      try { validateUnit(body, lic, mt, d); } catch (e) { err = e; }
      expect(err, code).to.be.instanceOf(TrustError);
      expect(err.code).to.equal(code);
    }
  });

  it("T41/T50 metadata, bounties, health, catalog, evidence expose no paid body or bounty answer; missing trust blocks quote", async () => {
    const secrets = ["Peak efficiency 97.4%", "Stock 18 units", "FICT-RECYCLE-2026", '"WRONG"'];
    const pages = [
      await api.call("GET", "/assets?q=inverter%20x100%20efficiency%20lead%20time%20recycling&limit=20"),
      await api.call("GET", "/catalog"), await api.call("GET", "/bounties"), await api.call("GET", "/health"),
      await api.call("GET", "/evidence"), await api.call("GET", `/bounties/${m.bounties[0].bountyPda}`),
    ];
    for (const p of pages) for (const s of secrets) expect(JSON.stringify(p.json), s).to.not.contain(s);
    for (const f of readdirSync(join(ROOT, "evidence", "runs"))) {
      const txt = readFileSync(join(ROOT, "evidence", "runs", f), "utf8");
      for (const s of secrets) expect(txt, `${f}:${s}`).to.not.contain(s);
    }
    const t = db.prepare("SELECT * FROM asset_trust WHERE asset_pda=?").get(purchaseAsset) as any;
    db.prepare("DELETE FROM asset_trust WHERE asset_pda=?").run(purchaseAsset);
    try {
      const q = await api.call("POST", "/quotes", { buyer: Keypair.generate().publicKey.toBase58(), assetPdas: [purchaseAsset, otherAsset], maxSpend: "60000" });
      expect([q.status, q.json.code]).to.deep.equal([422, "TRUST_INVALID"]);
    } finally {
      db.prepare("INSERT INTO asset_trust VALUES(?,?,?,?,?,?,?,?)").run(t.asset_pda, t.source_label, t.observed_at, t.rights_declared, t.schema_id, t.validation_status, t.accuracy_status, t.synthetic);
    }
  });

  it("T42 prequote preflight: corrupt bytes -> 422, missing snapshot -> 503, restored -> quote ok", async () => {
    const buyer = Keypair.generate().publicKey.toBase58();
    const orig = row(purchaseAsset);
    db.prepare("UPDATE assets SET body=? WHERE asset_pda=?").run(Buffer.from("tampered"), purchaseAsset);
    try {
      const q = await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, otherAsset], maxSpend: "60000" });
      expect([q.status, q.json.code]).to.deep.equal([422, "HASH_MISMATCH"]);
    } finally {
      db.prepare("UPDATE assets SET body=? WHERE asset_pda=?").run(orig.body, purchaseAsset);
    }
    const snap = join(snapshotDir(cfg.cluster), `${purchaseAsset}.json`);
    renameSync(snap, `${snap}.bak`);
    try {
      const q = await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, otherAsset], maxSpend: "60000" });
      expect([q.status, q.json.code]).to.deep.equal([503, "SNAPSHOT_UNAVAILABLE"]);
    } finally {
      renameSync(`${snap}.bak`, snap);
    }
    expect((await api.call("POST", "/quotes", { buyer, assetPdas: [purchaseAsset, otherAsset], maxSpend: "60000" })).status).to.equal(200);
  });

  it("T44/T45 review reports are pass/fail only; requirement v2 has no answer; wrong candidate failed", () => {
    expect(m.reviews).to.have.length(2);
    const [wrong, good] = m.reviews;
    expect([wrong.passed, wrong.checks.fixtureMatch]).to.deep.equal([false, false]);
    expect(good.passed).to.equal(true);
    expect(Object.keys(good.preview).sort()).to.deep.equal(["byteLength", "equipment", "field", "observedAt", "schemaId", "sourceLabel"]);
    const req = JSON.parse(readFileSync(join(ROOT, "fixtures", "bounty.json"), "utf8")).requirement;
    expect(JSON.stringify(req)).to.not.contain("FICT-RECYCLE-2026");
    expect(m.bounties[0].requirementHash).to.equal(good.requirementHash);
  });

  it("T46 typed tools: invalid input, wrong-buyer verify/retrieve and non-allowlisted bounty denied", async () => {
    const trace: any[] = [];
    const budget = new RunBudget(db, { runId: `t46-${Date.now()}`, role: "test", buyer: agent2.publicKey.toBase58(), tokenCap: 0n, solCap: 0n, maxBounties: 0, expiresAt: Math.floor(Date.now() / 1000) + 60 });
    const tools = new AgentTools(svc, agent2, budget, trace, "test", {});
    let e1: any; try { await tools.get_data_quote(["not-a-key"], 1n, "single"); } catch (e) { e1 = e; }
    expect(e1?.code).to.equal("INVALID");
    let e2: any; try { await tools.verify_receipt(purchaseReceipt); } catch (e) { e2 = e; }
    expect(e2?.code).to.equal("WRONG_BUYER");
    await sleep(1100);
    let e3: any; try { await tools.retrieve_data(purchaseReceipt); } catch (e) { e3 = e; }
    expect(e3?.code).to.equal("WRONG_BUYER");
    let e4: any; try { await tools.create_bounty("NOT_ALLOWED" as any, 1n, 60); } catch (e) { e4 = e; }
    expect(e4).to.be.instanceOf(BudgetError);
    expect(trace.map((t) => t.status)).to.deep.equal(["error", "error", "error", "error"]);
    expect(Object.getOwnPropertyNames(AgentTools.prototype).filter((n) => /sign|transfer/i.test(n))).to.deep.equal([]);
  });

  it("T47 durable budget: cap, duplicates, one bounty, pending counts, no policy expansion", () => {
    const pol = { runId: `t47-${Date.now()}`, role: "agent", buyer: agent.publicKey.toBase58(), tokenCap: 2_100_000n, solCap: 50_000_000n, maxBounties: 1, expiresAt: Math.floor(Date.now() / 1000) + 600 };
    const b = new RunBudget(db, pol);
    const id = (x: string) => `${pol.runId}:${x}`;
    b.reserve(id("p1"), "PURCHASE", 60_000n, 5_000_000n);
    b.mark(id("p1"), "PENDING", { signature: "sig" });
    expect(() => b.reserve(id("p1"), "PURCHASE", 1n, 1n)).to.throw(/duplicate/);
    expect(() => b.reserve(id("b-over"), "BOUNTY", 2_100_000n, 1n)).to.throw(/BUDGET/); // pending 60k still counts
    b.reserve(id("b1"), "BOUNTY", 2_000_000n, 1n);
    expect(() => b.reserve(id("b2"), "BOUNTY", 1n, 1n)).to.throw(/at most 1 bounty/);
    expect(() => new RunBudget(db, { ...pol, tokenCap: 9_000_000n })).to.throw(/cannot change/);
    b.mark(id("p1"), "NOT_LANDED");
    expect(b.summary().tokensCommitted).to.equal("2000000");
    expect(() => b.mark(id("p1"), "FINALIZED")).to.throw(/terminal/);
  });

  it("T52/T53 resale and all deltas exact; ≥2 complete isolated runs with distinct IDs and receipts", () => {
    expect(m.deltas.purchase).to.include({ agent: "-60000", providerA: "24000", providerB: "24000", treasury: "12000" });
    expect(m.deltas.bountyAccept).to.include({ vault: "-2000000", providerA: "1600000", treasury: "400000" });
    expect(m.deltas.resale).to.include({ agent2: "-30000", providerA: "24000", treasury: "6000" });
    expect(m.deltas.refund).to.include({ refundRequester: "2000000", vault: "-2000000", treasury: "0" });
    const runs = readdirSync(join(ROOT, "evidence", "runs")).map((f) => JSON.parse(readFileSync(join(ROOT, "evidence", "runs", f), "utf8"))).filter((r) => r.status === "complete");
    expect(runs.length).to.be.at.least(2);
    expect(new Set(runs.map((r) => r.runId)).size).to.equal(runs.length);
    const receipts = runs.flatMap((r) => r.receipts.map((x: any) => x.pda));
    expect(new Set(receipts).size).to.equal(receipts.length);
  });

  it("demo API guards: run token, cross-origin, static traversal", async () => {
    const base = `http://127.0.0.1:${port}/api/demo/runs/${m.runId}`;
    expect((await fetch(base)).status).to.equal(401);
    expect((await fetch(`${base}/advance`, { method: "POST", body: "{}" })).status).to.equal(401);
    expect((await fetch(`${base}/evidence`, { headers: { "x-run-token": "wrong" } })).status).to.equal(401);
    expect((await fetch(`http://127.0.0.1:${port}/api/demo/runs`, { method: "POST", headers: { origin: "http://evil.example" } })).status).to.equal(403);
    expect((await fetch(`http://127.0.0.1:${port}/%2e%2e/package.json`)).status).to.equal(404);
  });
});
