// ADN console UI. Renders only actual state from the local service; actions
// call guarded /api/demo endpoints that execute real program instructions.
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const short = (s, a = 4, b = 4) => (s && s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s || "—");
const utcTime = (unix) => `${new Date(unix * 1000).toISOString().slice(11, 19)} UTC`;
const big = (v) => { try { return BigInt(v ?? 0); } catch { return 0n; } };
const CUR = "aUSD";
const fmtTest = (v, { sign = false } = {}) => {
  const n = big(v); const neg = n < 0n; const a = neg ? -n : n;
  const whole = a / 1000000n; const frac = (a % 1000000n).toString().padStart(6, "0").replace(/0+$/, "");
  const s = `${whole}${frac ? "." + frac : ""}`;
  return `${neg ? "−" : sign && n > 0n ? "+" : ""}${s} ${CUR}`;
};
const deltaCls = (v) => (big(v) > 0n ? "delta-pos" : big(v) < 0n ? "delta-neg" : "faint");
const ago = (sec) => (sec < 90 ? `${sec}s ago` : sec < 5400 ? `${Math.round(sec / 60)}m ago` : `${Math.round(sec / 3600)}h ago`);
const addr = (a, label) => (a ? `<span class="addr" tabindex="0" role="button" data-copy="${esc(a)}" title="Copy ${esc(a)}">${esc(label ?? short(a))}</span>` : "—");
const ICON = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 8.5l3 3 7-7"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
};
const NAV = [
  ["overview", "Overview", '<path d="M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z"/>'],
  ["control", "Control", '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'],
  ["agent", "Agent workspace", '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'],
  ["market", "Data marketplace", '<path d="M3 7h18l-2 13H5L3 7zM8 7a4 4 0 018 0"/>'],
  ["providers", "Provider workspace", '<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/>'],
  ["bounties", "Data bounties", '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/>'],
  ["tx", "Transactions & receipts", '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>'],
  ["earnings", "Provider earnings", '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'],
  ["evidence", "Verification & evidence", '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'],
  ["connect", "Your agent", '<path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 01-10 0zM12 16v5"/>'],
];

const app = {
  view: (location.hash || "#overview").slice(1),
  health: null, scenes: null, run: null, token: null, runId: null,
  catalog: [], bounties: [], evidence: null,
  auto: false, paused: false, busy: false, lastBalances: {}, marketQuery: "",
  // Control view form state survives the periodic re-render.
  ctl: { buyer: "agent", units: [], max: "0.1", receipt: "", bounty: "", quote: null, verify: null, bountyInfo: null, busy: "" },
};

// ---------------- API ----------------
// Public read-only copy (public/, built by scripts/export-public.ts): the same JSON is
// read from snapshot/ files and every action that would sign is disabled.
const STATIC = !!document.querySelector('meta[name="adn-static"]');
const READ_ONLY = "Read-only public copy. Clone the GitHub repo and run it locally to send transactions.";
const SNAPSHOT_ROUTES = [
  [/^\/api\/v1\/health$/, "health"], [/^\/api\/demo\/scenes$/, "scenes"], [/^\/api\/v1\/catalog$/, "catalog"],
  [/^\/api\/v1\/bounties$/, "bounties"], [/^\/api\/v1\/evidence$/, "evidence"], [/^\/api\/demo\/runs\/[\w-]+$/, "run"],
  [/^\/api\/demo\/runs\/[\w-]+\/evidence$/, "manifest"], [/^\/api\/v1\/receipts\/(\w{32,44})$/, "receipts/$1"], [/^\/api\/v1\/bounties\/(\w{32,44})$/, "bounties/$1"], [/^\/api\/v1\/agents$/, "agents"], [/^\/api\/v1\/connect$/, "connect"],
];
async function snapshotApi(method, path) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status, code: "READ_ONLY" }); };
  if (method !== "GET") fail(405, READ_ONLY);
  const p = decodeURIComponent(path.split("?")[0]);
  for (const [re, f] of SNAPSHOT_ROUTES) {
    const m = re.exec(p);
    if (!m) continue;
    const r = await fetch(`snapshot/${f.replace("$1", m[1] ?? "")}.json`);
    if (!r.ok) fail(404, "Not in this public copy: only the recorded session's receipts and bounties are included.");
    return r.json();
  }
  fail(404, READ_ONLY);
}

async function api(method, path, body) {
  if (STATIC) return snapshotApi(method, path);
  const headers = { "content-type": "application/json" };
  if (app.token) headers["x-run-token"] = app.token;
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json.message || `HTTP ${r.status}`), { status: r.status, code: json.code });
  return json;
}
function store() {
  try { localStorage.setItem("adn-run", JSON.stringify({ runId: app.runId, token: app.token })); } catch {}
}
function restore() {
  if (STATIC) return;
  try { const v = JSON.parse(localStorage.getItem("adn-run") || "null"); if (v?.runId && v?.token) { app.runId = v.runId; app.token = v.token; } } catch {}
}

async function refreshRun() {
  if (!app.runId) return;
  try { app.run = await api("GET", `/api/demo/runs/${app.runId}`); }
  catch (e) { if (e.status === 401 || e.status === 404) { app.run = null; app.runId = null; app.token = null; store(); } }
}
async function refreshPublic() {
  const [cat, b, ev] = await Promise.allSettled([api("GET", "/api/v1/catalog"), api("GET", "/api/v1/bounties"), api("GET", "/api/v1/evidence")]);
  if (cat.status === "fulfilled") app.catalog = cat.value.items;
  if (b.status === "fulfilled") app.bounties = b.value.items;
  if (ev.status === "fulfilled") app.evidence = ev.value;
  app.agents = (await api("GET", "/api/v1/agents").catch(() => null))?.items ?? app.agents ?? [];
}

// ---------------- controls ----------------
async function newRun() {
  if (app.busy) return;
  app.busy = true; app.auto = false; app.paused = false;
  setStatus("running", "Opening a new session: agent wallets, SOL and aUSD funding…");
  render();
  try {
    const r = await api("POST", "/api/demo/runs");
    app.runId = r.runId; app.token = r.token; app.run = r.state; app.lastBalances = {};
    store();
    toast(`Session ${r.runId} started`);
  } catch (e) { setStatus("error", `Could not start a session: ${e.message}`); }
  app.busy = false;
  await refreshPublic();
  render();
}

async function step() {
  if (!app.run || app.busy || app.run.step === "COMPLETE") return false;
  app.busy = true;
  render();
  const expected = app.run.step;
  const poll = setInterval(async () => { await refreshRun(); render(); }, 1200);
  try {
    app.run = await api("POST", `/api/demo/runs/${app.runId}/advance`, { expectedStep: expected, idempotencyKey: `${expected}:${Date.now()}` });
  } catch (e) {
    await refreshRun();
    if (e.status !== 409) toast(e.message);
  } finally {
    clearInterval(poll);
    app.busy = false;
  }
  await refreshPublic();
  render();
  return app.run?.status !== "error";
}

async function runAll() {
  if (!app.run) await newRun();
  if (!app.run || app.run.status === "error" && !confirm("The last step failed. Retry it?")) return;
  app.auto = true; app.paused = false; render();
  while (app.auto && !app.paused && app.run && app.run.step !== "COMPLETE") {
    const ok = await step();
    if (!ok) break;
  }
  app.auto = false; render();
}

function setStatus(kind, msg) { app.statusOverride = { kind, msg }; }

// ---------------- rendering helpers ----------------
const scene = (s) => app.scenes?.scenes?.[s];
const stepsList = () => (app.scenes?.steps ?? []).filter((s) => s !== "READY");
const role = (r) => app.run?.roleLabels?.[r] ?? r;
const wallets = () => app.run?.wallets ?? {};
function providerName(pk) {
  const w = wallets();
  if (pk === w.providerA) return "NorthLab"; if (pk === w.providerB) return "SouthSupply";
  if (pk === w.agent) return "Research agent"; if (pk === w.agent2) return "Second agent"; if (pk === w.treasury) return "ADN treasury";
  return short(pk);
}
function lastDone() { const d = (app.run?.steps ?? []).filter((x) => x.status === "done"); return d[d.length - 1]; }
function stepState(s) {
  const r = app.run; if (!r) return "todo";
  if (r.data?.pendingStep === s && r.status === "running") return "run";
  if (r.error?.step === s && r.status === "error") return "err";
  return (r.steps ?? []).some((x) => x.step === s && x.status === "done") ? "done" : "todo";
}
function stepSummary(s) { const x = [...(app.run?.steps ?? [])].reverse().find((y) => y.step === s); return x; }
function trustChips(t) {
  if (!t) return '<span class="badge red">No trust declaration · not quotable</span>';
  return `<div class="trustline">
    <span class="chip" title="Self-declared by the provider; not ownership proof">Source: ${esc(t.sourceLabel)} (declared)</span>
    <span class="chip">${esc(t.schemaId)} ${t.validationStatus === "VALID" ? "valid" : "INVALID"}</span>
    <span class="chip" title="Accuracy is the provider's claim. Buyers can dispute through bounties; see Verification & evidence → Open risks">Accuracy: provider-declared</span>
    ${t.provenance?.original === false
      ? `<span class="badge red" title="The same bytes were first listed by ${esc(t.provenance.firstProvider)}">Copy of an earlier listing · not for sale</span>`
      : `<span class="chip" title="First finalized listing of these exact bytes">Original listing${t.provenance?.firstSlot ? ` · slot ${t.provenance.firstSlot}` : ""}</span>`}
    <span class="chip">Snapshot ${esc(t.snapshot.toLowerCase())}</span>
    <span class="chip">Observed ${esc(ago(t.ageSeconds))}</span>
  </div>`;
}

