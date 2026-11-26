// Agent account for an MCP agent wallet on this machine: allowances a human approved,
// requests the agent made to the human, and an activity feed the web UI shows.
// Each allowance is its own fixed RunBudget, so a cap can never grow in place; more
// budget means a new, human-approved allowance. Spend from earlier allowances stays counted.
import { randomBytes } from "crypto";
import { Db } from "../data/store";
import { RunBudget } from "./budget";

export const DEFAULT_ALLOWANCE = 500_000n; // 0.5 aUSD
export const DEFAULT_APPROVE_ABOVE = 100_000n; // purchases above 0.1 aUSD need a human OK
const SOL_PER_ALLOWANCE = 50_000_000n; // 0.05 SOL for fees and receipt deposits
const now = () => Math.floor(Date.now() / 1000);

export const fmtAUSD = (base: bigint | string) => `${(Number(base) / 1e6).toFixed(6).replace(/\.?0+$/, "")} aUSD`;
export function parseAUSD(v: string): bigint {
  const m = /^(\d{1,9})(?:\.(\d{1,6}))?$/.exec(String(v).trim());
  if (!m) throw Object.assign(new Error(`not an aUSD amount: ${v} (use e.g. "0.25")`), { code: "INVALID" });
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
}

export interface Grant { id: number; cap: bigint; approveAbove: bigint; source: string; createdAt: number }
export interface AgentRequest {
  id: string; kind: "PURCHASE" | "BUDGET"; amount: string; summary: string; payload: any;
  status: "PENDING" | "APPROVED" | "DECLINED" | "USED"; createdAt: number; decidedAt: number | null; decidedBy: string | null;
}

export class AgentAccount {
  constructor(private db: Db, public cluster: string, public buyer: string) {}

  grants(): Grant[] {
    return (this.db.prepare("SELECT * FROM agent_grants WHERE cluster=? AND buyer=? ORDER BY id").all(this.cluster, this.buyer) as any[])
      .map((g) => ({ id: g.id, cap: BigInt(g.cap), approveAbove: BigInt(g.approve_above), source: g.source, createdAt: g.created_at }));
  }
  active(): Grant | null {
    const g = this.grants();
    return g[g.length - 1] ?? null;
  }
  addGrant(cap: bigint, source: string, approveAbove = this.active()?.approveAbove ?? DEFAULT_APPROVE_ABOVE): Grant {
    if (cap <= 0n || cap > 100_000_000n) throw Object.assign(new Error("allowance must be between 0 and 100 aUSD"), { code: "INVALID" });
    this.db.prepare("INSERT INTO agent_grants(cluster,buyer,cap,approve_above,source,created_at) VALUES(?,?,?,?,?,?)")
      .run(this.cluster, this.buyer, cap.toString(), approveAbove.toString(), source, now());
    this.log("allowance", `${source === "setup" ? "Starting" : "New"} allowance ${fmtAUSD(cap)} approved (${source})`, true);
    return this.active()!;
  }

  private budgetFor(g: Grant) {
    return new RunBudget(this.db, {
      runId: `mcp:${this.cluster}:${this.buyer}:g${g.id}`, role: "mcpAgent", buyer: this.buyer,
      tokenCap: g.cap, solCap: SOL_PER_ALLOWANCE, maxBounties: 0, expiresAt: 4_102_444_800,
    });
  }
  /** Budget of the active allowance, or null when no human has approved one yet. */
  budget(): RunBudget | null {
    const g = this.active();
    return g ? this.budgetFor(g) : null;
  }
  totals() {
    const sums = this.grants().map((g) => this.budgetFor(g).summary());
    const spent = sums.reduce((s, b) => s + BigInt(b.tokensSpent), 0n);
    const allowed = this.grants().reduce((s, g) => s + g.cap, 0n);
    const remaining = sums.length ? BigInt(sums[sums.length - 1].tokensRemaining) : 0n;
    return { allowed, spent, remaining, approveAbove: this.active()?.approveAbove ?? DEFAULT_APPROVE_ABOVE, purchases: sums.flatMap((b) => b.intents) };
  }

