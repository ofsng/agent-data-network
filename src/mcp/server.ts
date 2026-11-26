// MCP stdio server: the whole marketplace as tools an agent can drive on its own.
// The agent sets itself up (get_started → create_wallet → fund_wallet), searches, buys
// within a human-approved allowance and retrieves what it paid for. Anything that needs a
// person (approving a large purchase, more budget, funding without an operator) is asked
// through the client's approval dialog (MCP elicitation) when the client supports it, and
// otherwise left as a pending request the human approves in the web app.
// The key stays in a 0600 file on this machine; there is no generic signing tool.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Keypair } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { existsSync } from "fs";
import { z } from "zod";
import { explorer, loadConfig } from "../config";
import { openDb } from "../data/store";
import { createService } from "../api/service";
import { ata, loadKeypair } from "../chain/adn";
import { AgentTools, TraceEntry } from "../agent/tools";
import { AgentAccount, DEFAULT_ALLOWANCE, fmtAUSD, parseAUSD } from "../agent/account";
import { agentKeyPath, ensureAgentWallet, fundAgentWallet, operatorWallets } from "../agent/connect";

// stdout carries the protocol; everything else goes to stderr.
console.log = console.error;

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const svc = createService(cfg, db);
const keyPath = process.env.ADN_AGENT_KEYPAIR?.trim() || agentKeyPath(cfg.cluster);
const APP = `http://127.0.0.1:${cfg.port}/#connect`;
const MIN_SOL = 0.01;

const INSTRUCTIONS = `Agent Data Network (ADN) is a data marketplace on Solana ${cfg.cluster}. You buy small licensed data units from providers, pay in aUSD, and every purchase gives you an on-chain license receipt.
How to work:
- Start with get_started. It tells you what is set up and the one next step. Follow it until it says READY.
- Do setup yourself (create_wallet, fund_wallet). Only ask the human for what get_started lists under askHuman.
- search_data is free and shows metadata only. Search with several keywords before buying.
- Amounts are aUSD; tool inputs take decimal strings like "0.05". Raw prices are base units: 30000 = 0.03 aUSD.
- purchase_data buys 1 or 2 units in one transaction within your allowance. Large purchases need the human's OK: the client shows them a dialog, or the result says NEEDS_APPROVAL; then tell the human in one sentence and call check_request until it is decided.
- Never buy the same unit twice; use retrieve_data on the receipt you already have.
- Cite the receipt address next to every fact you take from ADN. If no unit covers what is needed, say so; never invent data. list_bounties shows open requests for missing data.
- When your allowance runs out, call request_budget with an amount and a one-line reason.`;

const server = new McpServer({ name: "agent-data-network", version: "0.3.0" }, { instructions: INSTRUCTIONS });

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2) }] });
const fail = (code: string, message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { code, extra });

// ---------------- wallet, account and activity ----------------
let wallet: Keypair | null = existsSync(keyPath) ? loadKeypair(keyPath) : null;
const account = () => (wallet ? new AgentAccount(db, cfg.cluster, wallet.publicKey.toBase58()) : null);
// Compatibility: ADN_AGENT_CAP gives an existing wallet its first allowance (it never adds to one).
if (wallet && process.env.ADN_AGENT_CAP && !account()!.active()) account()!.addGrant(parseAUSD(process.env.ADN_AGENT_CAP), "env");
const trace: TraceEntry[] = [];
const toolsFor = (acct: AgentAccount) => new AgentTools(svc, wallet!, acct.budget()!, trace, process.env.ADN_AGENT_NAME ?? "MCP agent", {});
const txLink = (sig: string) => (cfg.cluster === "devnet" ? explorer("devnet", "tx", sig) : null);

/** Runs a tool, returns JSON, and records one line in the activity feed the human sees. */
const run = <A>(tool: string, f: (a: A) => unknown, describe?: (a: A, out: any) => string) => async (a: A) => {
  try {
    const out: any = await f(a);
    if (describe) account()?.log(tool, describe(a, out), true, out?.signature ?? out?.receiptPda);
    return json(out);
  } catch (e: any) {
    account()?.log(tool, `${e.code ?? "ERROR"}: ${e.message}`.slice(0, 200), false);
    return { ...json({ code: e.code ?? "ERROR", message: e.message ?? String(e), retryable: !!e.retryable, ...(e.extra ?? {}) }), isError: true };
  }
};