// ---------------- top-level renders ----------------
function renderChrome() {
  const r = app.run; const h = app.health;
  const cur = r?.data?.pendingStep ?? r?.step ?? "READY";
  const stage = scene(cur)?.stage;
  const order = ["Discover", "Purchase", "Verify", "Commission", "Reuse"];
  $("#stages").innerHTML = order.map((s, i) => `<span class="stage ${s === stage ? "active" : order.indexOf(stage) > i || r?.step === "COMPLETE" ? "done" : ""}">${s}</span>`).join('<span class="faint">·</span>');
  const mode = h ? (h.mode === "DEVNET" ? '<span class="badge blue"><span class="dot"></span>Solana Devnet</span>' : '<span class="badge mint"><span class="dot"></span>Solana Localnet</span>') : '<span class="badge">connecting…</span>';
  $("#badges").innerHTML = `${mode}
    ${h ? `<span class="badge" title="${esc(h.programId)}">Program ${esc(short(h.programId))}</span><span class="badge" title="${esc(h.mint)}">Mint ${esc(short(h.mint))}</span>` : ""}
    ${h ? `<span class="badge ${h.rpcOk ? "" : "red"}">RPC ${h.rpcOk ? "ok" : "down"}</span>` : ""}
    ${r ? `<span class="badge">Session ${esc(r.runId)}</span>` : ""}
    ${STATIC ? '<span class="badge blue" title="A finished Devnet session; nothing here sends transactions">PUBLIC COPY · read-only</span>' : ""}`;
  $("#nav").innerHTML = NAV.map(([id, label, path], i) => `${i === 2 ? '<div class="sep"></div>' : ""}<button type="button" data-view="${id}" ${app.view === id ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>${label}</button>`).join("");
  const running = app.busy || r?.status === "running";
  $("#btnRun").disabled = running || r?.step === "COMPLETE";
  $("#btnRun").textContent = r?.step === "COMPLETE" ? "Task complete" : r && r.step !== "READY" ? "Continue task" : "Run agent task";
  $("#btnPause").disabled = !app.auto;
  $("#btnPause").textContent = app.paused ? "Resume" : "Pause";
  if (app.paused) $("#btnPause").disabled = false;
  $("#btnNext").disabled = running || !r || r.step === "COMPLETE" || app.auto;
  $("#btnReset").disabled = running;
  $("#btnReset").textContent = r ? "New session" : "Start session";
  // status bar
  let kind = "idle", msg = r ? `Next: ${scene(app.scenes?.steps[app.scenes.steps.indexOf(r.step) + 1])?.title ?? "—"}` : "No active session. Press Run agent task to start.";
  if (r?.status === "running" || app.busy) { kind = "running"; msg = `Running: ${scene(r?.data?.pendingStep)?.title ?? "setup"} — executing on Solana ${h?.cluster ?? ""}…`; }
  if (r?.status === "error") { kind = "error"; msg = `Step failed: ${scene(r.error.step)?.title} — ${r.error.message}. Press Next step to retry; earlier results are kept.`; }
  if (r?.status === "complete") { kind = "done"; msg = `Task complete. Every result is backed by a finalized Solana ${h?.mode === "DEVNET" ? "Devnet" : "Localnet"} transaction.`; }
  if (app.statusOverride && app.busy) ({ kind, msg } = app.statusOverride);
  if (STATIC) { kind = "done"; msg = "Read-only copy of a finished Devnet session. Every signature opens in Solana Explorer; to run it yourself, clone github.com/ofsng/agent-data-network."; }
  const dot = { idle: "", running: "amber", error: "red", done: "mint" }[kind];
  $("#statusDot").className = `badge ${dot}`;
  $("#statusDot").innerHTML = `<span class="dot ${kind === "running" ? "pulse" : ""}"></span>${{ idle: "Idle", running: "Running", error: "Error", done: "Complete" }[kind]}${app.paused ? " · paused" : ""}`;
  $("#statusMsg").textContent = msg;
  $("#caps").textContent = h ? `Agent: ${h.agent} · Settlement: ${h.transport} · MCP: ${h.mcp}` : "";
}

function welcome() {
  return `<div class="welcome">
    <h1>Agents buy exactly the data they need — and every contributor gets paid.</h1>
    <p>Agent Data Network is a marketplace where AI agents buy licensed data units from many providers in one Solana transaction, prove every purchase with an on-chain receipt, and fund missing data with escrowed bounties.</p>
    <div class="loop"><span>Discover</span><span>Purchase</span><span>Verify</span><span>Commission</span><span>Reuse</span></div>
    <p class="faint">Give the built-in research agent a task, or connect your own agent over MCP.</p>
    <p><button class="btn primary" type="button" data-action="run">Run agent task</button> <button class="btn" type="button" data-action="new">Step through it</button> <button class="btn ghost" type="button" data-view="connect">Connect your agent</button></p>
  </div>`;
}

function renderOverview() {
  const r = app.run;
  if (!r) return welcome();
  const focus = r.data?.pendingStep ?? (r.status === "error" ? r.error.step : lastDone()?.step) ?? "READY";
  const sc = scene(focus) ?? scene("READY");
  const nextStep = app.scenes.steps[app.scenes.steps.indexOf(r.step) + 1];
  const res = r.status === "running" && r.data?.pendingStep ? `<div class="result pending">In progress — executing on chain and verifying results…</div>`
    : r.status === "error" && r.error.step === focus ? `<div class="result err"><b>Failed:</b> ${esc(r.error.message)}<br><span class="muted">Nothing advanced. Press <b>Next step</b> to retry.</span></div>`
    : focus !== "READY" ? `<div class="result"><b>Result:</b> ${esc(stepSummary(focus)?.summary)}</div>` : `<div class="result pending">Run created with fresh wallets. ${nextStep ? `Next: <b>${esc(scene(nextStep).title)}</b>.` : ""}</div>`;
  const hero = `<div class="hero">
    <div class="kicker">${esc(sc.stage)} · step ${Math.max(1, stepsList().indexOf(focus) + 1)} of ${stepsList().length}</div>
    <h1 id="h-overview">${esc(sc.title)}</h1>
    <div class="explain">
      <div><b>What the agent does</b><span>${esc(sc.what)}</span></div>
      <div><b>Why</b><span>${esc(sc.why)}</span></div>
      <div><b>Money</b><span>${esc(sc.money)}</span></div>
      <div><b>On Solana</b><span>${esc(sc.onchain)}</span></div>
      <div><b>Problem solved</b><span>${esc(sc.problem)}</span></div>
    </div>${res}</div>`;
  const tl = `<div class="card"><h2>Story <span class="faint num">${(r.steps ?? []).filter((x) => x.status === "done").length}/${stepsList().length}</span></h2><ol class="timeline">${stepsList().map((s) => {
    const st = stepState(s); const sum = stepSummary(s);
    return `<li class="${st}"><span class="tl-icon ${st}" aria-label="${st}">${st === "done" ? ICON.check : st === "err" ? ICON.x : ""}</span>
      <div><div class="tl-title">${esc(scene(s).title)}</div>${sum && st !== "todo" ? `<div class="tl-sum">${esc(sum.summary)}</div>` : ""}</div>
      <span class="tl-ms num">${sum && st === "done" ? (sum.ms / 1000).toFixed(1) + "s" : ""}</span></li>`;
  }).join("")}</ol></div>`;
  return `<div class="ov">
    <div class="col-left">${taskCard()}${budgetCard("agent")}${traceCard(6)}</div>
    <div class="col-center">${hero}${tl}</div>
    <div class="col-right">${balancesCard()}${escrowCard()}${receiptsCard()}</div>
  </div>`;
}

