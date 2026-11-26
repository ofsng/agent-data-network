// MCP stdio server for external agents (Claude, Cursor, any MCP client). Without a wallet it
// exposes read-only tools (search, quote, on-chain receipt verification, bounty status).
// With ADN_AGENT_KEYPAIR set it also exposes wallet_status, purchase_data and retrieve_data:
// the key is read from the agent owner's own machine, signing happens in this process, and
// every purchase is reserved against a durable spending cap (ADN_AGENT_CAP, aUSD) first.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAccount } from "@solana/spl-token";
import { z } from "zod";
import { explorer, loadConfig } from "../config";
import { openDb } from "../data/store";
import { createService } from "../api/service";
import { ata, loadKeypair } from "../chain/adn";
import { RunBudget } from "../agent/budget";
import { AgentTools, TraceEntry } from "../agent/tools";

// stdout carries the protocol; everything else goes to stderr.
console.log = console.error;

const cfg = loadConfig();
const svc = createService(cfg, openDb(cfg.dbPath));
const server = new McpServer({ name: "agent-data-network", version: "0.2.0" });

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2) }] });
const run = (f: () => unknown) => async () => {
  try {
    return json(await f());
  } catch (e: any) {
    return { ...json({ code: e.code ?? "ERROR", message: e.message ?? String(e), retryable: !!e.retryable }), isError: true };
  }
};
const toBase = (v: string) => {
  const m = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(v.trim());
  if (!m) throw new Error(`not an aUSD amount: ${v}`);
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
};
const aUSD = (base: bigint | string) => `${(Number(base) / 1e6).toFixed(6).replace(/\.?0+$/, "")} aUSD`;

server.registerTool("network_status", {
  description: "Cluster, program ID, aUSD mint and treasury this server reads from, plus RPC health.",
}, run(() => svc.health()));

server.registerTool("search_data", {
  description: "Free metadata search over listed data units. Returns titles, tags, prices (aUSD base units, 6 decimals), providers and trust declarations; never content. Reports a gap when no active unit carries requiredTag.",
  inputSchema: { query: z.string().max(256), requiredTag: z.string().max(64).optional(), limit: z.number().int().min(1).max(20).optional() },
}, ({ query, requiredTag, limit }) => run(() => svc.searchAssets(query, requiredTag, limit ?? 10))());

server.registerTool("get_data_quote", {
  description: "Exact quote for one or more units for a buyer wallet, after the trust preflight (finalized active terms, stored bytes equal on-chain hashes, recovery snapshot). Nothing is signed or paid.",
  inputSchema: { buyer: z.string(), assetPdas: z.array(z.string()).min(1).max(4), maxSpend: z.string().regex(/^\d+$/).describe("aUSD base units (6 decimals)") },
}, ({ buyer, assetPdas, maxSpend }) => run(() => svc.quote(buyer, assetPdas, maxSpend, assetPdas.length > 1 ? "bundle" : "single"))());

server.registerTool("verify_receipt", {
  description: "Verify a license receipt account on chain at finalized commitment: program owner, PDA derivation, buyer, mint, version, content/license hashes and the 80/20 split.",
  inputSchema: { receiptPda: z.string() },
}, ({ receiptPda }) => run(() => svc.receipt(receiptPda))());

server.registerTool("list_bounties", {
  description: "Bounties on this cluster with live vault balances and status (OPEN, ACCEPTED, REFUNDED). Public requirements never contain the answer.",
  inputSchema: { status: z.enum(["OPEN", "ACCEPTED", "REFUNDED"]).optional() },
}, ({ status }) => run(() => svc.listBounties(status ?? null))());

server.registerTool("get_bounty_status", {
  description: "One bounty: reward, deadline, vault balance, submissions and status.",
  inputSchema: { bountyPda: z.string() },
}, ({ bountyPda }) => run(() => svc.getBounty(bountyPda))());