async function balances(pk = wallet!.publicKey) {
  const tokens = await getAccount(svc.connection, ata(pk, svc.mint), "confirmed").then((x) => x.amount, () => 0n);
  return { aUSD: tokens, sol: (await svc.connection.getBalance(pk, "confirmed")) / 1e9 };
}
function needWallet() {
  if (!wallet) throw fail("NO_WALLET", "No agent wallet on this machine yet. Call create_wallet.");
  const acct = account()!;
  if (!acct.active()) throw fail("NO_ALLOWANCE", "No spending allowance yet. Call request_budget with a starting amount; the human approves it.");
  return acct;
}

/** Asks the human through the client's dialog. "unsupported" when the client has no dialogs. */
async function askHuman(message: string): Promise<"approved" | "declined" | "unsupported"> {
  if (!server.server.getClientCapabilities()?.elicitation) return "unsupported";
  try {
    const r = await server.server.elicitInput({
      message,
      requestedSchema: { type: "object", properties: { approve: { type: "boolean", title: "Approve", description: "Allow the agent to do this", default: false } }, required: ["approve"] },
    }, { timeout: 10 * 60_000 });
    return r.action === "accept" && (r.content as any)?.approve === true ? "approved" : "declined";
  } catch {
    return "unsupported";
  }
}
const pendingResult = (req: { id: string; summary: string }) => ({
  status: "NEEDS_APPROVAL", requestId: req.id,
  tellHuman: `I need your OK: ${req.summary}. Approve or decline it in the ADN app: ${APP}`,
  next: "Tell the human that sentence, then call check_request with this requestId until it is APPROVED or DECLINED.",
});

// ---------------- onboarding ----------------
server.registerTool("get_started", {
  description: "Start here. Shows what is set up (network, wallet, funds, allowance, pending approvals), the single next step to take, and anything only the human can do.",
}, run("get_started", async () => {
  const h = await svc.health();
  const next: string[] = [];
  const askHuman: string[] = [];
  const out: Record<string, unknown> = { network: { cluster: cfg.cluster, programId: h.programId, mint: h.mint, rpcOk: h.rpcOk }, app: APP, approvalDialogs: !!server.server.getClientCapabilities()?.elicitation };
  if (!h.rpcOk) askHuman.push(`The ${cfg.cluster} RPC is unreachable. Ask the human to check the network or start the local validator (npm start).`);
  if (!wallet) next.push("Call create_wallet.");
  else {
    const acct = account()!;
    const b = await balances();
    const t = acct.totals();
    const pend = acct.pending();
    out.wallet = { address: wallet.publicKey.toBase58(), keyFile: keyPath, aUSD: fmtAUSD(b.aUSD), sol: b.sol };
    out.allowance = acct.active() ? { remaining: fmtAUSD(t.remaining), spent: fmtAUSD(t.spent), approvedInTotal: fmtAUSD(t.allowed), humanApprovesPurchasesAbove: fmtAUSD(t.approveAbove) } : null;
    out.pendingRequests = pend.map((r) => ({ requestId: r.id, kind: r.kind, summary: r.summary }));
    const canFund = !!operatorWallets(cfg);
    if (b.sol < MIN_SOL || b.aUSD === 0n) {
      if (canFund) next.push("Call fund_wallet.");
      else askHuman.push(`Send at least 0.5 aUSD and ${MIN_SOL * 2} SOL (${cfg.cluster}) to ${wallet.publicKey.toBase58()}. This machine has no marketplace operator keys, so it cannot fund itself.`);
    }
    if (!acct.active() && !pend.some((r) => r.kind === "BUDGET")) next.push(`Call request_budget with amount "${fmtAUSD(DEFAULT_ALLOWANCE).split(" ")[0]}" and a one-line reason.`);
    if (pend.length) next.push("Call check_request for each pending request; tell the human what is waiting.");
  }
  out.status = next.length || askHuman.length ? "SETUP" : "READY";
  out.next = next.length ? next : askHuman.length ? ["Ask the human for the items in askHuman, then call get_started again."] : ["Ready. Ask the human what data they need, or use the procurement_brief prompt."];
  out.askHuman = askHuman;
  return out;
}, (_a, o) => `Checked setup: ${o.status}`));

server.registerTool("create_wallet", {
  description: "Create this agent's Solana wallet on this machine (key file 0600, never leaves the machine). Safe to call again: an existing wallet is kept.",
}, run("create_wallet", async () => {
  const r = ensureAgentWallet(keyPath);
  wallet = r.keypair;
  return { created: r.created, address: wallet.publicKey.toBase58(), keyFile: keyPath, next: "Call get_started." };
}, (_a, o) => (o.created ? `Created wallet ${o.address}` : `Wallet already exists (${o.address})`)));

