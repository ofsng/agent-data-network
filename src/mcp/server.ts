// Minimal MCP stdio server: exposes the shared service's READ-ONLY tools to an external
// agent (search, quote, on-chain receipt verification, bounty status). It holds no keys,
// signs nothing and never returns paid bytes; purchases stay with the guided demo wallets.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "../config";
import { openDb } from "../data/store";
import { createService } from "../api/service";

// stdout carries the protocol; everything else goes to stderr.
console.log = console.error;

const cfg = loadConfig();
const svc = createService(cfg, openDb(cfg.dbPath));
const server = new McpServer({ name: "agent-data-network", version: "0.1.0" });

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2) }] });
const run = (f: () => unknown) => async () => {
  try {
    return json(await f());
  } catch (e: any) {
    return { ...json({ code: e.code ?? "ERROR", message: e.message ?? String(e), retryable: !!e.retryable }), isError: true };
  }
};

server.registerTool("network_status", {
  description: "Cluster, program ID, TEST mint and treasury this server reads from, plus RPC health.",
}, run(() => svc.health()));

server.registerTool("search_data", {
  description: "Free metadata search over listed data units. Returns titles, tags, prices (TEST base units), providers and trust declarations; never content. Reports a gap when no active unit carries requiredTag.",
  inputSchema: { query: z.string().max(256), requiredTag: z.string().max(64).optional(), limit: z.number().int().min(1).max(20).optional() },
}, ({ query, requiredTag, limit }) => run(() => svc.searchAssets(query, requiredTag, limit ?? 10))());

server.registerTool("get_data_quote", {
  description: "Exact quote for one or more units for a buyer wallet, after the trust preflight (finalized active terms, stored bytes equal on-chain hashes, recovery snapshot). Nothing is signed or paid.",
  inputSchema: { buyer: z.string(), assetPdas: z.array(z.string()).min(1).max(4), maxSpend: z.string().regex(/^\d+$/).describe("TEST base units (6 decimals)") },
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

server.connect(new StdioServerTransport()).then(() => console.error(`[mcp] agent-data-network on ${cfg.cluster} (${cfg.rpcUrl}) — read-only`));
