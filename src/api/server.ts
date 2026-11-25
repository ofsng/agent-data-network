// Local/protected read + delivery API (/api/v1). Never signs transactions, never
// accepts private keys, never returns bodies outside a verified receipt delivery.
import { createServer, IncomingMessage, ServerResponse } from "http";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { randomBytes } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Config, ROOT, loadConfig } from "../config";
import { BOUNTY_STATUS, ata, pda, split, toHex } from "../chain/adn";
import { ChainUnavailable, readOnlyProgram, verifyReceipt } from "../chain/verify";
import { AssetRow, Db, openDb, search, sha256hex } from "../data/store";

export const QUOTE_TTL_SECS = 120;
export const CHALLENGE_TTL_SECS = 60;
const MAX_BODY = 64 * 1024;

class HttpError extends Error {
  constructor(public status: number, public code: string, msg: string, public retryable = false) {
    super(msg);
  }
}

const now = () => Math.floor(Date.now() / 1000);

function pubkey(v: unknown, field: string): PublicKey {
  if (typeof v !== "string" || v.length > 44) throw new HttpError(400, "INVALID", `${field} must be base58 pubkey`);
  try {
    return new PublicKey(v);
  } catch {
    throw new HttpError(400, "INVALID", `${field} must be base58 pubkey`);
  }
}

export function challengeMessage(cfg: Config, buyer: string, receipt: string, nonceHex: string, expiry: number) {
  return Buffer.from(
    ["ADN-DELIVER-v1", cfg.deliveryDomain, cfg.cluster, cfg.programId.toBase58(), buyer, receipt, nonceHex, String(expiry)].join("\n"),
    "utf8",
  );
}