server.registerTool("fund_wallet", {
  description: "Top up this agent's wallet with aUSD and SOL for fees. Works where the marketplace operator's keys are on this machine (local or the operator's Devnet setup); otherwise it says what to ask the human.",
  inputSchema: { aUSD: z.string().optional().describe("Target aUSD balance, default \"1\", at most \"5\"") },
}, run("fund_wallet", async ({ aUSD }: { aUSD?: string }) => {
  if (!wallet) throw fail("NO_WALLET", "Call create_wallet first.");
  const target = parseAUSD(aUSD ?? "1");
  if (target > 5_000_000n) throw fail("INVALID", "fund_wallet tops up to at most 5 aUSD");
  const ops = operatorWallets(cfg);
  if (!ops) throw fail("NEEDS_HUMAN", "This machine cannot mint aUSD.", { tellHuman: `Please send ${fmtAUSD(target)} and 0.02 SOL (${cfg.cluster}) to ${wallet.publicKey.toBase58()}.` });
  const r = await fundAgentWallet(cfg, ops, target, keyPath);
  return { address: r.address, aUSD: fmtAUSD(r.balance), added: fmtAUSD(r.funded), next: "Call get_started." };
}, (_a, o) => `Wallet funded to ${o.aUSD} (+${o.added})`));

server.registerTool("request_budget", {
  description: "Ask the human for a new spending allowance. The human sees a dialog (or a pending request in the ADN app). Allowances never grow on their own.",
  inputSchema: { amount: z.string().describe("aUSD, e.g. \"0.5\""), reason: z.string().min(3).max(200) },
}, run("request_budget", async ({ amount, reason }: { amount: string; reason: string }) => {
  if (!wallet) throw fail("NO_WALLET", "Call create_wallet first.");
  const acct = account()!;
  const cap = parseAUSD(amount);
  const summary = `allow the agent to spend ${fmtAUSD(cap)} — ${reason}`;
  const answer = await askHuman(`Agent Data Network: your agent asks for a spending allowance of ${fmtAUSD(cap)}.\nReason: ${reason}`);
  if (answer === "unsupported") return pendingResult(acct.request("BUDGET", cap, summary, { reason }));
  acct.request("BUDGET", cap, summary, { reason }, answer === "approved" ? "APPROVED" : "DECLINED", "dialog");
  if (answer === "declined") return { status: "DECLINED", message: "The human declined. Do not ask again unless they tell you to." };
  const g = acct.addGrant(cap, "human:dialog");
  return { status: "APPROVED", allowance: fmtAUSD(g.cap), next: "Continue with the task." };
}, (a, o) => `Asked for ${a.amount} aUSD: ${o.status}`));

server.registerTool("check_request", {
  description: "Status of a request waiting for the human (PENDING, APPROVED, DECLINED, USED). After an approved purchase, call purchase_data again with the same units and this requestId as approvalId.",
  inputSchema: { requestId: z.string() },
}, run("check_request", async ({ requestId }: { requestId: string }) => {
  const acct = account();
  const r = acct?.get(requestId);
  if (!r) throw fail("NOT_FOUND", "unknown requestId");
  const next = r.status === "PENDING" ? "Still waiting for the human. Check again later; do not ask twice."
    : r.status === "APPROVED" && r.kind === "PURCHASE" ? `Call purchase_data with the same units and approvalId "${r.id}".`
    : r.status === "APPROVED" ? "Allowance added. Continue." : r.status === "DECLINED" ? "The human declined. Tell them you will not do it." : "Already used.";
  return { requestId: r.id, kind: r.kind, status: r.status, summary: r.summary, decidedBy: r.decidedBy, next };
}));

// ---------------- marketplace (read-only) ----------------
server.registerTool("network_status", {
  description: "Cluster, program ID, aUSD mint and treasury this server uses, plus RPC health.",
}, run("network_status", () => svc.health()));

server.registerTool("search_data", {
  description: "Free metadata search over listed data units. Returns titles, tags, prices (aUSD base units, 6 decimals), providers and trust declarations; never content. Reports a gap when no active unit carries requiredTag.",
  inputSchema: { query: z.string().max(256), requiredTag: z.string().max(64).optional(), limit: z.number().int().min(1).max(20).optional() },
}, run("search_data", ({ query, requiredTag, limit }: { query: string; requiredTag?: string; limit?: number }) => svc.searchAssets(query, requiredTag, limit ?? 10),
  (a, o) => `Searched "${a.query.slice(0, 60)}": ${o.items.length} result(s)`));

