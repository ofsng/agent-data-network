// Data Trust Layer (off-chain, self-declared): input validation, trust sidecar,
// per-asset verified snapshots and exact-byte recovery. Integrity = hashes match;
// schema = required shape; accuracy is always UNVERIFIED. Source/rights are
// provider declarations, not ownership proof and not committed by the content hash.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Db, sha256hex } from "./store";

export type SchemaId = "TEXT_V1" | "BOUNTY_JSON_V2";
export const MAX_BODY_BYTES = 65536;

export interface TrustDeclaration {
  sourceLabel: string;
  observedAt: number;
  rightsDeclared: boolean;
  schemaId: SchemaId;
}

export interface TrustView {
  sourceLabel: string;
  sourceKind: "provider-declared";
  observedAt: number;
  ageSeconds: number;
  rightsDeclared: boolean;
  schemaId: SchemaId;
  validationStatus: "VALID" | "INVALID";
  accuracyStatus: "UNVERIFIED";
  synthetic: true;
  snapshot: "VERIFIED" | "MISSING" | "MISMATCH";
  /** First finalized listing of these exact bytes. A later listing of the same content
   *  hash by a different provider is a copy: it is shown but never quoted. */
  provenance: { original: boolean; firstProvider: string; firstAssetPda: string; firstSlot: number };
}

export class TrustError extends Error {
  constructor(public code: string, msg: string) {
    super(msg);
  }
}

const now = () => Math.floor(Date.now() / 1000);

/** Validates bytes + declaration before anything is stored or published. */
export function validateUnit(
  body: Buffer,
  license: Buffer,
  meta: { title: string; tags: string; teaser: string },
  decl: Partial<TrustDeclaration>,
) {
  const dec = new TextDecoder("utf-8", { fatal: true });
  for (const [name, b] of [["body", body], ["license", license]] as const) {
    if (b.length < 1 || b.length > MAX_BODY_BYTES) throw new TrustError("SIZE", `${name} must be 1–${MAX_BODY_BYTES} bytes`);
    let s: string;
    try {
      s = dec.decode(b);
    } catch {
      throw new TrustError("UTF8", `${name} is not valid UTF-8`);
    }
    if (s !== s.normalize("NFC") || s.includes("\r\n")) throw new TrustError("CANONICAL", `${name} is not NFC/LF canonical`);
  }
  const plain = /^[\p{L}\p{N} .,;:%()\-–/'&]+$/u;
  if (!meta.title || meta.title.length > 120 || !plain.test(meta.title)) throw new TrustError("TITLE", "title must be 1–120 plain characters");
  if (!meta.tags || meta.tags.length > 120 || !/^[a-z0-9 ]+$/.test(meta.tags)) throw new TrustError("TAGS", "tags must be lowercase words");
  if (!meta.teaser || meta.teaser.length > 160 || !plain.test(meta.teaser)) throw new TrustError("TEASER", "teaser must be 1–160 plain characters");
  if (!decl.sourceLabel || decl.sourceLabel.length > 128) throw new TrustError("SOURCE", "source declaration required (≤128 chars)");
  if (!decl.rightsDeclared) throw new TrustError("RIGHTS", "rights declaration required");
  if (!Number.isInteger(decl.observedAt) || decl.observedAt! <= 0 || decl.observedAt! > now() + 60)
    throw new TrustError("TIMESTAMP", "observedAt must be a positive Unix time not in the future");
  if (decl.schemaId === "TEXT_V1") {
    if (!body.toString("utf8").trim()) throw new TrustError("SCHEMA", "TEXT_V1 body must be non-empty");
  } else if (decl.schemaId === "BOUNTY_JSON_V2") {
    let o: any;
    try {
      o = JSON.parse(body.toString("utf8"));
    } catch {
      throw new TrustError("SCHEMA", "BOUNTY_JSON_V2 body must be JSON");
    }
    const keys = o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o).sort() : [];
    if (keys.join(",") !== "equipment,recycling_certificate" || keys.some((k) => typeof o[k] !== "string" || !o[k]))
      throw new TrustError("SCHEMA", "BOUNTY_JSON_V2 requires exactly {equipment, recycling_certificate} strings");
  } else throw new TrustError("SCHEMA", "unknown schema");
  return decl as TrustDeclaration;
}

