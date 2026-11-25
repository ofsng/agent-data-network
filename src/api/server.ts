// Local web app: /api/v1 read + delivery API, guarded /api/demo routes for the
// guided demo, and the static product UI. Binds to loopback only. Never accepts
// private keys, arbitrary transactions or recipients; never returns paid bytes
// outside a verified wallet-bound delivery (or the run's own token-gated state).
import { createServer, IncomingMessage, ServerResponse } from "http";
import { existsSync, readdirSync, readFileSync } from "fs";
import { extname, join, normalize } from "path";
import { ROOT, loadConfig, Config } from "../config";
import { wallets } from "../chain/ops";
import { Db, openDb } from "../data/store";
import { trustView } from "../data/trust";
import { DemoOrchestrator, STEPS } from "../demo/orchestrator";
import { Service, ServiceError, createService } from "./service";

const MAX_BODY = 64 * 1024;
const WEB = join(ROOT, "src/web");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
const now = () => Math.floor(Date.now() / 1000);

export function createApp(cfg: Config = loadConfig(), db: Db = openDb(cfg.dbPath), opts: { demo?: boolean } = {}) {
  const svc: Service = createService(cfg, db);
  const orch = opts.demo === false ? null : new DemoOrchestrator(svc, wallets(cfg));
  const hits = new Map<string, { n: number; t: number }>();

  function rateLimit(key: string, max = 30) {
    const t = now();
    const h = hits.get(key);
    if (!h || h.t !== t) hits.set(key, { n: 1, t });
    else if (++h.n > max) throw new ServiceError(429, "RATE_LIMITED", "too many requests", true);
  }

  async function body(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) throw new ServiceError(400, "INVALID", "body too large");
      chunks.push(c);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      throw new ServiceError(400, "INVALID", "invalid JSON");
    }
  }

  function sameOrigin(req: IncomingMessage) {
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) throw new ServiceError(403, "ORIGIN", "cross-origin demo action refused");
  }

  function runAuth(req: IncomingMessage, runId: string) {
    sameOrigin(req);
    if (!orch!.checkToken(runId, req.headers["x-run-token"])) throw new ServiceError(401, "RUN_TOKEN", "missing or invalid run token");
  }

  type Handler = (m: RegExpMatchArray, req: IncomingMessage, url: URL) => Promise<[number, unknown]>;
  const PDA = "([1-9A-HJ-NP-Za-km-z]{32,44})";
  const routes: Array<[string, RegExp, Handler]> = [
    ["GET", /^\/api\/v1\/health$/, async () => {
      const h = await svc.health();
      return [h.rpcOk && h.dbOk ? 200 : 503, { ...h, demo: !!orch, agent: "deterministic rule-based (no LLM)", transport: "direct Anchor (x402 not used)", mcp: "not connected" }];
    }],
    ["GET", /^\/api\/v1\/assets$/, async (_m, req, url) => {
      rateLimit(`s:${req.socket.remoteAddress}`, 30);
      return [200, svc.searchAssets(url.searchParams.get("q") ?? "", url.searchParams.get("requiredTag") ?? undefined, Number(url.searchParams.get("limit") ?? 10))];
    }],
    ["GET", /^\/api\/v1\/catalog$/, async () => {
      const rows = db.prepare("SELECT asset_pda, provider, asset_id, version, title, tags, teaser, price, content_hash, license_hash, active, finalized_slot FROM assets WHERE finalized_slot IS NOT NULL ORDER BY title").all() as any[];
      return [200, { items: rows.map((r) => ({ assetPda: r.asset_pda, provider: r.provider, assetId: r.asset_id, version: r.version, title: r.title, tags: r.tags.split(/\s+/), teaser: r.teaser, price: r.price, contentHash: r.content_hash, licenseHash: r.license_hash, active: r.active === 1, finalizedSlot: r.finalized_slot, trust: trustView(db, svc.snapDir, r.asset_pda) })) }];
    }],
    ["POST", /^\/api\/v1\/quotes$/, async (_m, req) => {
      const b = await body(req);
      return [200, await svc.quote(b.buyer, b.assetPdas, b.maxSpend, b.kind === "single" ? "single" : "bundle")];
    }],
    ["GET", new RegExp(`^/api/v1/receipts/${PDA}$`), async (m) => {
      const r = await svc.receipt(m[1]);
      return "pending" in r ? [202, { status: "PENDING" }] : [200, r];
    }],
    ["POST", /^\/api\/v1\/challenges$/, async (_m, req) => {
      const b = await body(req);
      rateLimit(`ch:${String(b.buyer)}`, 10);
      return [200, svc.issueChallenge(b.buyer, b.receiptPda)];
    }],
    ["POST", /^\/api\/v1\/deliveries$/, async (_m, req) => {
      const b = await body(req);
      rateLimit(`dl:${String(b.buyer)}`, 10);
      const r = await svc.deliver(b.buyer, b.receiptPda, b.nonce, b.signature);
      return "pending" in r ? [202, { status: "PENDING" }] : [200, r];
    }],
    ["GET", /^\/api\/v1\/bounties$/, async (_m, _r, url) => [200, { items: await svc.listBounties(url.searchParams.get("status")) }]],
    ["GET", new RegExp(`^/api/v1/bounties/${PDA}$`), async (m) => [200, await svc.getBounty(m[1])]],
    ["GET", /^\/api\/v1\/evidence$/, async () => {
      const dir = join(ROOT, "evidence");
      const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));
      const runs = existsSync(join(dir, "runs")) ? readdirSync(join(dir, "runs")).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 10).map((f) => read(join(dir, "runs", f))) : [];
      const tests = existsSync(join(dir, "test-summary.json")) ? read(join(dir, "test-summary.json")) : [];
      const latest = existsSync(join(dir, "run-manifest.json")) ? read(join(dir, "run-manifest.json")) : null;
      return [200, { latest, runs, tests }];
    }],

    // ---- guided demo (loopback, same-origin, run token) ----
    ["GET", /^\/api\/demo\/scenes$/, async () => [200, DemoOrchestrator.scenes()]],
    ["POST", /^\/api\/demo\/runs$/, async (_m, req) => {
      sameOrigin(req);
      rateLimit("demo:create", 1);
      const r = await orch!.createRun();
      return [200, { runId: r.runId, token: r.token, state: r.state }];
    }],
    ["GET", /^\/api\/demo\/runs\/(run-[0-9a-f-]{10,40})$/, async (m, req) => {
      runAuth(req, m[1]);
      const s = orch!.get(m[1]);
      if (!s) throw new ServiceError(404, "NOT_FOUND", "run not found");
      return [200, s];
    }],
    ["POST", /^\/api\/demo\/runs\/(run-[0-9a-f-]{10,40})\/advance$/, async (m, req) => {
      runAuth(req, m[1]);
      const b = await body(req);
      if (typeof b.expectedStep !== "string" || !(STEPS as readonly string[]).includes(b.expectedStep)) throw new ServiceError(400, "INVALID", "expectedStep");
      try {
        return [200, await orch!.advance(m[1], b.expectedStep, typeof b.idempotencyKey === "string" ? b.idempotencyKey.slice(0, 64) : undefined)];
      } catch (e: any) {
        throw new ServiceError(e.status ?? 500, e.status === 409 ? "CONFLICT" : "ERROR", e.message);
      }
    }],
    ["GET", /^\/api\/demo\/runs\/(run-[0-9a-f-]{10,40})\/evidence$/, async (m, req) => {
      runAuth(req, m[1]);
      const s = orch!.get(m[1]);
      if (!s) throw new ServiceError(404, "NOT_FOUND", "run not found");
      return [200, orch!.manifest(s)];
    }],
  ];

  function serveStatic(pathname: string, res: ServerResponse) {
    const rel = pathname === "/" ? "index.html" : normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
    const file = join(WEB, rel);
    if (!file.startsWith(WEB) || !existsSync(file) || !TYPES[extname(file)]) return false;
    res.writeHead(200, {
      "content-type": TYPES[extname(file)], "cache-control": "no-store", "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    res.end(readFileSync(file));
    return true;
  }

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(JSON.stringify(payload));
    };
    try {
      if (req.method === "GET" && !url.pathname.startsWith("/api/") && serveStatic(url.pathname, res)) return;
      if (url.pathname.startsWith("/api/v1/")) rateLimit(`ip:${req.socket.remoteAddress}`, 60);
      for (const [method, re, handler] of routes) {
        const m = url.pathname.match(re);
        if (m && req.method === method) {
          if (url.pathname.startsWith("/api/demo") && !orch) throw new ServiceError(404, "NOT_FOUND", "demo disabled");
          const [status, payload] = await handler(m, req, url);
          return send(status, payload);
        }
      }
      throw new ServiceError(404, "NOT_FOUND", "no route");
    } catch (e) {
      if (e instanceof ServiceError) return send(e.status, { code: e.code, message: e.message, retryable: e.retryable });
      console.error("internal error:", (e as Error).message?.slice(0, 200));
      return send(500, { code: "INTERNAL", message: "internal error", retryable: true });
    }
  });
}

if (require.main === module) {
  const cfg = loadConfig();
  const server = createApp(cfg);
  server.listen(cfg.port, "127.0.0.1", () =>
    console.log(`ADN app on http://127.0.0.1:${cfg.port} (${cfg.cluster}, program ${cfg.programId.toBase58()})`),
  );
}