server.registerTool("get_data_quote", {
  description: "Exact quote for one or more units for a buyer wallet, after the trust preflight. Nothing is signed or paid.",
  inputSchema: { buyer: z.string(), assetPdas: z.array(z.string()).min(1).max(4), maxSpend: z.string().regex(/^\d+$/).describe("aUSD base units (6 decimals)") },
}, run("get_data_quote", ({ buyer, assetPdas, maxSpend }: { buyer: string; assetPdas: string[]; maxSpend: string }) => svc.quote(buyer, assetPdas, maxSpend, assetPdas.length > 1 ? "bundle" : "single")));

server.registerTool("verify_receipt", {
  description: "Verify a license receipt on chain: program owner, PDA derivation, buyer, mint, version, content/license hashes and the 80/20 split.",
  inputSchema: { receiptPda: z.string() },
}, run("verify_receipt", ({ receiptPda }: { receiptPda: string }) => svc.receipt(receiptPda), (a) => `Verified receipt ${a.receiptPda.slice(0, 8)}…`));

server.registerTool("list_bounties", {
  description: "Bounties on this cluster with live vault balances and status (OPEN, ACCEPTED, REFUNDED). Public requirements never contain the answer.",
  inputSchema: { status: z.enum(["OPEN", "ACCEPTED", "REFUNDED"]).optional() },
}, run("list_bounties", ({ status }: { status?: "OPEN" | "ACCEPTED" | "REFUNDED" }) => svc.listBounties(status ?? null)));

server.registerTool("get_bounty_status", {
  description: "One bounty: reward, deadline, vault balance, submissions and status.",
  inputSchema: { bountyPda: z.string() },
}, run("get_bounty_status", ({ bountyPda }: { bountyPda: string }) => svc.getBounty(bountyPda)));

// ---------------- the agent's own wallet ----------------
server.registerTool("wallet_status", {
  description: "This agent's wallet: address, aUSD and SOL balances, allowance (spent, remaining, approval threshold), past purchases and pending requests.",
}, run("wallet_status", async () => {
  const acct = needWallet();
  const b = await balances();
  const t = acct.totals();
  return {
    address: wallet!.publicKey.toBase58(), cluster: cfg.cluster, balance: { aUSD: fmtAUSD(b.aUSD), sol: b.sol },
    cap: fmtAUSD(acct.active()!.cap), spent: fmtAUSD(t.spent), remaining: fmtAUSD(t.remaining), humanApprovesAbove: fmtAUSD(t.approveAbove),
    purchases: t.purchases, pendingRequests: acct.pending().map((r) => ({ requestId: r.id, summary: r.summary })),
  };
}));

