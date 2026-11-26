// Private canonical data store (SQLite) + fixture import + metadata-only search.
// SQLite is a content cache/index; paid status always comes from the chain.
import Database from "better-sqlite3";
import { createHash } from "crypto";
import { mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { ROOT } from "../config";

export const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest();
export const sha256hex = (b: Uint8Array | string) => sha256(b).toString("hex");

/** NFC + CRLF->LF, UTF-8 bytes. These exact bytes are hashed and stored. */
export const canonicalBytes = (s: string) => Buffer.from(s.normalize("NFC").replace(/\r\n/g, "\n"), "utf8");

/** Deterministic fixture asset ID: first 16 bytes of SHA-256(label). */
export const fixtureAssetId = (label: string) => Uint8Array.from(sha256(label).subarray(0, 16));

/** Sorted-key, no-whitespace JSON with NFC strings (requirement hashing). */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k.normalize("NFC"))}:${canonicalJson((v as any)[k])}`)
      .join(",")}}`;
  return typeof v === "string" ? JSON.stringify(v.normalize("NFC")) : JSON.stringify(v);
}

export interface FixtureRow {
  id: string;
  supplier_id: string;
  title: string;
  tags: string;
  summary: string;
  body: string;
  price: string;
  license: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

export function loadFixtures(dir = join(ROOT, "fixtures")) {
  const [header, ...data] = parseCsv(readFileSync(join(dir, "units.csv"), "utf8"));
  const rows = data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])) as unknown as FixtureRow);
  const license = canonicalBytes(readFileSync(join(dir, "LICENSE.txt"), "utf8"));
  const bounty = JSON.parse(readFileSync(join(dir, "bounty.json"), "utf8"));
  return { rows, license, bounty };
}

export interface AssetRow {
  asset_pda: string;
  provider: string;
  asset_id: string;
  version: number;
  title: string;
  tags: string;
  teaser: string;
  body: Buffer;
  license: Buffer;
  content_hash: string;
  license_hash: string;
  price: string;
  active: number;
  finalized_slot: number | null;
}

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='assets'").get();
  if (!exists) db.exec(readFileSync(join(ROOT, "src/data/schema.sql"), "utf8"));
  // Additive migrations (idempotent, no table resets).
  for (const m of ["004-trust-sidecar.sql", "005-demo-runs.sql", "006-agent-accounts.sql"])
    db.transaction(() => db.exec(readFileSync(join(ROOT, "src/data/migrations", m), "utf8")))();
  return db;
}
export type Db = ReturnType<typeof openDb>;

/** Store immutable bytes before chain registration; never overwrite existing bytes. */
export function putAssetBytes(db: Db, a: Omit<AssetRow, "active" | "finalized_slot">) {
  const existing = db.prepare("SELECT content_hash, license_hash FROM assets WHERE asset_pda=?").get(a.asset_pda) as
    | { content_hash: string; license_hash: string }
    | undefined;
  if (existing) {
    if (existing.content_hash !== a.content_hash || existing.license_hash !== a.license_hash)
      throw new Error(`immutable bytes differ for ${a.asset_pda}`);
    return;
  }
  db.prepare(
    `INSERT INTO assets(asset_pda,provider,asset_id,version,title,tags,teaser,body,license,content_hash,license_hash,price,active,finalized_slot)
     VALUES(@asset_pda,@provider,@asset_id,@version,@title,@tags,@teaser,@body,@license,@content_hash,@license_hash,@price,0,NULL)`,
  ).run(a);
}

/** Mark chain-verified state (called only after a finalized on-chain match). */
export function markFinalized(db: Db, assetPda: string, active: boolean, slot: number) {
  db.prepare("UPDATE assets SET active=?, finalized_slot=? WHERE asset_pda=?").run(active ? 1 : 0, slot, assetPda);
}

const tokenize = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

export interface SearchItem {
  assetId: string;
  assetPda: string;
  provider: string;
  version: number;
  title: string;
  tags: string[];
  teaser: string;
  price: string;
  contentHash: string;
  licenseHash: string;
  score: number;
}

/**
 * Metadata-only search over finalized active assets: exact lowercase token overlap
 * against title+tags, score desc then title. `gap` is true when the required tag is
 * not present on any active asset. Never returns body or license bytes.
 */
export function search(db: Db, q: string, requiredTag?: string, limit = 10) {
  const qt = tokenize(q);
  const rows = db
    .prepare(
      "SELECT asset_pda,provider,asset_id,version,title,tags,teaser,price,content_hash,license_hash FROM assets WHERE active=1 AND finalized_slot IS NOT NULL",
    )
    .all() as Omit<AssetRow, "body" | "license">[];
  const req = requiredTag?.toLowerCase().trim();
  const items: SearchItem[] = [];
  let gap = false;
  if (req && !rows.some((r) => tokenize(r.tags).has(req))) gap = true;
  for (const r of rows) {
    const tags = tokenize(r.tags);
    if (req && !tags.has(req)) continue;
    const words = new Set([...tokenize(r.title), ...tags]);
    const score = [...qt].filter((t) => words.has(t)).length;
    if (score === 0) continue;
    items.push({
      assetId: r.asset_id,
      assetPda: r.asset_pda,
      provider: r.provider,
      version: r.version,
      title: r.title,
      tags: r.tags.split(/\s+/),
      teaser: r.teaser,
      price: r.price,
      contentHash: r.content_hash,
      licenseHash: r.license_hash,
      score,
    });
  }
  items.sort((a, b) => b.score - a.score || a.assetId.localeCompare(b.assetId));
  return { items: items.slice(0, limit), gap };
}
