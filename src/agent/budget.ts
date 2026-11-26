// Durable per-run spend guard (agent_runs + spend_reservations). Reservations are
// written before signing; signed/pending/unknown spends keep counting against the
// cap; only proven not-landed intents release tokens. No automatic replenishment.
import { createHash } from "crypto";
import { Db, canonicalJson } from "../data/store";

export interface Policy {
  runId: string;
  role: string;
  buyer: string;
  tokenCap: bigint;
  solCap: bigint;
  maxBounties: number;
  expiresAt: number;
}

export class BudgetError extends Error {}

type State = "RESERVED" | "PENDING" | "UNKNOWN" | "FINALIZED" | "NOT_LANDED";
const now = () => Math.floor(Date.now() / 1000);

export class RunBudget {
  constructor(private db: Db, public policy: Policy) {
    const p = { ...policy, tokenCap: policy.tokenCap.toString(), solCap: policy.solCap.toString() };
    const hash = createHash("sha256").update(canonicalJson(p)).digest("hex");
    const existing = db.prepare("SELECT policy_hash FROM agent_runs WHERE run_id=?").get(policy.runId) as { policy_hash: string } | undefined;
    if (existing && existing.policy_hash !== hash) throw new BudgetError("policy for this run cannot change (no cap expansion)");
    if (!existing)
      db.prepare("INSERT INTO agent_runs(run_id,policy_hash,buyer,token_cap,sol_cap,expires_at,created_at) VALUES(?,?,?,?,?,?,?)").run(
        policy.runId, hash, policy.buyer, p.tokenCap, p.solCap, policy.expiresAt, now(),
      );
  }

  /** Atomically reserve; rejects duplicates, cap overflow, extra bounties, expired runs. */
  reserve(intentId: string, kind: "PURCHASE" | "BOUNTY", tokens: bigint, lamports: bigint) {
    return this.db.transaction(() => {
      if (now() > this.policy.expiresAt) throw new BudgetError("run policy expired");
      if (this.db.prepare("SELECT 1 FROM spend_reservations WHERE intent_id=?").get(intentId)) throw new BudgetError(`duplicate intent ${intentId}`);
      const rows = this.rows().filter((r) => r.state !== "NOT_LANDED");
      const t = rows.reduce((s, r) => s + BigInt(r.token_reserved), 0n);
      const l = rows.reduce((s, r) => s + BigInt(r.sol_reserved), 0n);
      if (kind === "BOUNTY" && rows.filter((r) => r.kind === "BOUNTY").length >= this.policy.maxBounties)
        throw new BudgetError(`BUDGET: at most ${this.policy.maxBounties} bounty per run`);
      if (t + tokens > this.policy.tokenCap)
        throw new BudgetError(`BUDGET: needs ${tokens} aUSD base units, ${this.policy.tokenCap - t} of ${this.policy.tokenCap} remaining`);
      if (l + lamports > this.policy.solCap)
        throw new BudgetError(`BUDGET: needs ${lamports} lamports, ${this.policy.solCap - l} remaining`);
      this.db
        .prepare("INSERT INTO spend_reservations(run_id,intent_id,kind,token_reserved,sol_reserved,state,created_at,updated_at) VALUES(?,?,?,?,?,'RESERVED',?,?)")
        .run(this.policy.runId, intentId, kind, tokens.toString(), lamports.toString(), now(), now());
    })();
  }

  mark(intentId: string, state: State, extra: { signature?: string; solActual?: bigint } = {}) {
    const cur = this.db.prepare("SELECT state FROM spend_reservations WHERE intent_id=? AND run_id=?").get(intentId, this.policy.runId) as { state: State } | undefined;
    if (!cur) throw new BudgetError(`unknown intent ${intentId}`);
    if (cur.state === "FINALIZED" || cur.state === "NOT_LANDED") throw new BudgetError(`intent ${intentId} already terminal`);
    this.db
      .prepare("UPDATE spend_reservations SET state=?, tx_signature=COALESCE(?,tx_signature), sol_actual=COALESCE(?,sol_actual), updated_at=? WHERE intent_id=?")
      .run(state, extra.signature ?? null, extra.solActual?.toString() ?? null, now(), intentId);
  }

  rows() {
    return this.db.prepare("SELECT * FROM spend_reservations WHERE run_id=? ORDER BY created_at").all(this.policy.runId) as {
      intent_id: string; kind: string; token_reserved: string; sol_reserved: string; sol_actual: string | null; state: State; tx_signature: string | null;
    }[];
  }

  summary() {
    const rows = this.rows();
    const live = rows.filter((r) => r.state !== "NOT_LANDED");
    const committed = live.reduce((s, r) => s + BigInt(r.token_reserved), 0n);
    const spent = rows.filter((r) => r.state === "FINALIZED").reduce((s, r) => s + BigInt(r.token_reserved), 0n);
    return {
      role: this.policy.role,
      buyer: this.policy.buyer,
      tokenCap: this.policy.tokenCap.toString(),
      tokensCommitted: committed.toString(),
      tokensSpent: spent.toString(),
      tokensRemaining: (this.policy.tokenCap - committed).toString(),
      solCapLamports: this.policy.solCap.toString(),
      solReservedLamports: live.reduce((s, r) => s + BigInt(r.sol_reserved), 0n).toString(),
      solActualLamports: rows.reduce((s, r) => s + BigInt(r.sol_actual ?? "0"), 0n).toString(),
      maxBounties: this.policy.maxBounties,
      intents: rows.map((r) => ({ intentId: r.intent_id, kind: r.kind, tokens: r.token_reserved, state: r.state, signature: r.tx_signature })),
    };
  }
}
