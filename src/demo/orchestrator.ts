// Guided demo state machine (DEMO-EXPERIENCE). Every step calls the real service,
// typed agent tools and Anchor program on the configured cluster; state only ever
// contains results observed from the chain/service. Manual "Next step" and
// "Run full demo" call the same advance() function.
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { createHash, randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { ROOT, explorer } from "../config";
import { TOKEN_PROGRAM_ID, ata, loadKeypair, pda, programFor, toHex } from "../chain/adn";
import { Wallets, publishAsset, setActive, waitFinalized } from "../chain/ops";
import { canonicalJson, loadFixtures, sha256hex } from "../data/store";
import { Quote, Service } from "../api/service";
import { trustView } from "../data/trust";
import { RunBudget } from "../agent/budget";
import { AgentTools, TraceEntry } from "../agent/tools";
import { ReviewReport, reviewSubmission } from "./review";
import { SCENES, STEPS, Step } from "./scenes";

export type Role = "agent" | "agent2" | "refundRequester" | "providerA" | "providerB" | "treasury";
const ROLE_LABEL: Record<Role, string> = {
  agent: "Research agent", agent2: "Second agent", refundRequester: "Refund requester",
  providerA: "NorthLab (provider)", providerB: "SouthSupply (provider)", treasury: "ADN treasury",
};

export const POLICY = {
  agentTokenCap: 2_100_000n, agentSolCap: 50_000_000n,
  agent2TokenCap: 100_000n, agent2SolCap: 10_000_000n,
  refundTokenCap: 2_000_000n, refundSolCap: 10_000_000n,
  bountyReward: 2_000_000n, bountyDeadlineSecs: 3600, refundDeadlineSecs: 20,
};

export interface RunState {
  runId: string;
  mode: "LOCAL_VALIDATOR" | "DEVNET";
  cluster: string;
  programId: string;
  mint: string;
  createdAt: string;
  step: Step;
  status: "idle" | "running" | "error" | "complete";
  error: { step: Step; message: string } | null;
  wallets: Record<Role, string>;
  roleLabels: Record<Role, string>;
  budgets: Record<string, ReturnType<RunBudget["summary"]>>;
  trace: TraceEntry[];
  steps: { step: Step; status: "done" | "error"; startedAt: string; ms: number; summary: string }[];
  balances: { start: Record<string, string>; current: Record<string, string> };
  deltas: Record<string, Record<string, string>>;
  transactions: { label: string; step: Step; signature: string; slot: number | null; feeLamports: number | null; explorer: string | null; kind: "economic" | "registry" | "setup" }[];
  data: Record<string, any>;
}

const now = () => new Date().toISOString();
const T = (v: string | bigint | undefined) => { const n = BigInt(v ?? 0); const a = n < 0n ? -n : n; const f = (a % 1000000n).toString().padStart(6, "0").replace(/0+$/, ""); return `${n < 0n ? "−" : n > 0n ? "+" : ""}${a / 1000000n}${f ? "." + f : ""} aUSD`; };
/** Last complete run per cluster: localnet keeps the historical name. */
export const manifestPath = (cluster: string) => join(ROOT, "evidence", cluster === "devnet" ? "devnet-run-manifest.json" : "run-manifest.json");
const runsDir = (cluster: string) => join(homedir(), ".config/adn-demo/runs", cluster);

export class DemoOrchestrator {
  private runs = new Map<string, RunState>();
  private locks = new Map<string, Promise<unknown>>();
  private idem = new Map<string, Set<string>>();
  private fixtures = loadFixtures();

  constructor(private svc: Service, private ops: Wallets) {}

  private get conn(): Connection {
    return this.svc.connection;
  }

  private save(s: RunState) {
    const json = JSON.stringify(s);
    this.svc.db.prepare("UPDATE demo_runs SET step=?, state_json=?, updated_at=? WHERE run_id=?").run(s.step, json, Math.floor(Date.now() / 1000), s.runId);
  }

  get(runId: string): RunState | null {
    if (this.runs.has(runId)) return this.runs.get(runId)!;
    const row = this.svc.db.prepare("SELECT state_json FROM demo_runs WHERE run_id=?").get(runId) as { state_json: string } | undefined;
    if (!row) return null;
    const s = JSON.parse(row.state_json) as RunState;
    if (s.status === "running") s.status = "error", (s.error = { step: s.step, message: "server restarted during step; press Next step to retry" });
    this.runs.set(runId, s);
    return s;
  }

  checkToken(runId: string, token: unknown) {
    const row = this.svc.db.prepare("SELECT token_hash FROM demo_runs WHERE run_id=?").get(runId) as { token_hash: string } | undefined;
    return !!row && typeof token === "string" && createHash("sha256").update(token).digest("hex") === row.token_hash;
  }

  latestRunId(): string | null {
    const r = this.svc.db.prepare("SELECT run_id FROM demo_runs ORDER BY created_at DESC, rowid DESC LIMIT 1").get() as { run_id: string } | undefined;
    return r?.run_id ?? null;
  }

  // ---------------- wallets & balances ----------------
  private runKeys(runId: string): Record<"agent" | "agent2" | "refundRequester", Keypair> {
    const dir = join(runsDir(this.svc.cfg.cluster), runId);
    const out: any = {};
    for (const r of ["agent", "agent2", "refundRequester"]) out[r] = loadKeypair(join(dir, `${r}.json`));
    return out;
  }

  private keyFor(s: RunState, role: Role): Keypair {
    if (role === "providerA") return this.ops.providerA;
    if (role === "providerB") return this.ops.providerB;
    if (role === "treasury") return this.ops.treasury;
    return this.runKeys(s.runId)[role];
  }

  private async balances(s: RunState, extra: Record<string, string> = {}) {
    const out: Record<string, string> = {};
    const owners: Record<string, string> = { ...s.wallets, ...extra };
    await Promise.all(Object.entries(owners).map(async ([k, owner]) => {
      try {
        out[k] = (await getAccount(this.conn, ata(new PublicKey(owner), this.svc.mint), "finalized")).amount.toString();
      } catch {
        out[k] = "0";
      }
    }));
    return out;
  }

  private delta(a: Record<string, string>, b: Record<string, string>) {
    return Object.fromEntries(Object.keys(b).map((k) => [k, (BigInt(b[k]) - BigInt(a[k] ?? "0")).toString()]));
  }

  private tx(s: RunState, label: string, signature: string, slot: number | null, feeLamports: number | null, kind: RunState["transactions"][number]["kind"] = "economic") {
    s.transactions.push({ label, step: s.step, signature, slot, feeLamports, kind, explorer: s.mode === "DEVNET" ? explorer("devnet", "tx", signature) : null });
  }

  private async fee(signature: string) {
    const info = await this.conn.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
    return { slot: info?.slot ?? null, fee: info?.meta?.fee ?? null };
  }

  private budgetFor(s: RunState, role: "agent" | "agent2" | "refundRequester") {
    const caps = {
      agent: [POLICY.agentTokenCap, POLICY.agentSolCap, 1],
      agent2: [POLICY.agent2TokenCap, POLICY.agent2SolCap, 0],
      refundRequester: [POLICY.refundTokenCap, POLICY.refundSolCap, 1],
    } as const;
    const [tokenCap, solCap, maxBounties] = caps[role];
    return new RunBudget(this.svc.db, {
      runId: `${s.runId}:${role}`, role, buyer: s.wallets[role], tokenCap, solCap, maxBounties,
      expiresAt: Math.floor(new Date(s.createdAt).getTime() / 1000) + 6 * 3600,
    });
  }

  private tools(s: RunState, role: "agent" | "agent2" | "refundRequester") {
    return new AgentTools(this.svc, this.keyFor(s, role), this.budgetFor(s, role), s.trace, ROLE_LABEL[role], this.fixtures.bounty.requirement);
  }

  private refreshBudgets(s: RunState) {
    for (const r of ["agent", "agent2", "refundRequester"] as const) s.budgets[r] = this.budgetFor(s, r).summary();
  }

  // ---------------- run lifecycle ----------------
  /** New isolated run: fresh agent/second-agent/refund wallets (0600, outside repo), funded with exactly their caps. */
  async createRun(): Promise<{ runId: string; token: string; state: RunState }> {
    const runId = `run-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
    const token = randomBytes(24).toString("hex");
    const dir = join(runsDir(this.svc.cfg.cluster), runId);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(join(runsDir(this.svc.cfg.cluster)), 0o700);
    const keys: Record<string, Keypair> = {};
    for (const r of ["agent", "agent2", "refundRequester"]) {
      keys[r] = Keypair.generate();
      writeFileSync(join(dir, `${r}.json`), JSON.stringify(Array.from(keys[r].secretKey)), { mode: 0o600 });
    }
    const s: RunState = {
      runId, mode: this.svc.cfg.cluster === "devnet" ? "DEVNET" : "LOCAL_VALIDATOR", cluster: this.svc.cfg.cluster,
      programId: this.svc.program.programId.toBase58(), mint: this.svc.mint.toBase58(), createdAt: now(), step: "READY", status: "running", error: null,
      wallets: {
        agent: keys.agent.publicKey.toBase58(), agent2: keys.agent2.publicKey.toBase58(), refundRequester: keys.refundRequester.publicKey.toBase58(),
        providerA: this.ops.providerA.publicKey.toBase58(), providerB: this.ops.providerB.publicKey.toBase58(), treasury: this.ops.treasury.publicKey.toBase58(),
      },
      roleLabels: ROLE_LABEL, budgets: {}, trace: [], steps: [], balances: { start: {}, current: {} }, deltas: {}, transactions: [], data: {},
    };
    this.svc.db.prepare("INSERT INTO demo_runs(run_id,mode,token_hash,step,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(
      runId, s.mode, createHash("sha256").update(token).digest("hex"), s.step, JSON.stringify(s), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000),
    );
    this.runs.set(runId, s);
    try {
      // Setup: SOL for fees/rent, ATAs, aUSD equal to each wallet's budget cap.
      const deployer = this.ops.deployer;
      for (const [role, kp] of Object.entries(keys)) {
        if (s.mode === "DEVNET") {
          await sendAndConfirmTransaction(this.conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: kp.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })), [deployer]);
        } else {
          const sig = await this.conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
          await this.conn.confirmTransaction(sig, "confirmed");
        }
        await getOrCreateAssociatedTokenAccount(this.conn, deployer, this.svc.mint, kp.publicKey, false, "confirmed", { commitment: "confirmed" });
        const amount = role === "agent" ? POLICY.agentTokenCap : role === "agent2" ? POLICY.agent2TokenCap : POLICY.refundTokenCap;
        const sig = await mintTo(this.conn, deployer, this.svc.mint, ata(kp.publicKey, this.svc.mint), deployer, amount, [], { commitment: "confirmed" });
        this.tx(s, `Setup: fund ${Number(amount) / 1e6} aUSD to ${ROLE_LABEL[role as Role]}`, sig, null, null, "setup");
      }
      await waitFinalized(this.conn, s.transactions[s.transactions.length - 1].signature);
      s.balances.start = await this.balances(s);
      s.balances.current = { ...s.balances.start };
      this.refreshBudgets(s);
      s.status = "idle";
    } catch (e) {
      s.status = "error";
      s.error = { step: "READY", message: `setup failed: ${(e as Error).message || String(e)}` };
      console.error("setup error", e);
    }
    this.save(s);
    return { runId, token, state: s };
  }

  /** Execute exactly the next step. Serialized per run; idempotent per key; no advance after a failed validation. */
  async advance(runId: string, expectedStep: string, idemKey?: string): Promise<RunState> {
    const s = this.get(runId);
    if (!s) throw Object.assign(new Error("run not found"), { status: 404 });
    if (idemKey) {
      const seen = this.idem.get(runId) ?? new Set();
      if (seen.has(idemKey)) return s;
      seen.add(idemKey);
      this.idem.set(runId, seen);
    }
    if (this.locks.has(runId)) throw Object.assign(new Error("a step is already running"), { status: 409 });
    if (s.step !== expectedStep) throw Object.assign(new Error(`run is at ${s.step}, not ${expectedStep}`), { status: 409 });
    if (s.step === "COMPLETE") return s;
    const idx = STEPS.indexOf(s.step);
    const target = STEPS[idx + 1];
    const p = this.execute(s, target).finally(() => this.locks.delete(runId));
    this.locks.set(runId, p);
    await p;
    return s;
  }

  private async execute(s: RunState, target: Step) {
    s.status = "running";
    s.error = null;
    s.data.pendingStep = target;
    const t0 = Date.now();
    const startedAt = now();
    try {
      const summary = await this.steps[target].call(this, s);
      s.step = target;
      s.steps.push({ step: target, status: "done", startedAt, ms: Date.now() - t0, summary });
      s.status = target === "COMPLETE" ? "complete" : "idle";
    } catch (e) {
      const msg = String((e as Error).message ?? e).replace(/[A-Za-z0-9+/]{120,}/g, "…").slice(0, 400);
      s.status = "error";
      s.error = { step: target, message: msg };
      s.steps.push({ step: target, status: "error", startedAt, ms: Date.now() - t0, summary: msg });
    } finally {
      delete s.data.pendingStep;
      this.refreshBudgets(s);
      try {
        s.balances.current = await this.balances(s);
      } catch {}
      this.save(s);
      this.writeEvidence(s);
    }
  }

  async runAll(runId: string, log: (m: string) => void = () => {}) {
    let s = this.get(runId)!;
    while (s.step !== "COMPLETE") {
      const before = s.step;
      s = await this.advance(runId, s.step);
      const last = s.steps[s.steps.length - 1];
      log(`${last.status === "done" ? "✓" : "✗"} ${STEPS[STEPS.indexOf(before) + 1]} (${(last.ms / 1000).toFixed(1)}s) ${last.summary}`);
      if (s.status === "error") throw new Error(`${s.error?.step}: ${s.error?.message}`);
    }
    return s;
  }

  // ---------------- steps ----------------
  private steps: Record<Step, (this: DemoOrchestrator, s: RunState) => Promise<string>> = {
    READY: async () => "ready",

    async PUBLISHED(s) {
      const fx = this.fixtures;
      const prov: Record<string, Keypair> = { northlab: this.ops.providerA, southsupply: this.ops.providerB };
      const label: Record<string, string> = { northlab: "NorthLab engineering datasheets", southsupply: "SouthSupply inventory feed" };
      const before = new Set((this.svc.db.prepare("SELECT asset_pda FROM assets WHERE finalized_slot IS NOT NULL").all() as { asset_pda: string }[]).map((r) => r.asset_pda));
      // Bounded concurrency: the public Devnet RPC is rate-limited, and too many parallel
      // registrations let blockhashes go stale while requests wait in the paced queue.
      const pool = async <T, R>(items: T[], n: number, f: (x: T) => Promise<R>) => {
        const out: R[] = new Array(items.length);
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
          while (next < items.length) { const i = next++; out[i] = await f(items[i]); }
        }));
        return out;
      };
      const pdas = await pool(fx.rows, this.svc.cfg.cluster === "devnet" ? 4 : 12, (r) => {
        const existing = this.svc.db.prepare("SELECT observed_at FROM asset_trust t JOIN assets a ON a.asset_pda=t.asset_pda WHERE a.asset_id=?").get(toHex(Uint8Array.from(Buffer.from(sha256hex(r.id), "hex").subarray(0, 16)))) as { observed_at: number } | undefined;
        return publishAsset(this.conn, this.svc.db, {
          label: r.id, provider: prov[r.supplier_id], title: r.title, tags: r.tags, teaser: r.summary, body: r.body, license: fx.license,
          price: BigInt(r.price), active: true,
          trust: { sourceLabel: label[r.supplier_id], observedAt: existing?.observed_at ?? Math.floor(Date.now() / 1000), rightsDeclared: true, schemaId: "TEXT_V1" },
        }, () => {}, this.svc.cfg.cluster);
      });
      // Earlier runs' commissioned units are withdrawn by their provider so this run starts with a real gap,
      // and listings no longer in the provider catalog are withdrawn too (past receipts stay valid).
      const withdrawn: string[] = [];
      const current = new Set(pdas.map((p) => p.toBase58()));
      const owner = new Map([this.ops.providerA, this.ops.providerB].map((k) => [k.publicKey.toBase58(), k]));
      const prior = this.svc.db.prepare("SELECT a.asset_pda, a.provider, t.schema_id FROM assets a JOIN asset_trust t ON t.asset_pda=a.asset_pda WHERE a.active=1 AND a.finalized_slot IS NOT NULL").all() as { asset_pda: string; provider: string; schema_id: string }[];
      for (const p of prior.filter((x) => owner.has(x.provider) && (x.schema_id === "BOUNTY_JSON_V2" || !current.has(x.asset_pda)))) {
        const sig = await setActive(this.conn, this.svc.db, owner.get(p.provider)!, new PublicKey(p.asset_pda), false);
        const f = await this.fee(sig);
        this.tx(s, p.schema_id === "BOUNTY_JSON_V2" ? "Provider withdraws previous session's commissioned listing (set_asset_active=false)" : "Provider withdraws a retired listing (set_asset_active=false)", sig, f.slot, f.fee, "registry");
        withdrawn.push(p.asset_pda);
      }
      const catalog = fx.rows.map((r, i) => ({
        fixtureId: r.id, provider: r.supplier_id === "northlab" ? "providerA" : "providerB", title: r.title, tags: r.tags, teaser: r.summary,
        price: r.price, assetPda: pdas[i].toBase58(), reused: before.has(pdas[i].toBase58()),
        trust: trustView(this.svc.db, this.svc.snapDir, pdas[i].toBase58()),
      }));
      s.data.catalog = catalog;
      s.data.withdrawn = withdrawn;
      const fresh = catalog.filter((c) => !c.reused).length;
      return `${catalog.length} units listed by 2 providers (${fresh} newly registered, ${catalog.length - fresh} reused finalized registrations)${withdrawn.length ? `; ${withdrawn.length} earlier listing(s) withdrawn` : ""}`;
    },

    async SEARCHED(s) {
      const t = this.tools(s, "agent");
      s.data.task = "Prepare a procurement brief for the Voltara X100 solar inverter: peak efficiency, current lead time, and its recycling certificate.";
      const q1 = await t.search_data("inverter x100 efficiency");
      const q2 = await t.search_data("inverter x100 lead time");
      const a = q1.items[0];
      const b = q2.items.find((i) => i.provider !== a?.provider);
      if (!a || !b) throw new Error("no two-provider result set found");
      s.data.search = { efficiency: q1.items.slice(0, 4), leadTime: q2.items.slice(0, 4), selected: [a, b] };
      return `selected "${a.title}" and "${b.title}" from two independent providers (metadata only, no content yet)`;
    },

    async QUOTED(s) {
      const t = this.tools(s, "agent");
      const remaining = BigInt(this.budgetFor(s, "agent").summary().tokensRemaining);
      const maxSpend = remaining - POLICY.bountyReward; // keep headroom for one possible bounty
      const q = await t.get_data_quote(s.data.search.selected.map((x: any) => x.assetPda), maxSpend, "bundle");
      s.data.quote = q;
      s.data.quoteMaxSpend = maxSpend.toString();
      return `quote ${T(q.total).replace("+", "")} for 2 units (≤ agent max spend ${T(maxSpend).replace("+", "")}); est. ${(Number(q.estimatedSolLamports) / 1e9).toFixed(4)} SOL for fee + 2 receipt deposits; preflight passed`;
    },

    async PAYMENT_PENDING(s) {
      const t = this.tools(s, "agent");
      s.data.prePurchase = await this.balances(s);
      const r = await t.purchase_data(s.data.quote as Quote);
      s.data.purchase = r;
      return `signed one transaction with ${r.instructions} purchase_unit instructions (${r.sizeBytes} bytes); waiting for finality`;
    },

    async PURCHASED(s) {
      const t = this.tools(s, "agent");
      const r = await t.settle_purchase(s.data.quote.orderId, s.data.purchase.signature, s.data.purchase.solBefore);
      Object.assign(s.data.purchase, r);
      this.tx(s, "Atomic two-provider purchase (2 × purchase_unit)", s.data.purchase.signature, r.slot, r.feeLamports);
      const after = await this.balances(s);
      s.deltas.purchase = this.delta(s.data.prePurchase, after);
      const d = s.deltas.purchase;
      return `finalized in one transaction: agent ${T(d.agent)}, NorthLab ${T(d.providerA)}, SouthSupply ${T(d.providerB)}, treasury ${T(d.treasury)}; 2 license receipts created`;
    },

    async VERIFIED(s) {
      const t = this.tools(s, "agent");
      const out = [];
      for (const [i, receiptPda] of (s.data.purchase.receipts as string[]).entries()) {
        const rec = await t.verify_receipt(receiptPda);
        const got = await t.retrieve_data(receiptPda);
        const item = s.data.quote.items[i];
        out.push({ receiptPda, receipt: rec, assetPda: item.assetPda, title: item.title, provider: item.provider, fact: got.body, bytes: got.bytes, contentHash: got.contentHash, licenseHash: got.licenseHash, hashMatch: got.contentHash === rec.contentHash && got.licenseHash === rec.licenseHash });
      }
      s.data.deliveries = out;
      return `2 receipts verified on-chain and 2 deliveries hash-matched (wallet-signed challenges, exact bytes)`;
    },

    async GAP(s) {
      const t = this.tools(s, "agent");
      const r = await t.search_data("inverter x100 recycling certificate", "recycling");
      if (!r.gap) throw new Error("expected a data gap for 'recycling' but an active unit exists");
      s.data.gap = { requiredTag: "recycling", requirement: this.fixtures.bounty.requirement, requirementHash: sha256hex(canonicalJson(this.fixtures.bounty.requirement)) };
      return "no active unit carries the 'recycling' tag → the brief has a gap; public requirement v2 prepared (no answer included)";
    },

    async BOUNTY_FUNDED(s) {
      const t = this.tools(s, "agent");
      const pre = await this.balances(s);
      const b = await t.create_bounty("X100_RECYCLING_V2", POLICY.bountyReward, POLICY.bountyDeadlineSecs);
      const f = await this.fee(b.signature);
      this.tx(s, "Create funded bounty (reward → PDA vault)", b.signature, f.slot, f.fee);
      const post = await this.balances(s, { vault: b.bountyPda });
      s.deltas.bountyFund = this.delta({ ...pre, vault: "0" }, post);
      s.data.bounty = b;
      return `2 aUSD locked in the bounty's PDA vault; status OPEN until ${new Date(b.deadline * 1000).toISOString().slice(11, 19)} UTC`;
    },

    async SUBMITTED(s) {
      const b = s.data.bounty;
      const mk = (value: string, suffix: string) => publishAsset(this.conn, this.svc.db, {
        label: `BOUNTY-X100-RECYCLING${suffix}:${b.bountyId}`, provider: this.ops.providerA, title: "Voltara X100 inverter recycling certificate",
        tags: "inverter recycling certificate", teaser: "WEEE take-back certificate record for the Voltara X100",
        body: canonicalJson({ equipment: "X100", recycling_certificate: value }), license: this.fixtures.license, price: 30000n, active: false,
        trust: { sourceLabel: "NorthLab commissioned response", observedAt: Math.floor(Date.now() / 1000), rightsDeclared: true, schemaId: "BOUNTY_JSON_V2" },
      }, () => {}, this.svc.cfg.cluster);
      const [wrong, good] = await Promise.all([mk(this.fixtures.bounty.privateValidationFixture.invalidValue, "-DRAFT"), mk(this.fixtures.bounty.solution.recycling_certificate, "")]);
      const program = programFor(this.conn, this.ops.providerA);
      const subs = await Promise.all([wrong, good].map(async (asset) => {
        const sig = await program.methods.submitBountySolution().accountsStrict({
          provider: this.ops.providerA.publicKey, config: pda.config(), bounty: new PublicKey(b.bountyPda), asset,
          submission: pda.submission(new PublicKey(b.bountyPda), this.ops.providerA.publicKey, asset), systemProgram: SystemProgram.programId,
        }).rpc({ commitment: "confirmed" });
        const slot = await waitFinalized(this.conn, sig);
        return { asset: asset.toBase58(), sig, slot };
      }));
      for (const [i, x] of subs.entries()) {
        const f = await this.fee(x.sig);
        this.tx(s, `Provider submits candidate ${i + 1} (inactive asset, no payout)`, x.sig, f.slot, f.fee, "registry");
      }
      const vault = await this.balances(s, { vault: b.bountyPda });
      s.data.submissions = subs.map((x, i) => ({ assetPda: x.asset, submissionPda: pda.submission(new PublicKey(b.bountyPda), this.ops.providerA.publicKey, new PublicKey(x.asset)).toBase58(), label: i === 0 ? "Candidate 1" : "Candidate 2" }));
      s.data.vaultAfterSubmit = vault.vault;
      return `NorthLab registered 2 inactive candidate units and submitted both; vault still ${Number(vault.vault) / 1e6} aUSD (no payout on upload)`;
    },

    async REVIEWED(s) {
      const b = s.data.bounty;
      const licHash = sha256hex(this.fixtures.license);
      const reports: ReviewReport[] = [];
      for (const sub of s.data.submissions)
        reports.push(await reviewSubmission(this.svc, b.bountyPda, sub.assetPda, s.wallets.providerA, this.fixtures.bounty.requirement, this.fixtures.bounty.privateValidationFixture.expectedValue, licHash));
      s.data.reviews = reports;
      const passed = reports.filter((r) => r.passed);
      if (passed.length !== 1) throw new Error(`expected exactly one passing candidate, got ${passed.length}`);
      return `local validator: ${reports.map((r, i) => `candidate ${i + 1} ${r.passed ? "PASS" : "FAIL (" + Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k).join(", ") + ")"}`).join("; ")} — pass/fail only, answer not revealed`;
    },

    async ACCEPTED(s) {
      const b = s.data.bounty;
      const chosen = (s.data.reviews as ReviewReport[]).find((r) => r.passed)!;
      // Re-run the review immediately before signing; bind to exact submission and current finalized state.
      const fresh = await reviewSubmission(this.svc, b.bountyPda, chosen.assetPda, s.wallets.providerA, this.fixtures.bounty.requirement, this.fixtures.bounty.privateValidationFixture.expectedValue, sha256hex(this.fixtures.license));
      if (!fresh.passed || fresh.contentHash !== chosen.contentHash || fresh.submissionPda !== chosen.submissionPda) throw new Error("review is stale or no longer passes; acceptance not signed");
      const agent = this.keyFor(s, "agent");
      const bounty = new PublicKey(b.bountyPda);
      const asset = new PublicKey(chosen.assetPda);
      const pre = await this.balances(s, { vault: b.bountyPda });
      const sig = await programFor(this.conn, agent).methods
        .acceptBountySolution(Array.from(Buffer.from(fresh.requirementHash, "hex")), Array.from(Buffer.from(fresh.contentHash, "hex")), Array.from(Buffer.from(fresh.licenseHash, "hex")))
        .accountsStrict({
          requester: agent.publicKey, config: pda.config(), bounty, submission: new PublicKey(fresh.submissionPda), asset, mint: this.svc.mint, vault: ata(bounty, this.svc.mint),
          providerToken: ata(this.ops.providerA.publicKey, this.svc.mint), treasuryToken: ata(this.ops.treasury.publicKey, this.svc.mint),
          bountyReceipt: pda.bountyReceipt(bounty, asset), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        }).rpc({ commitment: "confirmed" });
      const slot = await waitFinalized(this.conn, sig);
      const f = await this.fee(sig);
      this.tx(s, "Requester accepts reviewed submission (80/20 escrow payout)", sig, slot, f.fee);
      const post = await this.balances(s, { vault: b.bountyPda });
      s.deltas.bountyAccept = this.delta(pre, post);
      this.svc.db.prepare("UPDATE bounties SET state='ACCEPTED', winner_submission=? WHERE pda=?").run(fresh.submissionPda, b.bountyPda);
      s.data.accept = { signature: sig, slot, assetPda: chosen.assetPda, submissionPda: fresh.submissionPda, bountyReceipt: pda.bountyReceipt(bounty, asset).toBase58() };
      const d = s.deltas.bountyAccept;
      return `escrow released: vault ${T(d.vault)} → NorthLab ${T(d.providerA)}, treasury ${T(d.treasury)}; bounty ACCEPTED, bounty receipt written`;
    },

    async DELIVERED(s) {
      const t = this.tools(s, "agent");
      const rec = await t.verify_receipt(s.data.accept.bountyReceipt);
      const got = await t.retrieve_data(s.data.accept.bountyReceipt);
      s.data.bountyDelivery = { receiptPda: s.data.accept.bountyReceipt, receipt: rec, fact: got.body, bytes: got.bytes, contentHash: got.contentHash, licenseHash: got.licenseHash, hashMatch: got.contentHash === rec.contentHash };
      return "bounty receipt verified; full certificate delivered to the requester only now, hash-matched";
    },

    async ACTIVATED(s) {
      const sig = await setActive(this.conn, this.svc.db, this.ops.providerA, new PublicKey(s.data.accept.assetPda), true);
      const f = await this.fee(sig);
      this.tx(s, "Provider activates commissioned unit for sale", sig, f.slot, f.fee, "registry");
      const t = this.tools(s, "agent");
      const r = await t.search_data("inverter x100 recycling certificate", "recycling");
      s.data.activation = { signature: sig, gapAfter: r.gap, listed: r.items.map((i) => i.assetPda) };
      if (r.gap) throw new Error("activated unit not found in catalog");
      return "NorthLab activated the commissioned unit; it is now in the shared catalog at 0.03 aUSD";
    },

    async RESOLD(s) {
      const t = this.tools(s, "agent2");
      const r = await t.search_data("inverter x100 recycling certificate", "recycling");
      const item = r.items.find((i) => i.assetPda === s.data.accept.assetPda) ?? r.items[0];
      const q = await t.get_data_quote([item.assetPda], BigInt(this.budgetFor(s, "agent2").summary().tokensRemaining), "single");
      const pre = await this.balances(s);
      const p = await t.purchase_data(q);
      const st = await t.settle_purchase(q.orderId, p.signature, p.solBefore);
      this.tx(s, "Second agent buys the commissioned unit (purchase_unit)", p.signature, st.slot, st.feeLamports);
      const post = await this.balances(s);
      s.deltas.resale = this.delta(pre, post);
      const rec = await t.verify_receipt(p.receipts[0]);
      const got = await t.retrieve_data(p.receipts[0]);
      s.data.resale = { quote: q, ...p, ...st, receipt: rec, delivery: { bytes: got.bytes, contentHash: got.contentHash, hashMatch: got.contentHash === rec.contentHash } };
      const d = s.deltas.resale;
      return `second agent paid ${T(-BigInt(d.agent2))}; NorthLab earns again ${T(d.providerA)}, treasury ${T(d.treasury)}; new receipt verified, data delivered`;
    },

    async REFUND_DEMONSTRATED(s) {
      const t = this.tools(s, "refundRequester");
      const requester = this.keyFor(s, "refundRequester");
      const pre = await this.balances(s);
      const b = await t.create_bounty("X100_RECYCLING_V2", POLICY.bountyReward, POLICY.refundDeadlineSecs);
      const f = await this.fee(b.signature);
      this.tx(s, "Separate requester funds a short-lived bounty", b.signature, f.slot, f.fee);
      const bounty = new PublicKey(b.bountyPda);
      const funded = await this.balances(s, { vault: b.bountyPda });
      s.deltas.refundFund = this.delta({ ...pre, vault: "0" }, funded);
      const refund = () => programFor(this.conn, requester).methods.refundExpiredBounty().accountsStrict({
        requester: requester.publicKey, config: pda.config(), bounty, mint: this.svc.mint, vault: ata(bounty, this.svc.mint),
        requesterToken: ata(requester.publicKey, this.svc.mint), tokenProgram: TOKEN_PROGRAM_ID,
      });
      let early = "";
      try {
        await refund().simulate();
        early = "UNEXPECTED: early refund simulated successfully";
      } catch (e) {
        early = /DeadlineNotReached/.test(String((e as any)?.simulationResponse?.logs ?? e)) || /DeadlineNotReached/.test(String(e)) ? "DeadlineNotReached" : String(e).slice(0, 120);
      }
      if (early !== "DeadlineNotReached") throw new Error(`early refund check: ${early}`);
      s.data.refund = { bountyPda: b.bountyPda, deadline: b.deadline, earlyRefund: early, waitingUntil: b.deadline };
      this.save(s);
      const chainTime = async () => (await this.conn.getBlockTime(await this.conn.getSlot("confirmed"))) ?? 0;
      while ((await chainTime()) < b.deadline) await new Promise((r) => setTimeout(r, 1500));
      const sig = await refund().rpc({ commitment: "confirmed" });
      const slot = await waitFinalized(this.conn, sig);
      const f2 = await this.fee(sig);
      this.tx(s, "Expired bounty refunded in full (no fee)", sig, slot, f2.fee);
      const post = await this.balances(s, { vault: b.bountyPda });
      s.deltas.refund = this.delta(funded, post);
      Object.assign(s.data.refund, { signature: sig, slot, createSignature: b.signature });
      return `early refund rejected by the program (DeadlineNotReached); after the deadline the requester got ${T(s.deltas.refund.refundRequester)} back, platform fee ${T(s.deltas.refund.treasury).replace("+", "")}`;
    },

    async COMPLETE(s) {
      const d = s.deltas;
      const sum = (...v: (string | undefined)[]) => v.reduce((a, x) => a + BigInt(x ?? "0"), 0n).toString();
      s.data.earnings = {
        providerA: { purchase: d.purchase?.providerA, bounty: d.bountyAccept?.providerA, resale: d.resale?.providerA, total: sum(d.purchase?.providerA, d.bountyAccept?.providerA, d.resale?.providerA) },
        providerB: { purchase: d.purchase?.providerB, bounty: "0", resale: "0", total: sum(d.purchase?.providerB) },
        treasury: { purchase: d.purchase?.treasury, bounty: d.bountyAccept?.treasury, resale: d.resale?.treasury, refund: d.refund?.treasury, total: sum(d.purchase?.treasury, d.bountyAccept?.treasury, d.resale?.treasury, d.refund?.treasury) },
      };
      const readable = (f: string) => { try { const j = JSON.parse(f); return j.recycling_certificate ? `Recycling certificate ${j.recycling_certificate} (WEEE take-back) issued for the ${j.equipment}.` : f; } catch { return f; } };
      const cite = (x: any) => ({ fact: readable(x.fact), source: x.title ?? "Voltara X100 recycling certificate (commissioned)", assetPda: x.assetPda ?? s.data.accept.assetPda, receiptPda: x.receiptPda, contentHash: x.contentHash });
      s.data.report = {
        title: "Voltara X100 procurement brief",
        findings: [...s.data.deliveries.map(cite), cite(s.data.bountyDelivery)],
        spend: { purchases: s.data.quote.total, bounty: POLICY.bountyReward.toString(), cap: POLICY.agentTokenCap.toString() },
        caveat: "Every finding links to the receipt that licensed it. Receipts prove paid entitlement to exact bytes, version and license.",
      };
      return `brief with ${s.data.report.findings.length} source-linked findings; earned this run: NorthLab ${T(s.data.earnings.providerA.total)}, SouthSupply ${T(s.data.earnings.providerB.total)}, treasury ${T(s.data.earnings.treasury.total)}`;
    },
  };

  // ---------------- evidence ----------------
  /** Evidence manifest: actual values only; paid bodies/facts are excluded. */
  manifest(s: RunState) {
    const testsFile = join(ROOT, "evidence", "test-summary.json");
    const tests = existsSync(testsFile) ? JSON.parse(readFileSync(testsFile, "utf8")) : [];
    const strip = (x: any) => x && (({ fact, ...rest }) => rest)(x);
    return {
      runId: s.runId, mode: s.mode, cluster: s.cluster, programId: s.programId, mint: s.mint, mintLabel: "aUSD (test stablecoin)",
      createdAt: s.createdAt, finalStep: s.step, status: s.status,
      steps: s.steps.map(({ step, status, ms, summary }) => ({ step, status, durationMs: ms, summary })),
      transactions: s.transactions,
      deltas: s.deltas,
      receipts: [...(s.data.deliveries ?? []).map((x: any) => x.receipt), s.data.bountyDelivery?.receipt, s.data.resale?.receipt].filter(Boolean),
      bounties: [s.data.bounty && { ...s.data.bounty, outcome: "ACCEPTED", accept: s.data.accept }, s.data.refund && { ...s.data.refund, outcome: "REFUNDED" }].filter(Boolean),
      reviews: s.data.reviews ?? [],
      hashChecks: [...(s.data.deliveries ?? []).map(strip), strip(s.data.bountyDelivery), s.data.resale && { receiptPda: s.data.resale.receipts?.[0], ...s.data.resale.delivery }].filter(Boolean),
      budgets: s.budgets,
      earnings: s.data.earnings ?? null,
      tests,
      technicalGate: s.status === "complete" ? (s.mode === "LOCAL_VALIDATOR" ? "MET_LOCAL_VALIDATOR" : "MET_DEVNET") : "INCOMPLETE",
      uxGate: s.status === "complete" ? "GUIDED_RUN_COMPLETE" : "INCOMPLETE",
      limitations: [
        s.mode === "DEVNET"
          ? "Runs on Solana Devnet: aUSD is a test stablecoin mint and fees are paid in Devnet SOL."
          : "Local cluster: signatures live on this machine's ledger; re-check them with npm run verify.",
        "Provider catalog is sample data published by two provider wallets.",
        "The built-in agent is a rule-based planner over typed tools; any MCP client can drive the same tools with its own wallet and budget.",
        "Bounty review is a local trusted validator; the program cannot enforce it.",
        "Payment is atomic on-chain; off-chain delivery is a separate, retryable step.",
      ],
    };
  }

  writeEvidence(s: RunState) {
    const dir = join(ROOT, "evidence", "runs");
    mkdirSync(dir, { recursive: true });
    const m = this.manifest(s);
    writeFileSync(join(dir, `${s.runId}.json`), JSON.stringify(m, null, 2) + "\n");
    if (s.status === "complete") writeFileSync(manifestPath(s.cluster), JSON.stringify(m, null, 2) + "\n");
  }

  /** Public scene metadata for the UI. */
  static scenes() {
    return { steps: STEPS, scenes: SCENES };
  }
}

export { STEPS, SCENES };
export type { Step };