function taskCard() {
  const task = app.run?.data?.task ?? "Prepare a procurement brief for the Voltara X100 solar inverter: peak efficiency, current lead time, and its recycling certificate.";
  return `<div class="card"><h2>Agent task</h2><div>${esc(task)}</div><div class="faint" style="margin-top:8px;font-size:12px">Built-in research agent · typed tools · budget-capped. Bring your own agent from <a href="#connect" data-view="connect">Connect your agent</a>.</div></div>`;
}
function budgetCard(r) {
  const b = app.run?.budgets?.[r];
  if (!b) return "";
  const cap = big(b.tokenCap); const spent = big(b.tokensSpent); const held = big(b.tokensCommitted) - spent;
  const pct = (x) => (cap > 0n ? Number((x * 10000n) / cap) / 100 : 0);
  return `<div class="card"><h2>${esc(role(r))} budget <span class="faint">${b.maxBounties ? `max ${b.maxBounties} bounty` : "purchases only"}</span></h2>
    <div class="meter" role="img" aria-label="spent ${pct(spent)}%, reserved ${pct(held)}%"><i class="spent" style="width:${pct(spent)}%"></i><i class="held" style="width:${pct(held)}%"></i></div>
    <dl class="kv" style="margin-top:10px">
      <dt>Spent (finalized)</dt><dd class="num">${fmtTest(b.tokensSpent)}</dd>
      <dt>Reserved / pending</dt><dd class="num">${fmtTest(held)}</dd>
      <dt>Remaining of cap</dt><dd class="num">${fmtTest(b.tokensRemaining)} / ${fmtTest(b.tokenCap)}</dd>
      <dt>SOL (fees + deposits)</dt><dd class="num">${(Number(b.solActualLamports) / 1e9).toFixed(5)} / ${(Number(b.solCapLamports) / 1e9).toFixed(3)} SOL</dd>
    </dl></div>`;
}
function traceCard(n) {
  const t = [...(app.run?.trace ?? [])].reverse().slice(0, n);
  return `<div class="card"><h2>Tool trace <span class="faint">${app.run?.trace?.length ?? 0} calls</span></h2>${t.length ? `<ul class="trace">${t.map((x) => `<li class="${x.status === "error" ? "err" : ""}"><div><span class="tool">${esc(x.tool)}</span> <span class="actor">· ${esc(x.actor)} · ${x.ms} ms</span></div><div class="out">${esc(x.output)}</div></li>`).join("")}</ul>` : '<div class="empty">No tool calls yet.</div>'}</div>`;
}
function balancesCard() {
  const r = app.run; if (!r) return "";
  const rows = ["agent", "agent2", "refundRequester", "providerA", "providerB", "treasury"];
  const html = rows.map((k) => {
    const cur = r.balances.current[k] ?? "0"; const d = big(cur) - big(r.balances.start[k] ?? "0");
    const changed = app.lastBalances[k] !== undefined && app.lastBalances[k] !== cur;
    return `<tr class="${changed ? "flash" : ""}"><td>${esc(role(k))}</td><td class="r num">${fmtTest(cur).replace(` ${CUR}`, "")}</td><td class="r num ${deltaCls(d)}">${d === 0n ? "—" : fmtTest(d, { sign: true }).replace(` ${CUR}`, "")}</td></tr>`;
  }).join("");
  rows.forEach((k) => (app.lastBalances[k] = r.balances.current[k]));
  return `<div class="card"><h2>Live balances <span class="faint">finalized</span></h2><div class="table-wrap"><table><thead><tr><th>Wallet</th><th class="r">aUSD</th><th class="r">Δ this session</th></tr></thead><tbody>${html}</tbody></table></div></div>`;
}
function escrowCard() {
  const d = app.run?.data ?? {};
  if (!d.bounty) return `<div class="card"><h2>Escrow</h2><div class="empty">No bounty funded yet.</div></div>`;
  const live = app.bounties.find((b) => b.bountyPda === d.bounty.bountyPda);
  const status = live?.status ?? "OPEN";
  return `<div class="card"><h2>Escrow <span class="badge ${status === "ACCEPTED" ? "mint" : status === "REFUNDED" ? "blue" : "amber"}">${esc(status)}</span></h2>
    <dl class="kv"><dt>Reward</dt><dd class="num">${fmtTest(live?.reward ?? "2000000")}</dd>
    <dt>Vault balance</dt><dd class="num">${fmtTest(live?.vaultBalance ?? "0")}</dd>
    <dt>Bounty PDA</dt><dd>${addr(d.bounty.bountyPda)}</dd>
    <dt>Vault (PDA-owned)</dt><dd>${addr(d.bounty.vault)}</dd>
    ${d.accept ? `<dt>Bounty receipt</dt><dd>${addr(d.accept.bountyReceipt)}</dd>` : ""}</dl>
    ${d.refund ? `<div class="faint" style="margin-top:8px;font-size:12px">Short-lived bounty ${addr(d.refund.bountyPda)}: ${d.refund.signature ? "REFUNDED (full reward, no fee)" : "waiting for deadline…"}</div>` : ""}</div>`;
}
function allReceipts() {
  const d = app.run?.data ?? {}; const out = [];
  (d.deliveries ?? []).forEach((x) => out.push({ label: x.title, ...x.receipt, hashMatch: x.hashMatch }));
  if (d.bountyDelivery) out.push({ label: "Commissioned certificate (bounty)", ...d.bountyDelivery.receipt, hashMatch: d.bountyDelivery.hashMatch });
  if (d.resale?.receipt) out.push({ label: "Resale to second agent", ...d.resale.receipt, hashMatch: d.resale.delivery?.hashMatch });
  return out;
}
function receiptsCard() {
  const rs = allReceipts();
  return `<div class="card"><h2>License receipts <span class="faint">${rs.length}</span></h2>${rs.length ? `<table><tbody>${rs.map((x) => `<tr><td>${esc(x.label)}<div class="faint" style="font-size:11.5px">${x.kind === 1 ? "bounty" : "purchase"} · ${addr(x.pda)}</div></td><td class="r">${x.hashMatch ? '<span class="badge mint">hash ✓</span>' : '<span class="badge amber">pending</span>'}</td></tr>`).join("")}</tbody></table>` : '<div class="empty">Receipts appear after the purchase finalizes.</div>'}</div>`;
}