export function putTrust(db: Db, assetPda: string, d: TrustDeclaration) {
  db.prepare(
    `INSERT INTO asset_trust(asset_pda,source_label,observed_at,rights_declared,schema_id,validation_status,accuracy_status,synthetic)
     VALUES(?,?,?,1,?,'VALID','UNVERIFIED',1) ON CONFLICT(asset_pda) DO NOTHING`,
  ).run(assetPda, d.sourceLabel, d.observedAt, d.schemaId);
}

// ---------- snapshots: private, hash-checked, atomic, outside the repo ----------
export function snapshotDir(cluster: string) {
  const dir = process.env.ADN_SNAPSHOT_DIR ?? join(homedir(), ".config/adn-demo/snapshots", cluster);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  return dir;
}

interface Snapshot {
  assetPda: string;
  contentHash: string;
  licenseHash: string;
  body: string;
  license: string;
}

export function writeSnapshot(dir: string, assetPda: string, body: Buffer, license: Buffer) {
  const file = join(dir, `${assetPda}.json`);
  const snap: Snapshot = {
    assetPda,
    contentHash: sha256hex(body),
    licenseHash: sha256hex(license),
    body: body.toString("base64"),
    license: license.toString("base64"),
  };
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(snap), { mode: 0o600 });
  renameSync(tmp, file);
  if (readSnapshot(dir, assetPda, snap.contentHash, snap.licenseHash) === null) throw new TrustError("SNAPSHOT", "snapshot verify failed");
}

/** Returns exact bytes only if identity and both hashes match the expectation. */
export function readSnapshot(dir: string, assetPda: string, contentHash: string, licenseHash: string) {
  const file = join(dir, `${assetPda}.json`);
  if (!existsSync(file)) return null;
  try {
    const s = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
    const body = Buffer.from(s.body, "base64");
    const license = Buffer.from(s.license, "base64");
    if (s.assetPda !== assetPda || sha256hex(body) !== contentHash || sha256hex(license) !== licenseHash) return null;
    return { body, license };
  } catch {
    return null;
  }
}

export function snapshotStatus(dir: string, assetPda: string, contentHash: string, licenseHash: string): TrustView["snapshot"] {
  if (!existsSync(join(dir, `${assetPda}.json`))) return "MISSING";
  return readSnapshot(dir, assetPda, contentHash, licenseHash) ? "VERIFIED" : "MISMATCH";
}

/** Repair only the affected asset row from a verified snapshot (no DB replacement). */
export function restoreFromSnapshot(db: Db, dir: string, assetPda: string, contentHash: string, licenseHash: string) {
  const snap = readSnapshot(dir, assetPda, contentHash, licenseHash);
  if (!snap) return false;
  const u = db
    .prepare("UPDATE assets SET body=?, license=? WHERE asset_pda=? AND content_hash=? AND license_hash=?")
    .run(snap.body, snap.license, assetPda, contentHash, licenseHash);
  return u.changes === 1;
}

export function trustView(db: Db, dir: string, assetPda: string): TrustView | null {
  const t = db.prepare("SELECT * FROM asset_trust WHERE asset_pda=?").get(assetPda) as any;
  const a = db.prepare("SELECT content_hash, license_hash, provider FROM assets WHERE asset_pda=?").get(assetPda) as any;
  if (!t || !a) return null;
  const first = db.prepare("SELECT asset_pda, provider, finalized_slot FROM assets WHERE content_hash=? AND finalized_slot IS NOT NULL ORDER BY finalized_slot, asset_pda LIMIT 1").get(a.content_hash) as any;
  return {
    sourceLabel: t.source_label,
    sourceKind: "provider-declared",
    observedAt: t.observed_at,
    ageSeconds: Math.max(0, now() - t.observed_at),
    rightsDeclared: t.rights_declared === 1,
    schemaId: t.schema_id,
    validationStatus: t.validation_status,
    accuracyStatus: "UNVERIFIED",
    synthetic: true,
    snapshot: snapshotStatus(dir, assetPda, a.content_hash, a.license_hash),
    provenance: first
      ? { original: first.provider === a.provider, firstProvider: first.provider, firstAssetPda: first.asset_pda, firstSlot: first.finalized_slot }
      : { original: true, firstProvider: a.provider, firstAssetPda: assetPda, firstSlot: 0 },
  };
}
