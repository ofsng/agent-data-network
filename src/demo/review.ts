// Local trusted bounty validator (DATA-TRUST-SPEC "Bounty review"). Runs on the
// requester side, reads the private submitted bytes and the private fixture
// expectation, and returns only boolean checks plus bounded metadata — never the
// body, the answer or any snippet. It is not an oracle and the program cannot
// enforce it; a direct signer could bypass it.
import { PublicKey } from "@solana/web3.js";
import { pda, toHex } from "../chain/adn";
import { AssetRow, sha256hex } from "../data/store";
import { Service } from "../api/service";

export interface ReviewReport {
  bountyPda: string;
  submissionPda: string;
  assetPda: string;
  requirementHash: string;
  contentHash: string;
  licenseHash: string;
  checks: { schema: boolean; field: boolean; valueMatch: boolean; provenance: boolean; integrity: boolean; license: boolean; binding: boolean };
  passed: boolean;
  preview: { equipment: string | null; field: string; schemaId: string | null; sourceLabel: string | null; observedAt: number | null; byteLength: number };
  reviewedAt: string;
}

export async function reviewSubmission(
  svc: Service,
  bountyPda: string,
  assetPda: string,
  provider: string,
  requirement: { equipment: string; field: string },
  expectedValue: string,
  expectedLicenseHash: string,
): Promise<ReviewReport> {
  const bounty = new PublicKey(bountyPda);
  const asset = new PublicKey(assetPda);
  const submissionPda = pda.submission(bounty, new PublicKey(provider), asset).toBase58();
  const [b, sub, a] = await Promise.all([
    svc.program.account.bounty.fetch(bounty, "finalized"),
    svc.program.account.submission.fetchNullable(submissionPda, "finalized"),
    svc.program.account.dataAsset.fetch(asset, "finalized"),
  ]);
  const row = svc.db.prepare("SELECT * FROM assets WHERE asset_pda=?").get(assetPda) as AssetRow | undefined;
  const trust = svc.db.prepare("SELECT * FROM asset_trust WHERE asset_pda=?").get(assetPda) as any;
  let parsed: any = null;
  try {
    parsed = row ? JSON.parse(row.body.toString("utf8")) : null;
  } catch {}
  const keys = parsed && typeof parsed === "object" ? Object.keys(parsed).sort().join(",") : "";
  const checks = {
    schema: trust?.schema_id === "BOUNTY_JSON_V2" && keys === `equipment,${requirement.field}`,
    field: !!parsed && parsed.equipment === requirement.equipment && typeof parsed[requirement.field] === "string" && parsed[requirement.field].length > 0,
    valueMatch: !!parsed && parsed[requirement.field] === expectedValue,
    provenance: !!trust && trust.rights_declared === 1 && trust.validation_status === "VALID" && !!trust.source_label,
    integrity: !!row && sha256hex(row.body) === toHex(a.contentHash) && row.content_hash === toHex(a.contentHash) && sha256hex(row.license) === toHex(a.licenseHash),
    license: toHex(a.licenseHash) === expectedLicenseHash,
    binding: !!sub && sub.bounty.equals(bounty) && sub.asset.equals(asset) && sub.provider.equals(a.provider) && b.status === 0 && !a.active,
  };
  return {
    bountyPda, submissionPda, assetPda,
    requirementHash: toHex(b.requirementHash), contentHash: toHex(a.contentHash), licenseHash: toHex(a.licenseHash),
    checks, passed: Object.values(checks).every(Boolean),
    preview: {
      equipment: parsed?.equipment === requirement.equipment ? requirement.equipment : null,
      field: requirement.field,
      schemaId: trust?.schema_id ?? null,
      sourceLabel: trust?.source_label ?? null,
      observedAt: trust?.observed_at ?? null,
      byteLength: row?.body.length ?? 0,
    },
    reviewedAt: new Date().toISOString(),
  };
}