// ---------------- agent wallet (opt-in) ----------------
const keyPath = process.env.ADN_AGENT_KEYPAIR?.trim();
if (keyPath) {
  const wallet = loadKeypair(keyPath);
  const buyer = wallet.publicKey.toBase58();
  const tokenCap = toBase(process.env.ADN_AGENT_CAP ?? "0.5");
  const solCap = BigInt(Math.round(Number(process.env.ADN_AGENT_SOL_CAP ?? "0.05") * 1e9));
  // The policy is fixed per wallet and cap: restarting the server keeps what was already spent.
  const budget = new RunBudget(svc.db, {
    runId: `mcp:${cfg.cluster}:${buyer}:${tokenCap}:${solCap}`, role: "mcpAgent", buyer, tokenCap, solCap, maxBounties: 0, expiresAt: 4_102_444_800,
  });
  const trace: TraceEntry[] = [];
  const tools = new AgentTools(svc, wallet, budget, trace, process.env.ADN_AGENT_NAME ?? "MCP agent", {});
  const tx = (sig: string) => (cfg.cluster === "devnet" ? explorer("devnet", "tx", sig) : null);

  server.registerTool("wallet_status", {
    description: "This agent's wallet: address, aUSD and SOL balances, spending cap, amount spent and remaining, and past purchase intents.",
  }, run(async () => {
    const b = budget.summary();
    const tokens = await getAccount(svc.connection, ata(wallet.publicKey, svc.mint), "confirmed").then((a) => a.amount, () => 0n);
    return {
      address: buyer, cluster: cfg.cluster,
      balance: { aUSD: aUSD(tokens), sol: (await svc.connection.getBalance(wallet.publicKey, "confirmed")) / 1e9 },
      cap: aUSD(b.tokenCap), spent: aUSD(b.tokensSpent), remaining: aUSD(b.tokensRemaining), intents: b.intents,
    };
  }));

  server.registerTool("purchase_data", {
    description: "Buy one or two data units in a single Solana transaction from this agent's wallet. Quotes with the trust preflight, reserves the amount against the spending cap, signs, waits for finality and verifies each license receipt on chain. Returns receipt addresses; call retrieve_data to read the content.",
    inputSchema: {
      assetPdas: z.array(z.string()).min(1).max(2).describe("assetPda values from search_data"),
      maxSpend: z.string().optional().describe("Upper limit for this purchase in aUSD, e.g. \"0.06\". Defaults to the remaining cap."),
    },
  }, ({ assetPdas, maxSpend }) => run(async () => {
    const remaining = BigInt(budget.summary().tokensRemaining);
    const limit = maxSpend ? toBase(maxSpend) : remaining;
    if (limit > remaining) throw Object.assign(new Error(`maxSpend ${aUSD(limit)} exceeds the remaining cap ${aUSD(remaining)}`), { code: "BUDGET" });
    const q = await tools.get_data_quote(assetPdas, limit, assetPdas.length > 1 ? "bundle" : "single");
    const sent = await tools.purchase_data(q);
    const settled = await tools.settle_purchase(q.orderId, sent.signature, sent.solBefore);
    const receipts = [];
    for (const [i, receiptPda] of sent.receipts.entries()) {
      const r = await tools.verify_receipt(receiptPda);
      receipts.push({ receiptPda, title: q.items[i].title, assetPda: q.items[i].assetPda, amount: aUSD(r.amount), providerAmount: aUSD(r.providerAmount), platformAmount: aUSD(r.platformAmount), contentHash: r.contentHash });
    }
    const b = budget.summary();
    return { status: "FINALIZED", orderId: q.orderId, total: aUSD(q.total), signature: sent.signature, explorer: tx(sent.signature), slot: settled.slot, receipts, remainingCap: aUSD(b.tokensRemaining) };
  })());

  server.registerTool("retrieve_data", {
    description: "Fetch the licensed content for a receipt this wallet owns. Signs a one-time challenge with the wallet, receives the exact bytes and checks them against the content and license hashes in the receipt.",
    inputSchema: { receiptPda: z.string() },
  }, ({ receiptPda }) => run(async () => {
    const r = await tools.retrieve_data(receiptPda);
    return { receiptPda, content: r.body, bytes: r.bytes, contentHash: r.contentHash, licenseHash: r.licenseHash, hashVerified: true };
  })());
}

server.connect(new StdioServerTransport()).then(() =>
  console.error(`[mcp] agent-data-network on ${cfg.cluster} (${cfg.rpcUrl}) — ${keyPath ? "wallet enabled" : "read-only"}`),
);