server.registerTool("purchase_data", {
  description: "Buy one or two data units in a single Solana transaction from this agent's wallet. Quotes with the trust preflight, checks the allowance, gets the human's OK when the total is above the approval threshold, signs, waits for finality and verifies each receipt on chain. Returns receipt addresses; call retrieve_data to read the content.",
  inputSchema: {
    assetPdas: z.array(z.string()).min(1).max(2).describe("assetPda values from search_data"),
    maxSpend: z.string().optional().describe("Upper limit in aUSD, e.g. \"0.06\". Defaults to the remaining allowance."),
    approvalId: z.string().optional().describe("requestId of an APPROVED purchase request (after NEEDS_APPROVAL)"),
  },
}, run("purchase_data", async ({ assetPdas, maxSpend, approvalId }: { assetPdas: string[]; maxSpend?: string; approvalId?: string }) => {
  const acct = needWallet();
  const t = acct.totals();
  if (t.remaining === 0n) throw fail("BUDGET", "The allowance is used up. Call request_budget with an amount and a one-line reason.");
  const limit = maxSpend ? parseAUSD(maxSpend) : t.remaining;
  if (limit > t.remaining) throw fail("BUDGET", `maxSpend ${fmtAUSD(limit)} exceeds the remaining allowance ${fmtAUSD(t.remaining)}. Call request_budget if the human should allow more.`);
  const kind = assetPdas.length > 1 ? "bundle" : "single";
  let q = await svc.quote(wallet!.publicKey.toBase58(), assetPdas, limit.toString(), kind);
  const total = BigInt(q.total);
  const units = [...assetPdas].sort();
  if (total > t.approveAbove) {
    const what = `buy ${q.items.map((i) => `"${i.title}"`).join(" and ")} for ${fmtAUSD(total)}`;
    if (approvalId) {
      const r = acct.get(approvalId);
      if (!r || r.kind !== "PURCHASE" || r.status !== "APPROVED") throw fail("NOT_APPROVED", `request ${approvalId} is ${r?.status ?? "unknown"}; call check_request`);
      if (JSON.stringify(r.payload.units) !== JSON.stringify(units) || total > BigInt(r.amount)) throw fail("NOT_APPROVED", "the approved request was for other units or a lower amount");
      acct.use(r.id);
    } else {
      const answer = await askHuman(`Agent Data Network: your agent wants to ${what}.\nRemaining allowance after this: ${fmtAUSD(t.remaining - total)}.`);
      if (answer === "unsupported") return pendingResult(acct.request("PURCHASE", total, what, { units }));
      acct.request("PURCHASE", total, what, { units }, answer === "approved" ? "USED" : "DECLINED", "dialog");
      if (answer === "declined") return { status: "DECLINED", message: "The human declined this purchase. Do not buy it." };
      q = await svc.quote(wallet!.publicKey.toBase58(), assetPdas, limit.toString(), kind); // the first quote may have expired while waiting
    }
  }
  const tools = toolsFor(acct);
  const quote = await tools.get_data_quote(assetPdas, limit, kind);
  if (BigInt(quote.total) > total) throw fail("PRICE_CHANGED", `price changed from ${fmtAUSD(total)} to ${fmtAUSD(quote.total)}; nothing was bought`);
  const sent = await tools.purchase_data(quote);
  const settled = await tools.settle_purchase(quote.orderId, sent.signature, sent.solBefore);
  const receipts = [];
  for (const [i, receiptPda] of sent.receipts.entries()) {
    const r = await tools.verify_receipt(receiptPda);
    receipts.push({ receiptPda, title: quote.items[i].title, assetPda: quote.items[i].assetPda, amount: fmtAUSD(r.amount), providerAmount: fmtAUSD(r.providerAmount), platformAmount: fmtAUSD(r.platformAmount), contentHash: r.contentHash });
  }
  return { status: "FINALIZED", orderId: quote.orderId, total: fmtAUSD(quote.total), signature: sent.signature, explorer: txLink(sent.signature), slot: settled.slot, receipts, remainingAllowance: fmtAUSD(acct.totals().remaining) };
}, (_a, o) => (o.status === "FINALIZED" ? `Bought ${o.receipts.map((r: any) => r.title).join(" + ")} for ${o.total}` : `Purchase ${o.status.toLowerCase().replace("_", " ")}`)));

server.registerTool("retrieve_data", {
  description: "Fetch the licensed content for a receipt this wallet owns. Signs a one-time challenge with the wallet, receives the exact bytes and checks them against the hashes in the receipt.",
  inputSchema: { receiptPda: z.string() },
}, run("retrieve_data", async ({ receiptPda }: { receiptPda: string }) => {
  const acct = needWallet();
  const r = await toolsFor(acct).retrieve_data(receiptPda);
  return { receiptPda, content: r.body, bytes: r.bytes, contentHash: r.contentHash, licenseHash: r.licenseHash, hashVerified: true };
}, (a) => `Retrieved content for receipt ${a.receiptPda.slice(0, 8)}…`));

// ---------------- prompts (slash commands in clients that support them) ----------------
server.registerPrompt("get_started", {
  title: "Set up Agent Data Network",
  description: "Let the agent set itself up and tell you what it needs from you.",
}, () => ({ messages: [{ role: "user", content: { type: "text", text: "Set yourself up on Agent Data Network: call get_started and follow its next steps until it says READY. Do the setup yourself and only ask me for what it lists under askHuman. Then tell me in three short lines: your wallet, your allowance, and what you can do for me." } }] }));

server.registerPrompt("procurement_brief", {
  title: "Procurement brief from licensed data",
  description: "Research a product from paid, receipt-backed data units.",
  argsSchema: { product: z.string().describe("Product or part, e.g. Voltara X100 inverter"), budget: z.string().optional().describe("aUSD limit, e.g. 0.1") },
}, ({ product, budget }) => ({ messages: [{ role: "user", content: { type: "text", text: `Write me a short procurement brief for ${product}: specs, current stock and lead time, and certificates. Use Agent Data Network: search first, buy only the units you need${budget ? ` for at most ${budget} aUSD` : ""}, verify the receipts and cite a receipt next to every fact. If something is not available, say so and check list_bounties.` } }] }));

server.connect(new StdioServerTransport()).then(() =>
  console.error(`[mcp] agent-data-network on ${cfg.cluster} (${cfg.rpcUrl}); wallet ${wallet ? wallet.publicKey.toBase58() : "not created yet"}`),
);
