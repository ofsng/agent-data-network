// Builds public/: a read-only, static copy of the UI over one finished Devnet session, for
// hosting (Vercel). It serves the same JSON the local API returns, captured now from the
// Devnet program and the local Devnet store. Nothing that signs is included: no keys, no
// demo routes, no paid bytes (checked before writing).
// Usage: SOLANA_CLUSTER=devnet npx tsx scripts/export-public.ts
import { AddressInfo } from "net";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT, loadConfig } from "../src/config";
import { createApp } from "../src/api/server";
import { createService } from "../src/api/service";
import { openDb } from "../src/data/store";
import { DemoOrchestrator, manifestPath } from "../src/demo/orchestrator";
import { wallets } from "../src/chain/ops";

const cfg = loadConfig();
if (cfg.cluster !== "devnet") throw new Error("export the public snapshot from Devnet (SOLANA_CLUSTER=devnet)");
const OUT = join(ROOT, "public");
const SNAP = join(OUT, "snapshot");
const manifest = JSON.parse(readFileSync(manifestPath("devnet"), "utf8"));
const db = openDb(cfg.dbPath);
const svc = createService(cfg, db);
const run = new DemoOrchestrator(svc, wallets(cfg)).get(manifest.runId);
if (!run || run.step !== "COMPLETE") throw new Error(`Devnet session ${manifest.runId} is not complete in ${cfg.dbPath}`);

// The buyer's own view shows the facts it paid for; the public copy must not give them away.
const HIDDEN = "[paid content: delivered only to the receipt holder]";
const redact = (v: any): any =>
  Array.isArray(v) ? v.map(redact)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ["fact", "bodyBase64", "licenseBase64", "body", "answer"].includes(k) ? HIDDEN : redact(x)]))
  : v;

(async () => {
  const server = createApp(cfg, db, { demo: false });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (p: string) => {
    const r = await fetch(base + p);
    if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
    return r.json();
  };
  const files: Record<string, unknown> = {
    "health.json": { ...(await get("/api/v1/health")), snapshot: { runId: run.runId, exportedAt: new Date().toISOString(), repo: "https://github.com/ofsng/agent-data-network" } },
    "scenes.json": DemoOrchestrator.scenes(),
    "catalog.json": await get("/api/v1/catalog"),
    "bounties.json": await get("/api/v1/bounties"),
    "evidence.json": await get("/api/v1/evidence"),
    "run.json": redact(run),
    "manifest.json": manifest,
  };
  for (const r of manifest.receipts) files[`receipts/${r.pda}.json`] = await get(`/api/v1/receipts/${r.pda}`);
  for (const b of (files["bounties.json"] as any).items) files[`bounties/${b.bountyPda}.json`] = await get(`/api/v1/bounties/${b.bountyPda}`);
  server.close();
  for (const k of Object.keys(files)) files[k] = redact(files[k]);

  // Leak check: no paid content or bounty answer anywhere in the snapshot.
  const answer = JSON.parse(readFileSync(join(ROOT, "fixtures", "bounty.json"), "utf8")).solution.recycling_certificate;
  const paid = (db.prepare("SELECT body FROM assets").all() as { body: Buffer }[]).map((r) => r.body.toString("utf8")).filter((b) => b.length > 24);
  const all = JSON.stringify(files);
  if (all.includes(answer) || paid.some((b) => all.includes(b))) throw new Error("snapshot would leak paid content; aborting");
  if (/"secretKey"|BEGIN PRIVATE KEY/.test(all)) throw new Error("snapshot contains key material; aborting");

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(SNAP, "receipts"), { recursive: true });
  mkdirSync(join(SNAP, "bounties"), { recursive: true });
  for (const [f, v] of Object.entries(files)) writeFileSync(join(SNAP, f), JSON.stringify(v));
  const web = join(ROOT, "src", "web");
  for (const f of readdirSync(web)) cpSync(join(web, f), join(OUT, f), { recursive: true });
  const html = readFileSync(join(OUT, "index.html"), "utf8").replace("<head>", '<head>\n<meta name="adn-static" content="1">');
  writeFileSync(join(OUT, "index.html"), html);
  // Static hosting config: same CSP as the local server, no framing, no sniffing.
  writeFileSync(join(OUT, "vercel.json"), JSON.stringify({
    cleanUrls: true,
    headers: [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }],
  }, null, 2));
  if (existsSync(join(ROOT, "video", "adn-tanitim-tr.mp4"))) console.log("note: the explainer video is not copied (too large); link it separately");
  console.log(`public/ written: session ${run.runId}, ${Object.keys(files).length} snapshot files`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