export function createApp(cfg: Config = loadConfig(), db: Db = openDb(cfg.dbPath)) {
  const connection = new Connection(cfg.rpcUrl, "finalized");
  const program = readOnlyProgram(connection);
  if (!cfg.mint || !cfg.treasury) throw new Error("deployment not bootstrapped (no mint/treasury)");
  const mint = cfg.mint;
  const hits = new Map<string, { n: number; t: number }>();

  function rateLimit(key: string, max = 30) {
    const t = now();
    const h = hits.get(key);
    if (!h || h.t !== t) hits.set(key, { n: 1, t });
    else if (++h.n > max) throw new HttpError(429, "RATE_LIMITED", "too many requests", true);
  }

  async function chain<T>(f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(503, "CHAIN_UNAVAILABLE", "chain unavailable", true);
    }
  }

  async function body(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) throw new HttpError(400, "INVALID", "body too large");
      chunks.push(c);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      throw new HttpError(400, "INVALID", "invalid JSON");
    }
  }

  const routes: Array<[string, RegExp, (m: RegExpMatchArray, req: IncomingMessage, url: URL) => Promise<[number, unknown]>]> = [
    ["GET", /^\/api\/v1\/health$/, async () => {
      let rpcOk = false;
      try {
        await connection.getSlot("finalized");
        rpcOk = true;
      } catch {}
      const dbOk = !!db.prepare("SELECT 1 AS ok").get();
      const body = {
        cluster: cfg.cluster,
        programId: cfg.programId.toBase58(),
        mint: mint.toBase58(),
        mintLabel: cfg.deployment?.mintLabel ?? "TEST",
        treasury: cfg.treasury!.toBase58(),
        rpcOk,
        dbOk,
      };
      return [rpcOk && dbOk ? 200 : 503, body];
    }],

    ["GET", /^\/api\/v1\/assets$/, async (_m, _r, url) => {
      const q = url.searchParams.get("q") ?? "";
      const requiredTag = url.searchParams.get("requiredTag") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? 10);
      if (q.length > 256 || (requiredTag && requiredTag.length > 64)) throw new HttpError(400, "INVALID", "query too long");
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new HttpError(400, "INVALID", "limit 1-20");
      const res = search(db, q, requiredTag, limit);
      return [200, { items: res.items.map((i) => ({ ...i, mint: mint.toBase58() })), gap: res.gap }];
    }],

    ["POST", /^\/api\/v1\/quotes$/, async (_m, req) => {
      const b = await body(req);
      const buyer = pubkey(b.buyer, "buyer");
      if (!Array.isArray(b.assetPdas) || b.assetPdas.length !== 2) throw new HttpError(400, "INVALID", "exactly 2 assetPdas");
      const pdas = b.assetPdas.map((a: unknown, i: number) => pubkey(a, `assetPdas[${i}]`));
      if (pdas[0].equals(pdas[1])) throw new HttpError(400, "INVALID", "duplicate asset");
      if (typeof b.maxSpend !== "string" || !/^\d{1,20}$/.test(b.maxSpend)) throw new HttpError(400, "INVALID", "maxSpend u64 string");
      const maxSpend = BigInt(b.maxSpend);
      const assets = await chain(() => Promise.all(pdas.map((p: PublicKey) => program.account.dataAsset.fetchNullable(p, "finalized"))));
      const items = assets.map((a, i) => {
        if (!a) throw new HttpError(404, "NOT_FOUND", `asset ${pdas[i].toBase58()} not finalized`);
        if (!a.active) throw new HttpError(409, "STALE", "asset inactive");
        const row = db.prepare("SELECT content_hash FROM assets WHERE asset_pda=?").get(pdas[i].toBase58()) as { content_hash: string } | undefined;
        if (!row || row.content_hash !== toHex(a.contentHash)) throw new HttpError(409, "STALE", "asset not in local store");
        if (a.provider.equals(buyer)) throw new HttpError(400, "INVALID", "buyer is provider");
        return {
          assetPda: pdas[i].toBase58(),
          provider: a.provider.toBase58(),
          version: a.version,
          price: a.price.toString(),
          contentHash: toHex(a.contentHash),
          licenseHash: toHex(a.licenseHash),
        };
      });
      if (items[0].provider === items[1].provider) throw new HttpError(400, "INVALID", "two distinct providers required");
      const total = items.reduce((s, i) => s + BigInt(i.price), 0n);
      if (total > maxSpend) throw new HttpError(400, "OVER_BUDGET", `total ${total} exceeds maxSpend ${maxSpend}`);
      const rent = await chain(() => connection.getMinimumBalanceForRentExemption(254));
      const orderId = randomBytes(16).toString("hex");
      const expiresAt = now() + QUOTE_TTL_SECS;
      db.prepare("INSERT INTO quotes(order_id,buyer,items_json,total,expires_at,state) VALUES(?,?,?,?,?,'QUOTED')").run(
        orderId, buyer.toBase58(), JSON.stringify(items), total.toString(), expiresAt,
      );
      return [200, {
        orderId,
        buyer: buyer.toBase58(),
        items: items.map((i) => ({ ...i, providerAmount: split(BigInt(i.price)).provider.toString(), platformAmount: split(BigInt(i.price)).platform.toString() })),
        total: total.toString(),
        feeBps: 2000,
        mint: mint.toBase58(),
        expiresAt,
        estimatedSolLamports: String(2 * rent + 5000),
      }];
    }],

    ["GET", /^\/api\/v1\/receipts\/([1-9A-HJ-NP-Za-km-z]{32,44})$/, async (m) => {
      const res = await chain(() => verifyReceipt(connection, pubkey(m[1], "pda"), { mint }));
      if (res.status === "pending") return [202, { status: "PENDING" }];
      if (res.status === "missing") throw new HttpError(404, "NOT_FOUND", "receipt not found");
      if (res.status === "invalid") throw new HttpError(422, "INVALID_RECEIPT", res.reason);
      return [200, res.receipt];
    }],

    ["POST", /^\/api\/v1\/challenges$/, async (_m, req) => {
      const b = await body(req);
      const buyer = pubkey(b.buyer, "buyer");
      const receipt = pubkey(b.receiptPda, "receiptPda");
      rateLimit(`ch:${buyer.toBase58()}`, 10);
      const nonce = randomBytes(32).toString("hex");
      const expiresAt = now() + CHALLENGE_TTL_SECS;
      const message = challengeMessage(cfg, buyer.toBase58(), receipt.toBase58(), nonce, expiresAt);
      db.prepare("INSERT INTO challenges(nonce_hash,buyer,receipt_pda,message,expires_at) VALUES(?,?,?,?,?)").run(
        sha256hex(nonce), buyer.toBase58(), receipt.toBase58(), message, expiresAt,
      );
      return [200, { nonce, message: message.toString("utf8"), expiresAt }];
    }],

    ["POST", /^\/api\/v1\/deliveries$/, async (_m, req) => {
      const b = await body(req);
      const buyer = pubkey(b.buyer, "buyer");
      const receiptPk = pubkey(b.receiptPda, "receiptPda");
      if (typeof b.nonce !== "string" || !/^[0-9a-f]{64}$/.test(b.nonce)) throw new HttpError(400, "INVALID", "nonce");
      if (typeof b.signature !== "string" || b.signature.length > 100) throw new HttpError(400, "INVALID", "signature");
      rateLimit(`dl:${buyer.toBase58()}`, 10);
      const ch = db.prepare("SELECT * FROM challenges WHERE nonce_hash=?").get(sha256hex(b.nonce)) as
        | { buyer: string; receipt_pda: string; message: Buffer; expires_at: number; consumed_at: number | null }
        | undefined;
      if (!ch || ch.buyer !== buyer.toBase58() || ch.receipt_pda !== receiptPk.toBase58())
        throw new HttpError(401, "BAD_PROOF", "unknown challenge");
      if (ch.consumed_at !== null || ch.expires_at <= now()) throw new HttpError(409, "NONCE_USED", "challenge used or expired");
      let sig: Uint8Array;
      try {
        sig = bs58.decode(b.signature);
      } catch {
        throw new HttpError(401, "BAD_PROOF", "signature encoding");
      }
      if (sig.length !== 64 || !nacl.sign.detached.verify(ch.message, sig, buyer.toBytes()))
        throw new HttpError(401, "BAD_PROOF", "invalid wallet signature");

      const res = await chain(() => verifyReceipt(connection, receiptPk, { mint }));
      if (res.status === "pending") return [202, { status: "PENDING" }];
      if (res.status === "missing") throw new HttpError(404, "NOT_FOUND", "receipt not found");
      if (res.status === "invalid") throw new HttpError(422, "INVALID_RECEIPT", res.reason);
      const r = res.receipt;
      if (r.buyer !== buyer.toBase58()) throw new HttpError(403, "WRONG_BUYER", "receipt belongs to another wallet");

      const asset = db.prepare("SELECT * FROM assets WHERE asset_pda=?").get(r.asset) as AssetRow | undefined;
      if (!asset) {
        throw new HttpError(503, "UNAVAILABLE", "bytes temporarily unavailable", true);
      }
      const bodyOk = sha256hex(asset.body) === r.contentHash && asset.content_hash === r.contentHash;
      const licOk = sha256hex(asset.license) === r.licenseHash && asset.license_hash === r.licenseHash;

      // Consume the nonce exactly once, after verification, atomically.
      const consumed = db.transaction(() => {
        const u = db
          .prepare("UPDATE challenges SET consumed_at=? WHERE nonce_hash=? AND consumed_at IS NULL AND expires_at > ?")
          .run(now(), sha256hex(b.nonce), now());
        if (u.changes !== 1) return false;
        db.prepare(
          `INSERT INTO receipts(pda,buyer,asset_pda,order_id,kind,finalized_slot,amount,provider_amount,platform_amount,content_hash,license_hash,mint,version,verified_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pda) DO UPDATE SET verified_at=excluded.verified_at`,
        ).run(r.pda, r.buyer, r.asset, r.orderId, r.kind, r.finalizedSlot, r.amount, r.providerAmount, r.platformAmount,
          r.contentHash, r.licenseHash, r.mint, r.version, now());
        db.prepare("INSERT INTO delivery_log(receipt_pda,delivered_at,result) VALUES(?,?,?)").run(
          r.pda, now(), bodyOk && licOk ? "VERIFIED" : "HASH_MISMATCH",
        );
        return true;
      })();
      if (!consumed) throw new HttpError(409, "NONCE_USED", "challenge used or expired");
      if (!bodyOk || !licOk) throw new HttpError(422, "HASH_MISMATCH", "stored bytes do not match receipt; no content returned");
      return [200, {
        assetPda: r.asset,
        version: r.version,
        bodyBase64: asset.body.toString("base64"),
        licenseBase64: asset.license.toString("base64"),
        contentHash: r.contentHash,
        licenseHash: r.licenseHash,
        receiptPda: r.pda,
      }];
    }],

    ["GET", /^\/api\/v1\/bounties$/, async (_m, _r, url) => {
      const status = url.searchParams.get("status");
      const all = await chain(() => program.account.bounty.all());
      const items = await Promise.all(
        all
          .filter((b) => !status || BOUNTY_STATUS[b.account.status] === status)
          .map(async (b) => bountyView(b.publicKey, b.account)),
      );
      return [200, { items }];
    }],

    ["GET", /^\/api\/v1\/bounties\/([1-9A-HJ-NP-Za-km-z]{32,44})$/, async (m) => {
      const pk = pubkey(m[1], "pda");
      const b = await chain(() => program.account.bounty.fetchNullable(pk, "finalized"));
      if (!b) throw new HttpError(404, "NOT_FOUND", "bounty not found");
      const subs = await chain(() => program.account.submission.all([{ memcmp: { offset: 8, bytes: pk.toBase58() } }]));
      return [200, { ...(await bountyView(pk, b)), submissions: subs.map((s) => ({ submissionPda: s.publicKey.toBase58(), provider: s.account.provider.toBase58(), asset: s.account.asset.toBase58() })) }];
    }],

    ["GET", /^\/api\/v1\/evidence$/, async () => {
      const dir = join(ROOT, "evidence");
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
      return [200, { items: files.map((f) => ({ file: f, data: JSON.parse(readFileSync(join(dir, f), "utf8")) })) }];
    }],
  ];

  async function bountyView(pk: PublicKey, b: any) {
    let vaultBalance = "0";
    try {
      vaultBalance = (await getAccount(connection, ata(pk, mint), "finalized")).amount.toString();
    } catch {}
    return {
      bountyPda: pk.toBase58(),
      requester: b.requester.toBase58(),
      bountyId: toHex(b.bountyId),
      requirementHash: toHex(b.requirementHash),
      reward: b.reward.toString(),
      deadline: Number(b.deadline.toString()),
      status: BOUNTY_STATUS[b.status],
      winnerSubmission: b.winnerSubmission.equals(PublicKey.default) ? null : b.winnerSubmission.toBase58(),
      vault: ata(pk, mint).toBase58(),
      vaultBalance,
      bountyReceipt: await winnerReceipt(pk, b),
    };
  }

  async function winnerReceipt(pk: PublicKey, b: any): Promise<string | null> {
    if (b.winnerSubmission.equals(PublicKey.default)) return null;
    const s = await program.account.submission.fetchNullable(b.winnerSubmission, "finalized");
    return s ? pda.bountyReceipt(pk, s.asset, program.programId).toBase58() : null;
  }

  const dashboard = () => readFileSync(join(ROOT, "src/api/dashboard.html"));

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(JSON.stringify(payload));
    };
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'" });
        return res.end(dashboard());
      }
      rateLimit(`ip:${req.socket.remoteAddress}`, 60);
      for (const [method, re, handler] of routes) {
        const m = url.pathname.match(re);
        if (m && req.method === method) {
          const [status, payload] = await handler(m, req, url);
          return send(status, payload);
        }
      }
      throw new HttpError(404, "NOT_FOUND", "no route");
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { code: e.code, message: e.message, retryable: e.retryable });
      if (e instanceof ChainUnavailable) return send(503, { code: "CHAIN_UNAVAILABLE", message: "chain unavailable", retryable: true });
      console.error("internal error", (e as Error).message);
      return send(500, { code: "INTERNAL", message: "internal error", retryable: true });
    }
  });
}

if (require.main === module) {
  const cfg = loadConfig();
  const server = createApp(cfg);
  server.listen(cfg.port, "127.0.0.1", () =>
    console.log(`ADN API on http://127.0.0.1:${cfg.port} (${cfg.cluster}, program ${cfg.programId.toBase58()})`),
  );
}