  request(kind: AgentRequest["kind"], amount: bigint, summary: string, payload: unknown, status: AgentRequest["status"] = "PENDING", by?: string): AgentRequest {
    const id = `req_${randomBytes(6).toString("hex")}`;
    this.db.prepare("INSERT INTO agent_requests(id,cluster,buyer,kind,amount,summary,payload,status,created_at,decided_at,decided_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, this.cluster, this.buyer, kind, amount.toString(), summary, JSON.stringify(payload), status, now(), status === "PENDING" ? null : now(), by ?? null);
    return this.get(id)!;
  }
  get(id: string): AgentRequest | null {
    const r = this.db.prepare("SELECT * FROM agent_requests WHERE id=? AND cluster=? AND buyer=?").get(id, this.cluster, this.buyer) as any;
    return r ? AgentAccount.row(r) : null;
  }
  pending(): AgentRequest[] {
    return (this.db.prepare("SELECT * FROM agent_requests WHERE cluster=? AND buyer=? AND status='PENDING' ORDER BY created_at").all(this.cluster, this.buyer) as any[]).map(AgentAccount.row);
  }
  recentRequests(limit = 10): AgentRequest[] {
    return (this.db.prepare("SELECT * FROM agent_requests WHERE cluster=? AND buyer=? ORDER BY created_at DESC LIMIT ?").all(this.cluster, this.buyer, limit) as any[]).map(AgentAccount.row);
  }
  /** A human's decision. Approving a budget request adds the allowance right away. */
  decide(id: string, approve: boolean, by: string): AgentRequest {
    return this.db.transaction(() => {
      const r = this.get(id);
      if (!r) throw Object.assign(new Error("request not found"), { code: "NOT_FOUND", status: 404 });
      if (r.status !== "PENDING") throw Object.assign(new Error(`request already ${r.status.toLowerCase()}`), { code: "CONFLICT", status: 409 });
      this.db.prepare("UPDATE agent_requests SET status=?, decided_at=?, decided_by=? WHERE id=?").run(approve ? "APPROVED" : "DECLINED", now(), by, id);
      if (approve && r.kind === "BUDGET") this.addGrant(BigInt(r.amount), `human:${by}`);
      this.log("approval", `${approve ? "Approved" : "Declined"} by ${by}: ${r.summary}`, approve);
      return this.get(id)!;
    })();
  }
  use(id: string) {
    this.db.prepare("UPDATE agent_requests SET status='USED' WHERE id=? AND status='APPROVED'").run(id);
  }

  log(tool: string, summary: string, ok: boolean, ref?: string) {
    this.db.prepare("INSERT INTO agent_activity(cluster,buyer,at,tool,summary,ok,ref) VALUES(?,?,?,?,?,?,?)")
      .run(this.cluster, this.buyer, now(), tool, summary.slice(0, 300), ok ? 1 : 0, ref ?? null);
  }
  activity(limit = 30) {
    return this.db.prepare("SELECT at, tool, summary, ok, ref FROM agent_activity WHERE cluster=? AND buyer=? ORDER BY id DESC LIMIT ?").all(this.cluster, this.buyer, limit) as
      { at: number; tool: string; summary: string; ok: number; ref: string | null }[];
  }

  static row(r: any): AgentRequest {
    return { id: r.id, kind: r.kind, amount: r.amount, summary: r.summary, payload: JSON.parse(r.payload), status: r.status, createdAt: r.created_at, decidedAt: r.decided_at, decidedBy: r.decided_by };
  }
  /** Agent wallets on this cluster that have an allowance or have asked for one. */
  static list(db: Db, cluster: string): string[] {
    return (db.prepare("SELECT buyer FROM agent_grants WHERE cluster=? UNION SELECT buyer FROM agent_requests WHERE cluster=? UNION SELECT buyer FROM agent_activity WHERE cluster=?").all(cluster, cluster, cluster) as { buyer: string }[]).map((r) => r.buyer);
  }
}