function renderAgent() {
  const r = app.run;
  if (!r) return welcome();
  const d = r.data;
  const report = d.report ? `<div class="card"><h2>Research brief <span class="badge mint">source-linked</span></h2><h3>${esc(d.report.title)}</h3>
      <table><thead><tr><th>Finding (paid, delivered)</th><th>Source unit</th><th>Receipt</th><th class="r">Hash</th></tr></thead><tbody>${d.report.findings.map((f) => `<tr><td>${esc(f.fact)}</td><td>${esc(f.source)}<div>${addr(f.assetPda)}</div></td><td>${addr(f.receiptPda)}</td><td class="r"><span class="badge mint">✓ ${esc(f.contentHash.slice(0, 8))}</span></td></tr>`).join("")}</tbody></table>
      <p class="faint" style="font-size:12px;margin-bottom:0">${esc(d.report.caveat)}</p></div>`
    : d.deliveries ? `<div class="card"><h2>Delivered so far</h2><ul>${d.deliveries.map((x) => `<li>${esc(x.fact)} <span class="faint">— ${esc(x.title)}</span></li>`).join("")}${d.bountyDelivery ? `<li>${esc(d.bountyDelivery.fact)} <span class="faint">— commissioned certificate</span></li>` : ""}</ul></div>`
    : `<div class="card"><h2>Research brief</h2><div class="empty">The brief is assembled from purchased, hash-verified data once the task completes.</div></div>`;
  const trace = `<div class="card"><h2>Full tool trace</h2>${r.trace.length ? `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Tool</th><th>Input</th><th>Result</th></tr></thead><tbody>${r.trace.map((x) => `<tr><td class="faint num">${esc(x.at.slice(11, 19))}</td><td>${esc(x.actor)}</td><td class="mono" style="color:${x.status === "ok" ? "var(--blue)" : "var(--red)"}">${esc(x.tool)}</td><td class="mono faint" style="max-width:260px;word-break:break-all">${esc(JSON.stringify(x.input))}</td><td>${esc(x.output)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No tool calls yet.</div>'}</div>`;
  const intents = ["agent", "agent2", "refundRequester"].map((k) => r.budgets[k]).filter(Boolean);
  return `<div class="view-head"><div><h1>Agent workspace</h1><p>The research agent works only through typed tools: search_data, get_data_quote, purchase_data, settle_purchase, verify_receipt, retrieve_data, create_bounty, get_bounty_status. There is no generic signing tool, and every spend is reserved against a durable budget before signing.</p></div></div>
    <div class="grid g2">${taskCard()}<div class="card"><h2>Spending policy</h2><dl class="kv"><dt>Research agent cap</dt><dd>2.1 aUSD (purchases + 1 bounty)</dd><dt>Second agent cap</dt><dd>0.1 aUSD (purchases only)</dd><dt>Refund requester cap</dt><dd>2 aUSD (1 bounty)</dd><dt>Allowed actions</dt><dd>purchase_unit · create_bounty (allowlisted requirement)</dd></dl></div></div>
    <div class="grid g3" style="margin-top:12px">${["agent", "agent2", "refundRequester"].map(budgetCard).join("")}</div>
    <div style="margin-top:12px">${report}</div>
    <div class="card"><h2>Budget reservations</h2><div class="table-wrap"><table><thead><tr><th>Wallet</th><th>Intent</th><th>Kind</th><th class="r">aUSD</th><th>State</th><th>Signature</th></tr></thead><tbody>${intents.flatMap((b) => b.intents.map((i) => `<tr><td>${esc(role(b.role))}</td><td class="mono">${esc(short(i.intentId, 10, 4))}</td><td>${esc(i.kind)}</td><td class="r num">${fmtTest(i.tokens)}</td><td><span class="badge ${i.state === "FINALIZED" ? "mint" : i.state === "NOT_LANDED" ? "" : "amber"}">${esc(i.state)}</span></td><td>${addr(i.signature)}</td></tr>`)).join("") || '<tr><td colspan="6" class="empty">No reservations yet.</td></tr>'}</tbody></table></div></div>
    ${trace}`;
}

function renderMarket() {
  const d = app.run?.data ?? {};
  const bought = new Set([...(d.quote?.items ?? []).map((i) => i.assetPda), ...(d.resale?.quote?.items ?? []).map((i) => i.assetPda)]);
  const q = app.marketQuery.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const matched = app.catalog.filter((u) => !q.length || q.some((t) => [...u.title.toLowerCase().split(/[^a-z0-9]+/), ...u.tags].includes(t)));
  const hidden = matched.filter((u) => !u.active).length;
  const items = matched.filter((u) => u.active || app.showInactive).sort((a, b) => Number(b.active) - Number(a.active) || Number(bought.has(b.assetPda)) - Number(bought.has(a.assetPda)) || a.title.localeCompare(b.title));
  return `<div class="view-head"><div><h1>Data marketplace</h1><p>Free metadata only. Each unit's exact bytes stay private until a buyer holds a valid on-chain receipt. Source and rights are declared by each provider and bound to the listing by hash.</p></div></div>
    <form class="search" id="marketForm" role="search"><label class="sr-only" for="mq">Search metadata</label><input id="mq" placeholder="Search title or tags, e.g. inverter x100 lead time" value="${esc(app.marketQuery)}"><button class="btn" type="submit">Search</button><button class="btn ghost" type="button" data-action="inactive">${app.showInactive ? "Hide" : "Show"} inactive (${hidden})</button></form>
    <p class="faint" style="margin:-6px 0 12px;font-size:12.5px">${matched.filter((u) => u.active).length} active listings · inactive units are bounty candidates or retired listings (past receipts stay valid).</p>
    <div class="units">${items.map((u) => `<article class="card unit ${bought.has(u.assetPda) ? "bought" : ""} ${u.active ? "" : "inactive"}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><h3>${esc(u.title)}</h3><span class="price num">${fmtTest(u.price)}</span></div>
      <div class="muted" style="font-size:13px">${esc(u.teaser)}</div>
      <div class="chips">${u.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join("")}</div>
      ${trustChips(u.trust)}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;margin-top:auto"><span class="muted" style="white-space:nowrap">${esc(providerName(u.provider))} · v${u.version}</span><span style="white-space:nowrap">${u.active ? '<span class="badge mint">Active</span>' : '<span class="badge">Inactive</span>'} ${bought.has(u.assetPda) ? '<span class="badge blue">Bought this session</span>' : ""}</span></div>
      <div class="faint" style="font-size:11.5px">Asset ${addr(u.assetPda)} · content ${esc(u.contentHash.slice(0, 10))}…</div>
    </article>`).join("") || '<div class="empty">No matching units.</div>'}</div>`;
}

function renderProviders() {
  const w = wallets(); const dl = app.run?.deltas ?? {};
  const card = (key, name) => {
    const pk = w[key] ?? app.catalog.find((u) => (key === "providerA" ? /NorthLab/ : /SouthSupply/).test(u.trust?.sourceLabel ?? ""))?.provider;
    const units = app.catalog.filter((u) => u.provider === pk);
    const earn = big(dl.purchase?.[key]) + big(dl.bountyAccept?.[key]) + big(dl.resale?.[key]);
    return `<div class="card"><h2>${esc(name)} <span class="faint">${addr(pk)}</span></h2>
      <div class="grid g3"><div><div class="faint" style="font-size:12px">Earned this session</div><div class="big num delta-pos">${fmtTest(earn)}</div></div>
      <div><div class="faint" style="font-size:12px">Active listings</div><div class="big num">${units.filter((u) => u.active).length}</div></div>
      <div><div class="faint" style="font-size:12px">Inactive / candidates</div><div class="big num">${units.filter((u) => !u.active).length}</div></div></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Unit</th><th>Schema</th><th class="r">Price</th><th>Status</th></tr></thead><tbody>${units.map((u) => `<tr><td>${esc(u.title)}<div class="faint" style="font-size:11.5px">${addr(u.assetPda)}</div></td><td>${esc(u.trust?.schemaId ?? "—")}</td><td class="r num">${fmtTest(u.price)}</td><td>${u.active ? '<span class="badge mint">Active</span>' : '<span class="badge">Inactive</span>'}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">No listings yet — publish in step 1.</td></tr>'}</tbody></table></div></div>`;
  };
  const d = app.run?.data ?? {};
  const life = [["Submitted as inactive candidate", !!d.submissions], ["Passed bounded review", !!d.reviews?.some((x) => x.passed)], ["Accepted & paid from escrow", !!d.accept], ["Activated for sale", !!d.activation], ["Bought by a second agent", !!d.resale]];
  return `<div class="view-head"><div><h1>Provider workspace</h1><p>Providers publish data units with a source, rights and schema declaration. Each registration is a provider-signed transaction that fixes price, version, content hash and license hash on-chain. Providers can later only toggle active or inactive.</p></div></div>
    <div class="card"><h2>Commissioned unit lifecycle (NorthLab)</h2><ol class="timeline">${life.map(([t, ok]) => `<li class="${ok ? "done" : "todo"}"><span class="tl-icon ${ok ? "done" : ""}">${ok ? ICON.check : ""}</span><div class="tl-title">${esc(t)}</div><span></span></li>`).join("")}</ol></div>
    <div class="grid g2" style="margin-top:12px">${card("providerA", "NorthLab")}${card("providerB", "SouthSupply")}</div>`;
}

function renderBounties() {
  const d = app.run?.data ?? {};
  const live = (pda) => app.bounties.find((b) => b.bountyPda === pda);
  const main = d.bounty ? (() => {
    const b = live(d.bounty.bountyPda) ?? {};
    return `<div class="card"><h2>Commissioned: X100 recycling certificate <span class="badge ${b.status === "ACCEPTED" ? "mint" : "amber"}">${esc(b.status ?? "OPEN")}</span></h2>
      <div class="grid g2"><div><dl class="kv"><dt>Reward</dt><dd class="num">${fmtTest(b.reward ?? "2000000")}</dd><dt>Vault balance</dt><dd class="num">${fmtTest(b.vaultBalance ?? "0")}</dd><dt>Deadline</dt><dd>${utcTime(d.bounty.deadline)}</dd><dt>Bounty PDA</dt><dd>${addr(d.bounty.bountyPda)}</dd><dt>Requirement hash</dt><dd class="mono">${esc(short(d.bounty.requirementHash, 10, 6))}</dd></dl></div>
      <div><div class="faint" style="font-size:12px;margin-bottom:4px">Public requirement v2 (no answer included)</div><pre class="json">${esc(JSON.stringify(d.gap?.requirement ?? {}, null, 2))}</pre></div></div></div>`;
  })() : `<div class="card"><h2>Commissioned bounty</h2><div class="empty">The agent funds a bounty when it detects a gap (step “Agent detects a gap”).</div></div>`;
  const reviews = (d.reviews ?? []).map((r, i) => `<div class="card"><h2>Candidate ${i + 1} review <span class="badge ${r.passed ? "mint" : "red"}">${r.passed ? "PASS" : "FAIL"}</span></h2>
    <div class="checks">${Object.entries(r.checks).map(([k, v]) => `<div class="check ${v ? "ok" : "no"}">${v ? ICON.check : ICON.x}<span>${esc(k)}</span></div>`).join("")}</div>
    <dl class="kv" style="margin-top:10px"><dt>Submission PDA</dt><dd>${addr(r.submissionPda)}</dd><dt>Asset</dt><dd>${addr(r.assetPda)}</dd><dt>Content hash</dt><dd class="mono">${esc(short(r.contentHash, 10, 6))}</dd><dt>Preview</dt><dd>${esc(r.preview.schemaId)} · ${r.preview.byteLength} bytes · ${esc(r.preview.sourceLabel)}</dd></dl>
    <div class="faint" style="font-size:12px;margin-top:8px">The report shows pass/fail only. The certificate value is never revealed before acceptance.</div></div>`).join("");
  const refund = d.refund ? (() => { const b = live(d.refund.bountyPda) ?? {}; return `<div class="card"><h2>Separate short-lived bounty <span class="badge ${b.status === "REFUNDED" ? "blue" : "amber"}">${esc(b.status ?? "OPEN")}</span></h2><dl class="kv"><dt>Early refund attempt</dt><dd>${esc(d.refund.earlyRefund)} (rejected by program)</dd><dt>Deadline</dt><dd>${utcTime(d.refund.deadline)}</dd><dt>Refund delta</dt><dd class="num ${deltaCls(app.run.deltas.refund?.refundRequester)}">${app.run.deltas.refund ? fmtTest(app.run.deltas.refund.refundRequester, { sign: true }) + " to requester · treasury " + fmtTest(app.run.deltas.refund.treasury, { sign: true }) : "waiting…"}</dd><dt>Bounty PDA</dt><dd>${addr(d.refund.bountyPda)}</dd></dl></div>`; })() : "";
  const hist = `<div class="card"><h2>All bounties on this cluster <span class="faint">${app.bounties.length}</span></h2><div class="table-wrap"><table><thead><tr><th>Bounty</th><th>Requirement</th><th class="r">Reward</th><th class="r">Vault</th><th>Status</th></tr></thead><tbody>${app.bounties.map((b) => `<tr><td>${addr(b.bountyPda)}</td><td>${b.requirementVersion === "v2" ? "v2 public" : '<span class="faint">legacy</span>'}</td><td class="r num">${fmtTest(b.reward)}</td><td class="r num">${fmtTest(b.vaultBalance)}</td><td><span class="badge ${b.status === "ACCEPTED" ? "mint" : b.status === "REFUNDED" ? "blue" : "amber"}">${esc(b.status)}</span></td></tr>`).join("") || '<tr><td colspan="5" class="empty">None.</td></tr>'}</tbody></table></div></div>`;
  return `<div class="view-head"><div><h1>Data bounties</h1><p>Missing knowledge becomes funded demand. The reward sits in a vault owned by the bounty's PDA. Only the requester's signed acceptance (80% provider, 20% platform) or a full refund after the deadline can move it.</p></div></div>
    ${main}<div class="grid g2" style="margin-top:12px">${reviews}</div>${refund ? `<div style="margin-top:12px">${refund}</div>` : ""}<div style="margin-top:12px">${hist}</div>`;
}

function renderTx() {
  const r = app.run;
  if (!r) return welcome();
  const local = r.mode === "LOCAL_VALIDATOR";
  const txs = r.transactions;
  const rs = allReceipts();
  return `<div class="view-head"><div><h1>Transactions & receipts</h1><p>${local ? "Transactions on a local Solana cluster. Re-check every signature and receipt of the last session with <span class=\"mono\">npm run verify</span> (getTransaction + decoded accounts on the local RPC)." : "Devnet transactions with Explorer links."}</p></div></div>
    <div class="card"><h2>Transactions this session <span class="faint">${txs.length}</span></h2><div class="table-wrap"><table><thead><tr><th>Action</th><th>Type</th><th>Signature</th><th class="r">Slot</th><th class="r">Fee</th></tr></thead><tbody>${txs.map((t) => `<tr><td>${esc(t.label)}</td><td><span class="badge ${t.kind === "economic" ? "mint" : t.kind === "registry" ? "blue" : ""}">${esc(t.kind)}</span></td><td>${t.explorer ? `<a href="${esc(t.explorer)}" target="_blank" rel="noopener">${esc(short(t.signature, 8, 6))}</a>` : addr(t.signature, short(t.signature, 8, 6))}</td><td class="r num">${t.slot ?? "—"}</td><td class="r num">${t.feeLamports != null ? t.feeLamports.toLocaleString() + " lamports" : "—"}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">No transactions yet.</td></tr>'}</tbody></table></div></div>
    ${r.data.purchase?.slot ? `<div class="card"><h2>Atomic bundle measurements</h2><div class="grid g4"><div><div class="faint">Instructions</div><div class="big num">${r.data.purchase.instructions}</div></div><div><div class="faint">Size</div><div class="big num">${r.data.purchase.sizeBytes} B</div><div class="faint" style="font-size:12px">limit 1232 B</div></div><div><div class="faint">Compute</div><div class="big num">${(r.data.purchase.landedCU ?? 0).toLocaleString()}</div><div class="faint" style="font-size:12px">CU</div></div><div><div class="faint">SOL spent</div><div class="big num">${(Number(r.data.purchase.solSpentLamports) / 1e9).toFixed(5)}</div><div class="faint" style="font-size:12px">fee ${r.data.purchase.feeLamports} + 2 receipt deposits</div></div></div></div>` : ""}
    <div class="card"><h2>Decoded license receipts <span class="faint">${rs.length}</span></h2><div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Kind</th><th>Buyer</th><th>Provider</th><th class="r">Amount</th><th class="r">Provider / platform</th><th>Content hash</th><th class="r">Slot</th></tr></thead><tbody>${rs.map((x) => `<tr><td>${esc(x.label)}<div>${addr(x.pda)}</div></td><td>${x.kind === 1 ? "bounty" : "purchase"}</td><td>${esc(providerName(x.buyer))}</td><td>${esc(providerName(x.provider))}</td><td class="r num">${fmtTest(x.amount)}</td><td class="r num">${fmtTest(x.providerAmount)} / ${fmtTest(x.platformAmount)}</td><td class="mono">${esc(short(x.contentHash, 8, 6))}</td><td class="r num">${x.finalizedSlot}</td></tr>`).join("") || '<tr><td colspan="8" class="empty">No receipts yet.</td></tr>'}</tbody></table></div>
    <p class="faint" style="font-size:12px;margin-bottom:0">Each receipt is an immutable 254-byte account. It proves paid entitlement to an exact version, content hash and license hash. It does not prove truth, ownership or consumption.</p></div>`;
}

function renderEarnings() {
  const r = app.run;
  if (!r) return welcome();
  const dl = r.deltas;
  const parties = [
    ["NorthLab", "providerA"], ["SouthSupply", "providerB"], ["ADN treasury (20%)", "treasury"],
  ].map(([name, k]) => ({ name, k, purchase: big(dl.purchase?.[k]), bounty: big(dl.bountyAccept?.[k]), resale: big(dl.resale?.[k]) }));
  const max = parties.reduce((m, p) => (p.purchase + p.bounty + p.resale > m ? p.purchase + p.bounty + p.resale : m), 1n);
  const w = (x) => Number((x * 10000n) / max) / 100;
  const spend = [["Research agent", "agent", [dl.purchase?.agent, dl.bountyFund?.agent]], ["Second agent", "agent2", [dl.resale?.agent2]], ["Refund requester (funded then refunded, net)", "refundRequester", [dl.refundFund?.refundRequester, dl.refund?.refundRequester]]];
  return `<div class="view-head"><div><h1>Provider earnings</h1><p>Every payment splits 80% to the provider and 20% to the platform, inside the same instruction. These figures are measured token balance changes from finalized transactions, not projections.</p></div></div>
    <div class="grid g3">${parties.map((p) => `<div class="card"><h2>${esc(p.name)}</h2><div class="big num delta-pos">${fmtTest(p.purchase + p.bounty + p.resale)}</div>
      <div class="bar" style="margin-top:12px" role="img" aria-label="earnings split"><i style="width:${w(p.purchase)}%;background:var(--mint)"></i><i style="width:${w(p.bounty)}%;background:var(--blue)"></i><i style="width:${w(p.resale)}%;background:var(--amber)"></i></div>
      <dl class="kv" style="margin-top:10px"><dt>Atomic purchase</dt><dd class="num">${fmtTest(p.purchase)}</dd><dt>Bounty payout</dt><dd class="num">${fmtTest(p.bounty)}</dd><dt>Resale (repeat revenue)</dt><dd class="num">${fmtTest(p.resale)}</dd></dl></div>`).join("")}</div>
    <div class="legend"><span style="--c:var(--mint)">Atomic purchase</span><span style="--c:var(--blue)">Bounty payout</span><span style="--c:var(--amber)">Resale</span></div>
    <div class="card" style="margin-top:12px"><h2>Who paid</h2><table><thead><tr><th>Payer</th><th class="r">Token change</th></tr></thead><tbody>${spend.map(([n, , xs]) => `<tr><td>${esc(n)}</td><td class="r num ${deltaCls(xs.reduce((a, x) => a + big(x), 0n))}">${fmtTest(xs.reduce((a, x) => a + big(x), 0n), { sign: true })}</td></tr>`).join("")}</tbody></table>
    <p class="faint" style="font-size:12px;margin-bottom:0">The same commissioned unit pays NorthLab twice: 1.6 aUSD from the bounty and 0.024 aUSD from each later sale. That repeat revenue is the growth loop.</p></div>`;
}

const RISKS = [
  ["A buyer copies data and resells it cheaper", "Handled now", "mint", "Every listing is fingerprinted (content hash) on chain. A later listing of the same bytes by another provider is marked as a copy, hidden from search and can never be quoted. The first listing's slot and the copier's own purchase receipt prove who listed it first. The license hash in every receipt records the no-resale terms."],
  ["A copy with small edits", "Partly handled", "amber", "Edited bytes get a new hash, so they pass the copy check. Planned: a per-buyer watermark in delivered bytes, so a leaked copy points back to the receipt it came from. Fast-changing data (prices, stock, lead times) also loses value quickly for a copier."],
  ["Fake data submitted to a bounty", "Partly handled", "amber", "A provider can never pay itself: the vault only pays on the requester's signed acceptance, and only the reward amount. The requester sees pass/fail before paying, so the answer can't be taken for free. Today the pass/fail review is an off-chain validator the requester must trust. Planned: a dispute window before payout and a provider stake that is lost on a proven fake."],
  ["Wrong or invented data in the catalog", "Disclosed", "amber", "A receipt proves exactly which bytes were paid for, not that they are true. Source and accuracy are the provider's declaration and are labeled as such. Planned: issuer-signed data (the certificate authority signs, the program checks the signature), zkTLS proofs that data came from a named website, and provider reputation from dispute history."],
  ["Seller changes the data after payment", "Handled now", "mint", "Price, version, content hash and license hash are fixed on chain at registration. Delivery is refused unless the stored bytes match the receipt; corrupted bytes are restored from a verified snapshot and the buyer retries for free."],
  ["An agent overspends", "Handled now", "mint", "Every spend is reserved against a durable cap before signing; the agent has no generic signing tool."],
  ["The platform goes offline after payment", "Partly handled", "amber", "Payment and receipt are on chain and stay valid; delivery is a separate, retryable step that needs the provider's service to be up."],
];
const risksCard = () => `<div class="card"><h2>Open risks and how they are handled</h2><div class="table-wrap"><table><thead><tr><th>Risk</th><th>Status</th><th>What the system does</th></tr></thead><tbody>${RISKS.map(([k, st, c, d]) => `<tr><td style="min-width:170px"><b>${esc(k)}</b></td><td><span class="badge ${c}">${esc(st)}</span></td><td class="muted">${esc(d)}</td></tr>`).join("")}</tbody></table></div></div>`;

function renderEvidence() {
  const r = app.run; const h = app.health; const ev = app.evidence;
  const d = r?.data ?? {};
  const checks = [...(d.deliveries ?? []).map((x) => [x.title, x.contentHash, x.receipt?.contentHash, x.hashMatch]),
    d.bountyDelivery && ["Commissioned certificate", d.bountyDelivery.contentHash, d.bountyDelivery.receipt?.contentHash, d.bountyDelivery.hashMatch],
    d.resale?.delivery && ["Resale delivery", d.resale.delivery.contentHash, d.resale.receipt?.contentHash, d.resale.delivery.hashMatch]].filter(Boolean);
  const tests = ev?.tests ?? [];
  const m = ev?.latest;
  return `<div class="view-head"><div><h1>Verification & blockchain evidence</h1><p>Every number on this console comes from a finalized transaction. Here is how to check it yourself.</p></div>${r ? '<button class="btn" type="button" data-action="manifest">Download session manifest</button>' : ""}</div>
    <div class="grid g2"><div class="card"><h2>Runtime</h2><dl class="kv">
      <dt>Network</dt><dd>${h?.mode === "DEVNET" ? "Solana Devnet" : "Solana Localnet"}</dd>
      <dt>Program ID</dt><dd>${addr(h?.programId, h?.programId)}</dd><dt>Payment mint</dt><dd>${addr(h?.mint)} (aUSD, 6 decimals)</dd>
      <dt>Treasury</dt><dd>${addr(h?.treasury)}</dd><dt>Agent</dt><dd>${esc(h?.agent)}</dd><dt>Payment transport</dt><dd>${esc(h?.transport)}</dd><dt>MCP</dt><dd>${esc(h?.mcp)}</dd></dl></div>
    <div class="card"><h2>Status</h2><dl class="kv"><dt>Settlement (this session)</dt><dd>${r?.status === "complete" ? `<span class="badge mint">MET — ${esc(r.mode)}</span>` : '<span class="badge amber">in progress</span>'}</dd>
      <dt>Devnet deployment</dt><dd>${ev?.devnet ? `<a href="${esc(ev.devnet.explorer)}" target="_blank" rel="noopener"><span class="badge mint">deployed — Explorer ↗</span></a>` : '<span class="badge amber">not deployed</span>'}</dd>
      ${ev?.devnet?.lastRun ? `<dt>Last Devnet session</dt><dd>${esc(ev.devnet.lastRun)} <span class="badge ${ev.devnet.lastRunStatus === "complete" ? "mint" : "amber"}">${esc(ev.devnet.lastRunStatus)}</span></dd>` : ""}
      <dt>Last complete session</dt><dd>${m ? `${esc(m.runId)}` : "—"}</dd></dl></div></div>
    <div class="card" style="margin-top:12px"><h2>Hash checks <span class="faint">${checks.length}</span></h2><table><thead><tr><th>Delivery</th><th>Delivered bytes SHA-256</th><th>Receipt content hash</th><th class="r">Match</th></tr></thead><tbody>${checks.map(([n, a, b, ok]) => `<tr><td>${esc(n)}</td><td class="mono">${esc(short(a, 12, 8))}</td><td class="mono">${esc(short(b, 12, 8))}</td><td class="r">${ok ? '<span class="badge mint">✓ exact</span>' : '<span class="badge red">✗</span>'}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">No deliveries yet.</td></tr>'}</tbody></table></div>
    <div class="card"><h2>Automated test results <span class="faint">${tests.reduce((a, t) => a + (t.passed ?? 0), 0)} passed · ${tests.reduce((a, t) => a + (t.failed ?? 0), 0)} failed</span></h2><table><thead><tr><th>Suite</th><th class="r">Passed</th><th class="r">Failed</th><th>Ran at</th></tr></thead><tbody>${tests.map((t) => `<tr><td>${esc(t.suite)}</td><td class="r num">${t.passed}</td><td class="r num ${t.failed ? "delta-neg" : ""}">${t.failed}</td><td class="faint">${esc(t.ranAt ?? "")}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">Run scripts/test-all.sh to record results.</td></tr>'}</tbody></table></div>
    <div class="card"><h2>Recent sessions <span class="faint">${ev?.runs?.length ?? 0}</span></h2><table><thead><tr><th>Session</th><th>Network</th><th>Final step</th><th class="r">Transactions</th><th>Gate</th></tr></thead><tbody>${(ev?.runs ?? []).map((x) => `<tr><td class="mono">${esc(x.runId)}</td><td>${esc(x.mode)}</td><td>${esc(x.finalStep)}</td><td class="r num">${x.transactions?.length ?? 0}</td><td><span class="badge ${x.technicalGate?.startsWith("MET") ? "mint" : "amber"}">${esc(x.technicalGate)}</span></td></tr>`).join("") || '<tr><td colspan="5" class="empty">None.</td></tr>'}</tbody></table></div>
    ${risksCard()}
    <div class="card"><h2>Network notes</h2><ul style="margin:0;padding-left:18px;color:var(--muted)">${(m?.limitations ?? ["Settles in aUSD, a test stablecoin on Solana Devnet.", "Provider catalog is sample data."]).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`;
}

// ---------------- connect your agent (MCP) ----------------
const MCP_TOOLS = [
  ["get_started", "Shows what is set up, the one next step, and what only you can do.", "setup"],
  ["create_wallet · fund_wallet", "The agent creates its own wallet on this machine and tops it up where the operator keys are present.", "setup"],
  ["request_budget · check_request", "The agent asks you for an allowance; you approve in a dialog or here.", "setup"],
  ["search_data · get_data_quote", "Free metadata search and exact prices. Nothing is paid.", "read"],
  ["purchase_data", "Buys one or two units in one transaction within the allowance; asks you first above the threshold.", "wallet"],
  ["retrieve_data", "Fetches the content of a receipt it owns, hash-checked.", "wallet"],
  ["wallet_status · verify_receipt · list_bounties", "Balance and allowance, on-chain receipt checks, open data requests.", "read"],
];
function agentSentence(ci, cluster) {
  const root = ci?.root ?? "/path/to/agent-data-network";
  return `Set up Agent Data Network for me. Run this in a terminal: ${cluster === "devnet" ? "SOLANA_CLUSTER=devnet " : ""}npm --prefix "${root}" run --silent connect
Then reload your MCP servers (or ask me to), call the adn tool get_started and follow it until it says READY. Do the setup yourself; only ask me for approvals.`;
}
const sinceText = (t) => (t ? ago(Math.max(0, Math.floor(Date.now() / 1000) - t)) : "never");
function agentCard(a) {
  const al = a.allowance;
  const cap = big(al?.cap); const left = big(al?.remaining);
  const usedPct = cap > 0n ? Number(((cap - left) * 10000n) / cap) / 100 : 0;
  const live = a.lastSeen && Date.now() / 1000 - a.lastSeen < 600;
  const sig = (ref) => (ref && ref.length > 60 && app.health?.cluster === "devnet" ? ` <a href="https://explorer.solana.com/tx/${esc(ref)}?cluster=devnet" target="_blank" rel="noopener">tx ↗</a>` : "");
  return `<div class="card agent-card">
    <h2><span><span class="dot-live ${live ? "on" : ""}"></span>Agent ${addr(a.address)}</span><span class="faint">${live ? "active" : "last active"} ${esc(sinceText(a.lastSeen))}</span></h2>
    <div class="agent-stats">
      <div><span>Wallet</span><b class="num">${fmtTest(a.balance.aUSD)}</b><em>${a.balance.sol.toFixed(3)} SOL for fees</em></div>
      <div><span>Allowance left</span><b class="num">${al ? fmtTest(al.remaining) : "—"}</b><div class="meter"><i class="spent" style="width:${usedPct}%"></i></div><em>${al ? `${fmtTest(al.spent)} spent of ${fmtTest(al.approvedInTotal)} approved` : "waiting for your first approval"}</em></div>
      <div><span>Asks you first</span><b class="num">above ${al ? fmtTest(al.approveAbove) : "0.1 aUSD"}</b><em>per purchase</em></div>
    </div>
    ${a.pending.length ? `<div class="agent-pending"><h3>Waiting for you</h3>${a.pending.map((r) => `<div class="pend"><div><b>${r.kind === "BUDGET" ? "More budget" : "Purchase"}</b><span>${esc(r.summary)}</span></div>
      <div class="pend-btns"><button class="btn" type="button" data-decide="decline" data-agent="${esc(a.address)}" data-req="${esc(r.id)}">Decline</button><button class="btn primary" type="button" data-decide="approve" data-agent="${esc(a.address)}" data-req="${esc(r.id)}">Approve</button></div></div>`).join("")}</div>` : ""}
    <h3 class="agent-sub">Activity</h3>
    ${a.activity.length ? `<ul class="feed">${a.activity.map((x) => `<li class="${x.ok ? "" : "err"}"><span class="t num">${esc(new Date(x.at * 1000).toISOString().slice(11, 16))}</span><span class="tool">${esc(x.tool)}</span><span class="s">${esc(x.summary)}${sig(x.ref)}</span></li>`).join("")}</ul>` : '<div class="empty">No activity yet.</div>'}
  </div>`;
}
function renderConnect() {
  const cluster = app.health?.cluster ?? "localnet";
  const sentence = agentSentence(app.connectInfo, cluster);
  const block = (code) => `<div style="position:relative"><pre class="json" style="white-space:pre-wrap;word-break:break-all;padding-right:64px">${esc(code)}</pre><button type="button" class="btn ghost copy-btn" data-copytext="${esc(code)}">Copy</button></div>`;
  const agents = app.agents ?? [];
  const manual = app.connectInfo?.mcp ? `claude mcp add adn ${Object.entries(app.connectInfo.mcp.env).map(([k, v]) => `--env ${k}=${v}`).join(" ")} -- ${app.connectInfo.mcp.command} ${app.connectInfo.mcp.args.map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(" ")}` : "npm run connect   # prints the exact command for your machine";
  return `<div class="view-head"><div><h1>Your agent</h1><p>Your AI agent sets itself up, shops for data with its own wallet and asks you only when a person has to decide. You watch and approve here.</p></div></div>
    ${STATIC ? `<div class="card static-note"><h2><span class="badge blue">Read-only copy</span> How to actually connect</h2><p class="muted" style="margin:0 0 8px">This public page only shows how it works; no agent can connect to it. Connecting happens on a computer where the project runs. There, open this page at <span class="mono">http://127.0.0.1:8787/#connect</span>: the message below then contains the real folder, and your agent appears in the list.</p>${block("git clone https://github.com/ofsng/agent-data-network && cd agent-data-network\nnpm run setup && npm start")}</div>` : ""}
    <div class="card connect-hero"><h2><span class="badge mint">1 step</span> Give your agent this message</h2>
      <p class="muted" style="margin-top:0">Paste it into Claude Code or any agent that can use a terminal. It creates its wallet, gets funded, connects over MCP and checks itself.</p>
      ${block(sentence)}
      <div class="asks"><div><b>It will ask you to</b></div><span>approve purchases above the threshold</span><span>approve more budget when the allowance runs out</span><span>reload MCP servers once after setup</span><span>send funds, only if this machine has no operator keys</span></div></div>
    <h2 class="section-title">Connected agents <span class="faint">${agents.length}</span></h2>
    ${agents.length ? agents.map(agentCard).join("") : `<div class="card"><div class="empty">No agent connected yet. After you paste the message above, your agent shows up here with its wallet, allowance and every action it takes.</div></div>`}
    <details class="card manual"><summary>Manual setup and the tools your agent gets</summary>
      <p class="muted">Run <span class="mono">npm run connect</span> yourself (add <span class="mono">--allowance 1 --approve-above 0.2</span> to change the defaults), or register the server by hand:</p>${block(manual)}
      <p class="muted">Give more budget later with <span class="mono">npm run cli -- allow 0.5</span>, or approve the agent's request on this page.</p>
      <div class="table-wrap"><table><thead><tr><th>Tool</th><th>What it does</th><th>Kind</th></tr></thead><tbody>${MCP_TOOLS.map(([n, d, k]) => `<tr><td class="mono">${esc(n)}</td><td>${esc(d)}</td><td><span class="badge ${k === "wallet" ? "amber" : k === "setup" ? "blue" : ""}">${k}</span></td></tr>`).join("")}</tbody></table></div>
      <p class="faint" style="font-size:12px;margin-bottom:0">There is no generic signing tool: the agent can only buy listed units through purchase_data, within an allowance you approved. Approvals guard against mistakes; anyone with full access to this machine can still read the key file.</p>
    </details>`;
}

// ---------------- control (compact exchange-style console) ----------------
const ROLES = ["agent", "agent2", "refundRequester", "providerA", "providerB", "treasury"];
const toBase = (v) => { const m = /^(\d{0,12})(?:\.(\d{0,6}))?$/.exec(String(v).trim()); return m && (m[1] || m[2]) ? (BigInt(m[1] || "0") * 1000000n + BigInt((m[2] || "").padEnd(6, "0"))).toString() : null; };
const ctlOut = (res) => (res?.error ? `<div class="cx-out err">${esc(res.error)}</div>` : "");

function renderControl() {
  const r = app.run; const h = app.health; const c = app.ctl;
  const steps = stepsList();
  const done = steps.filter((s) => stepState(s) === "done").length;
  const cur = r?.data?.pendingStep ?? (r?.status === "error" ? r.error.step : app.scenes.steps[app.scenes.steps.indexOf(r?.step ?? "READY") + 1]);
  const paid = ["providerA", "providerB"].reduce((a, k) => a + big(r?.deltas?.purchase?.[k]) + big(r?.deltas?.bountyAccept?.[k]) + big(r?.deltas?.resale?.[k]), 0n);
  const running = app.busy || r?.status === "running";
  const ticker = `<div class="cx-ticker">
    <div><span>Network</span><b>${h?.mode === "DEVNET" ? "Devnet" : "Localnet"}</b></div>
    <div><span>Program</span><b>${addr(h?.programId)}</b></div>
    <div><span>Asset</span><b>aUSD</b></div>
    <div><span>Progress</span><b class="num">${done}/${steps.length}</b></div>
    <div><span>Paid to providers</span><b class="num up">${fmtTest(paid).replace(` ${CUR}`, "")}</b></div>
    <div><span>Session</span><b>${r ? esc(short(r.runId, 12, 6)) : "—"}</b></div>
    <div><span>RPC</span><b class="${h?.rpcOk ? "up" : "down"}">● ${h?.rpcOk ? "online" : "down"}</b></div>
  </div>`;
  const wallets = `<div class="cx-panel"><div class="cx-h">Wallets <span>aUSD</span></div>
    ${r ? `<table class="cx-t"><tbody>${ROLES.map((k) => { const v = r.balances.current[k] ?? "0"; const d = big(v) - big(r.balances.start[k] ?? "0");
      return `<tr><td>${esc(role(k))}</td><td class="r num">${fmtTest(v).replace(` ${CUR}`, "")}</td><td class="r num ${d > 0n ? "up" : d < 0n ? "down" : "faint"}">${d === 0n ? "0" : fmtTest(d, { sign: true }).replace(` ${CUR}`, "")}</td></tr>`; }).join("")}</tbody></table>` : '<div class="cx-empty">Start a session to see wallets.</div>'}</div>`;
  const book = app.catalog.filter((u) => u.active).sort((a, b) => big(a.price) < big(b.price) ? -1 : 1);
  const market = `<div class="cx-panel"><div class="cx-h">Market <span>${book.length} units · tap to quote</span></div>
    <table class="cx-t"><tbody>${book.map((u) => `<tr class="pick ${c.units.includes(u.assetPda) ? "on" : ""}" data-pick="${esc(u.assetPda)}" tabindex="0"><td>${esc(u.title.replace(/^Voltara /, ""))}<div class="faint">${esc(providerName(u.provider))}</div></td><td class="r num">${fmtTest(u.price).replace(` ${CUR}`, "")}</td></tr>`).join("") || '<tr><td class="cx-empty">No active units yet.</td></tr>'}</tbody></table></div>`;
  const cells = steps.map((s) => `<i class="${stepState(s)}" title="${esc(scene(s).title)}"></i>`).join("");
  const last = lastDone();
  const run = `<div class="cx-panel"><div class="cx-h">Session <span>${r ? esc(r.status) : "none"}</span></div>
    <div class="cx-step"><div class="faint">${r?.step === "COMPLETE" ? "Finished" : running ? "Running" : "Next"}</div><div class="cx-title">${r?.step === "COMPLETE" ? "All 16 steps done" : esc(scene(cur)?.title ?? "Start a session")}</div></div>
    <div class="cx-cells" role="img" aria-label="${done} of ${steps.length} steps done">${cells}</div>
    <div class="cx-btns">
      <button class="btn" type="button" data-action="new" ${running ? "disabled" : ""}>New session</button>
      <button class="btn" type="button" data-action="next" ${running || !r || r.step === "COMPLETE" || app.auto ? "disabled" : ""}>Next step</button>
      <button class="btn primary" type="button" data-action="run" ${running || r?.step === "COMPLETE" ? "disabled" : ""}>Run to end</button>
      <button class="btn" type="button" data-action="pause" ${app.auto || app.paused ? "" : "disabled"}>${app.paused ? "Resume" : "Pause"}</button>
    </div>
    ${r?.status === "error" ? `<div class="cx-out err">${esc(r.error.message)} — press Next step to retry.</div>` : last ? `<div class="cx-out">${esc(last.summary)}</div>` : ""}</div>`;
  const txs = [...(r?.transactions ?? [])].reverse();
  const tape = `<div class="cx-panel"><div class="cx-h">Transactions <span>${txs.length}</span></div>
    <table class="cx-t"><tbody>${txs.map((t) => `<tr><td><span class="kdot ${t.kind}"></span>${esc(t.label)}</td><td class="r">${t.explorer ? `<a href="${esc(t.explorer)}" target="_blank" rel="noopener" class="mono">${esc(short(t.signature, 6, 4))}</a>` : addr(t.signature, short(t.signature, 6, 4))}</td></tr>`).join("") || '<tr><td class="cx-empty">No transactions yet.</td></tr>'}</tbody></table></div>`;
  const buyers = r ? [["agent", r.wallets.agent], ["agent2", r.wallets.agent2]] : [];
  const q = c.quote && !c.quote.error ? c.quote : null;
  const quote = `<div class="cx-panel"><div class="cx-h">Quote <span>read-only · nothing is paid</span></div>
    <label class="cx-f"><span>Buyer</span><select id="ctlBuyer" ${r ? "" : "disabled"}>${buyers.map(([k]) => `<option value="${k}" ${c.buyer === k ? "selected" : ""}>${esc(role(k))}</option>`).join("") || "<option>Start a session first</option>"}</select></label>
    <div class="cx-f"><span>Units</span><div class="cx-sel">${c.units.map((p) => `<span class="chip">${esc(app.catalog.find((u) => u.assetPda === p)?.title.replace(/^Voltara /, "") ?? short(p))}</span>`).join("") || '<span class="faint">tap up to 2 units in Market</span>'}</div></div>
    <label class="cx-f"><span>Max spend</span><input id="ctlMax" inputmode="decimal" value="${esc(c.max)}" autocomplete="off"><em>aUSD</em></label>
    <button class="btn primary wide" type="button" data-action="ctl-quote" ${!r || !c.units.length || c.busy ? "disabled" : ""}>${c.busy === "quote" ? "Checking…" : "Get quote"}</button>
    ${q ? `<div class="cx-out"><div class="cx-row"><span>Total</span><b class="num">${fmtTest(q.total)}</b></div><div class="cx-row"><span>To providers (80%)</span><b class="num">${fmtTest(q.items.reduce((a, i) => a + big(i.providerAmount), 0n))}</b></div><div class="cx-row"><span>To platform (20%)</span><b class="num">${fmtTest(q.items.reduce((a, i) => a + big(i.platformAmount), 0n))}</b></div><div class="cx-row"><span>Trust preflight</span><b class="up">passed</b></div></div>` : ctlOut(c.quote)}</div>`;
  const rs = allReceipts();
  const v = c.verify && !c.verify.error ? (c.verify.receipt ?? c.verify) : null;
  const verify = `<div class="cx-panel"><div class="cx-h">Verify receipt <span>on chain</span></div>
    <label class="cx-f"><span>Receipt</span><input id="ctlReceipt" class="mono" placeholder="receipt address" value="${esc(c.receipt)}" autocomplete="off" spellcheck="false"></label>
    ${rs.length ? `<div class="cx-sel">${rs.map((x) => `<button type="button" class="chip" data-fill="ctlReceipt" data-val="${esc(x.pda)}">${esc(x.label.replace(/^Voltara /, ""))}</button>`).join("")}</div>` : ""}
    <button class="btn wide" type="button" data-action="ctl-verify" ${!c.receipt || c.busy ? "disabled" : ""}>${c.busy === "verify" ? "Checking…" : "Verify"}</button>
    ${v ? `<div class="cx-out"><div class="cx-row"><span>Status</span><b class="up">valid</b></div><div class="cx-row"><span>Buyer</span><b>${esc(providerName(v.buyer))}</b></div><div class="cx-row"><span>Paid</span><b class="num">${fmtTest(v.amount)}</b></div><div class="cx-row"><span>Provider / platform</span><b class="num">${fmtTest(v.providerAmount).replace(` ${CUR}`, "")} / ${fmtTest(v.platformAmount).replace(` ${CUR}`, "")}</b></div><div class="cx-row"><span>Type</span><b>${v.kind === 1 ? "bounty" : "purchase"}</b></div></div>` : ctlOut(c.verify)}</div>`;
  const bi = c.bountyInfo && !c.bountyInfo.error ? c.bountyInfo : null;
  const bounty = `<div class="cx-panel"><div class="cx-h">Bounty <span>escrow status</span></div>
    <label class="cx-f"><span>Bounty</span><select id="ctlBounty"><option value="">choose…</option>${app.bounties.map((b) => `<option value="${esc(b.bountyPda)}" ${c.bounty === b.bountyPda ? "selected" : ""}>${esc(short(b.bountyPda, 5, 4))} · ${esc(b.status)}</option>`).join("")}</select></label>
    <button class="btn wide" type="button" data-action="ctl-bounty" ${!c.bounty || c.busy ? "disabled" : ""}>${c.busy === "bounty" ? "Checking…" : "Check"}</button>
    ${bi ? `<div class="cx-out"><div class="cx-row"><span>Status</span><b class="${bi.status === "OPEN" ? "" : "up"}">${esc(bi.status)}</b></div><div class="cx-row"><span>Reward</span><b class="num">${fmtTest(bi.reward)}</b></div><div class="cx-row"><span>In vault</span><b class="num">${fmtTest(bi.vaultBalance)}</b></div><div class="cx-row"><span>Deadline</span><b>${utcTime(bi.deadline)}</b></div><div class="cx-row"><span>Submissions</span><b class="num">${bi.submissions?.length ?? 0}</b></div></div>` : ctlOut(c.bountyInfo)}</div>`;
  return `${ticker}<div class="cx">
    <div class="cx-col">${wallets}${market}</div>
    <div class="cx-col">${run}${tape}</div>
    <div class="cx-col">${quote}${verify}${bounty}</div></div>`;
}

async function ctlAction(kind) {
  const c = app.ctl; if (c.busy) return;
  c.busy = kind; render();
  try {
    if (kind === "quote") {
      const max = toBase(c.max); if (!max) throw new Error("Max spend must be a number like 0.1");
      c.quote = await api("POST", "/api/v1/quotes", { buyer: app.run.wallets[c.buyer], assetPdas: c.units, maxSpend: max, kind: c.units.length > 1 ? "bundle" : "single" });
    }
    if (kind === "verify") c.verify = await api("GET", `/api/v1/receipts/${encodeURIComponent(c.receipt.trim())}`);
    if (kind === "bounty") c.bountyInfo = await api("GET", `/api/v1/bounties/${encodeURIComponent(c.bounty)}`);
  } catch (e) {
    c[{ quote: "quote", verify: "verify", bounty: "bountyInfo" }[kind]] = { error: e.message };
  }
  c.busy = ""; render();
}

const VIEWS = { overview: renderOverview, control: renderControl, agent: renderAgent, market: renderMarket, providers: renderProviders, bounties: renderBounties, tx: renderTx, earnings: renderEarnings, evidence: renderEvidence, connect: renderConnect };
function render() {
  if (!app.scenes) return;
  renderChrome();
  for (const id of Object.keys(VIEWS)) $(`#v-${id}`).hidden = id !== app.view;
  const el = $(`#v-${app.view}`);
  const focused = document.activeElement?.id;
  el.innerHTML = VIEWS[app.view]();
  const i = focused && el.querySelector(`#${focused}`);
  if (i && i.tagName === "INPUT") { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  else if (i) i.focus();
  if (STATIC) document.querySelectorAll('#btnRun, #btnNext, #btnPause, #btnReset, [data-action="new"], [data-action="run"], [data-action="next"], [data-action="pause"], [data-action="ctl-quote"], [data-decide]')
    .forEach((b) => { b.disabled = true; b.title = READ_ONLY; });
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------------- events ----------------
document.addEventListener("click", async (e) => {
  const v = e.target.closest("[data-view]");
  if (v) { app.view = v.dataset.view; history.replaceState(null, "", `#${app.view}`); render(); window.scrollTo(0, 0); return; }
  const c = e.target.closest("[data-copy]");
  if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); toast("Copied " + short(c.dataset.copy, 6, 6)); } catch { toast(c.dataset.copy); } return; }
  const a = e.target.closest("[data-action]");
  if (a?.dataset.action === "run") runAll();
  if (a?.dataset.action === "new") newRun();
  if (a?.dataset.action === "next") $("#btnNext").click();
  if (a?.dataset.action === "pause") $("#btnPause").click();
  if (a?.dataset.action?.startsWith("ctl-")) ctlAction(a.dataset.action.slice(4));
  const pick = e.target.closest("[data-pick]");
  if (pick) {
    const u = app.ctl.units; const p = pick.dataset.pick;
    app.ctl.units = u.includes(p) ? u.filter((x) => x !== p) : [...u, p].slice(-2);
    app.ctl.quote = null; render();
  }
  const cp = e.target.closest("[data-copytext]");
  if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copytext); toast("Copied"); } catch { toast("Select the text and copy it"); } return; }
  const dec = e.target.closest("[data-decide]");
  if (dec && !dec.disabled) {
    dec.disabled = true;
    try {
      await api("POST", `/api/v1/agents/${dec.dataset.agent}/requests/${dec.dataset.req}`, { decision: dec.dataset.decide });
      toast(dec.dataset.decide === "approve" ? "Approved" : "Declined");
    } catch (err) { toast(err.message); }
    await refreshPublic(); render(); return;
  }
  const fill = e.target.closest("[data-fill]");
  if (fill) { app.ctl.receipt = fill.dataset.val; app.ctl.verify = null; render(); }
  if (a?.dataset.action === "inactive") { app.showInactive = !app.showInactive; render(); }
  if (a?.dataset.action === "manifest") {
    const m = await api("GET", `/api/demo/runs/${app.runId}/evidence`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(m, null, 2)], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `${app.runId}-manifest.json` });
    link.click(); URL.revokeObjectURL(url);
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-copy], [data-pick]")) e.target.click(); });
document.addEventListener("input", (e) => {
  const id = e.target.id; const c = app.ctl;
  if (id === "ctlMax") { c.max = e.target.value.slice(0, 20); c.quote = null; }
  if (id === "ctlReceipt") { c.receipt = e.target.value.slice(0, 64); c.verify = null; const b = $('[data-action="ctl-verify"]'); if (b) b.disabled = !c.receipt; }
});
document.addEventListener("change", (e) => {
  const c = app.ctl;
  if (e.target.id === "ctlBuyer") { c.buyer = e.target.value; c.quote = null; render(); }
  if (e.target.id === "ctlBounty") { c.bounty = e.target.value; c.bountyInfo = null; render(); }
});
document.addEventListener("submit", (e) => { if (e.target.id === "marketForm") { e.preventDefault(); app.marketQuery = $("#mq").value.slice(0, 256); render(); } });
$("#btnRun").addEventListener("click", runAll);
$("#btnNext").addEventListener("click", async () => { if (!app.run) await newRun(); else await step(); });
$("#btnPause").addEventListener("click", () => {
  if (app.paused) { app.paused = false; render(); runAll(); }
  else { app.paused = true; toast("Pausing after the current step…"); render(); }
});
$("#btnReset").addEventListener("click", newRun);
window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (VIEWS[v]) { app.view = v; render(); } });

(async function init() {
  if (!VIEWS[app.view]) app.view = "overview";
  restore();
  try {
    [app.health, app.scenes, app.connectInfo] = await Promise.all([api("GET", "/api/v1/health"), api("GET", "/api/demo/scenes"), api("GET", "/api/v1/connect").catch(() => null)]);
  } catch (e) {
    $("#statusText").textContent = "Offline";
    $("#statusMsg").textContent = `Cannot reach the local service: ${e.message}`;
    return;
  }
  if (STATIC) { app.runId = app.health.snapshot?.runId ?? null; app.token = "public"; }
  await Promise.all([refreshRun(), refreshPublic()]);
  render();
  setInterval(async () => {
    if (app.busy) return;
    await refreshRun();
    if (app.view === "connect") app.agents = (await api("GET", "/api/v1/agents").catch(() => null))?.items ?? app.agents;
    // Leave the page alone while someone is typing or selecting text in it.
    if (!document.activeElement?.matches("input, select, textarea") && !String(getSelection())) render();
  }, 5000);
})();
