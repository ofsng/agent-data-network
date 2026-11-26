// T54: the MCP server speaks the protocol to a real MCP client. Before any wallet exists it
// guides the agent (get_started → create_wallet), wallet tools refuse, read-only tools work
// and leak no paid bytes. T55: an agent sets itself up end to end: creates and funds its
// wallet, asks the human for an allowance (approved in the web app), buys within it, needs
// the human's OK above the threshold (declined in the web app, approved in a client dialog)
// and retrieves exact bytes. Every step shows in the activity feed the web app reads.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { AddressInfo } from "net";
import { mkdtempSync, readFileSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { expect } from "chai";
import { ROOT, loadConfig } from "../../src/config";
import { openDb } from "../../src/data/store";
import { createApp } from "../../src/api/server";
import { AgentAccount } from "../../src/agent/account";
import { manifestPath } from "../../src/demo/orchestrator";

const spawnServer = async (client: Client, keyPath: string) =>
  client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", join(ROOT, "src/mcp/server.ts")], cwd: ROOT, env: { ...process.env, ADN_AGENT_KEYPAIR: keyPath } as Record<string, string>, stderr: "ignore" }));
const caller = (client: Client) => async (name: string, args: Record<string, unknown> = {}) => {
  const r: any = await client.callTool({ name, arguments: args });
  return { error: !!r.isError, body: JSON.parse(r.content.map((c: any) => c.text).join("")) };
};

describe("mcp (T54)", () => {
  const m = JSON.parse(readFileSync(manifestPath(process.env.SOLANA_CLUSTER ?? "localnet"), "utf8"));
  const client = new Client({ name: "adn-test", version: "0.0.0" });
  const call = caller(client);

  before(() => spawnServer(client, join(mkdtempSync(join(tmpdir(), "adn-mcp-")), "agent.json")));
  after(() => client.close());

  it("T54 MCP: guides setup, no generic signing tool, wallet tools refuse without a wallet, read-only tools leak nothing", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).to.include.members(["get_started", "create_wallet", "fund_wallet", "request_budget", "check_request", "search_data", "purchase_data", "retrieve_data", "verify_receipt"]);
    expect(tools.some((t) => /sign|transfer|send/.test(t))).to.equal(false);
    expect((await client.listPrompts()).prompts.map((p) => p.name)).to.include.members(["get_started", "procurement_brief"]);
    expect(client.getInstructions()).to.match(/Start with get_started/);

    const start = (await call("get_started")).body;
    expect(start.status).to.equal("SETUP");
    expect(start.next[0]).to.match(/create_wallet/);
    const refused = await call("purchase_data", { assetPdas: [m.receipts[0].asset] });
    expect([refused.error, refused.body.code]).to.deep.equal([true, "NO_WALLET"]);

    const status = (await call("network_status")).body;
    expect([status.programId, status.rpcOk]).to.deep.equal([m.programId, true]);
    const search = await call("search_data", { query: "inverter x100 efficiency" });
    expect(search.body.items.length).to.be.greaterThan(0);
    const r = m.receipts[0];
    const verified = (await call("verify_receipt", { receiptPda: r.pda })).body;
    expect([verified.buyer, verified.contentHash]).to.deep.equal([r.buyer, r.contentHash]);
    expect((await call("verify_receipt", { receiptPda: "not-a-key" })).error).to.equal(true);

    const answer = JSON.parse(readFileSync(join(ROOT, "fixtures", "bounty.json"), "utf8")).solution.recycling_certificate;
    const all = JSON.stringify(search.body) + JSON.stringify(verified) + JSON.stringify((await call("list_bounties")).body);
    expect(all).to.not.include(answer);
    expect(all).to.not.match(/Peak efficiency|Standard lead time 5 business days/i);
  });
});

describe("mcp agent onboarding and approvals (T55)", () => {
  const cfg = loadConfig();
  const keyPath = join(mkdtempSync(join(tmpdir(), "adn-agent-")), "agent.json");
  const agent = new Client({ name: "adn-agent-no-dialogs", version: "0.0.0" });
  const withDialogs = new Client({ name: "adn-agent-dialogs", version: "0.0.0" }, { capabilities: { elicitation: {} } });
  const asked: string[] = [];
  withDialogs.setRequestHandler(ElicitRequestSchema, async (req) => { asked.push(String(req.params.message)); return { action: "accept", content: { approve: true } }; });
  const call = caller(agent);
  const db = openDb(cfg.dbPath);
  const web = createApp(cfg, db, { demo: false });
  let base = "";
  const decide = (buyer: string, id: string, decision: string, origin = true) =>
    fetch(`${base}/api/v1/agents/${buyer}/requests/${id}`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin: base } : {}) }, body: JSON.stringify({ decision }) });

  before(async function () {
    if (cfg.cluster !== "localnet") this.skip();
    await new Promise<void>((r) => web.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`;
    await spawnServer(agent, keyPath);
  });
  after(async () => {
    await agent.close(); await withDialogs.close(); web.close();
    // The throwaway test wallet should not show up in the app's agent list.
    const buyer = (await import("../../src/chain/adn")).loadKeypair(keyPath).publicKey.toBase58();
    for (const t of ["agent_grants", "agent_requests", "agent_activity"]) db.prepare(`DELETE FROM ${t} WHERE cluster=? AND buyer=?`).run(cfg.cluster, buyer);
  });

  it("T55 MCP: agent sets itself up, human approves budget and big purchases, buys within the allowance, retrieves exact bytes", async () => {
    // Setup driven by the agent alone.
    const created = (await call("create_wallet")).body;
    expect(created.created).to.equal(true);
    expect(statSync(keyPath).mode & 0o777).to.equal(0o600);
    expect((await call("create_wallet")).body.created).to.equal(false);
    const buyer: string = created.address;
    expect((await call("fund_wallet", { aUSD: "0.5" })).body.aUSD).to.equal("0.5 aUSD");
    expect((await call("get_started")).body.next[0]).to.match(/request_budget/);

    // No dialogs in this client: the budget request waits for the human in the web app.
    const ask = (await call("request_budget", { amount: "0.2", reason: "procurement research" })).body;
    expect(ask.status).to.equal("NEEDS_APPROVAL");
    expect((await decide(buyer, ask.requestId, "approve", false)).status).to.equal(403); // not from the browser
    expect((await decide(buyer, ask.requestId, "approve")).status).to.equal(200);
    expect((await call("check_request", { requestId: ask.requestId })).body.status).to.equal("APPROVED");
    expect((await call("get_started")).body.status).to.equal("READY");

    const units = (await call("search_data", { query: "inverter x100 efficiency lead time" })).body.items;
    const spec = units.find((u: any) => /datasheet/.test(u.title));
    const stock = units.find((u: any) => /lead time/.test(u.title));
    const over = await call("purchase_data", { assetPdas: [spec.assetPda], maxSpend: "0.3" });
    expect([over.error, over.body.code]).to.deep.equal([true, "BUDGET"]);

    // Under the 0.1 threshold: no human needed.
    const bought = await call("purchase_data", { assetPdas: [spec.assetPda], maxSpend: "0.03" });
    expect(bought.body.status, JSON.stringify(bought.body)).to.equal("FINALIZED");
    const got = (await call("retrieve_data", { receiptPda: bought.body.receipts[0].receiptPda })).body;
    expect(got.content).to.include("Peak efficiency 97.6%");
    expect(got.contentHash).to.equal(bought.body.receipts[0].contentHash);

    // The human lowers the threshold to 0.02 (as `npm run connect --approve-above 0.02` would).
    new AgentAccount(db, cfg.cluster, buyer).addGrant(150_000n, "cli", 20_000n);
    const held = (await call("purchase_data", { assetPdas: [stock.assetPda], maxSpend: "0.03" })).body;
    expect(held.status).to.equal("NEEDS_APPROVAL");
    expect((await decide(buyer, held.requestId, "decline")).status).to.equal(200);
    expect((await call("check_request", { requestId: held.requestId })).body.status).to.equal("DECLINED");
    const reuse = await call("purchase_data", { assetPdas: [stock.assetPda], maxSpend: "0.03", approvalId: held.requestId });
    expect([reuse.error, reuse.body.code]).to.deep.equal([true, "NOT_APPROVED"]);

    // A client with approval dialogs: the human approves in the dialog and the purchase goes through.
    await spawnServer(withDialogs, keyPath);
    const viaDialog = await caller(withDialogs)("purchase_data", { assetPdas: [stock.assetPda], maxSpend: "0.03" });
    expect(viaDialog.body.status, JSON.stringify(viaDialog.body)).to.equal("FINALIZED");
    expect(asked).to.have.length(1);
    expect(asked[0]).to.match(/lead time.*0\.03 aUSD/s);

    // The web app shows the agent, its allowance and what it did.
    const view = (await (await fetch(`${base}/api/v1/agents`)).json()).items.find((a: any) => a.address === buyer);
    expect(view.pending).to.have.length(0);
    expect(view.allowance.spent).to.equal("60000");
    expect(view.activity.map((x: any) => x.tool)).to.include.members(["create_wallet", "fund_wallet", "request_budget", "approval", "purchase_data", "retrieve_data"]);
    expect(JSON.stringify(view)).to.not.match(/Peak efficiency/);
  });
});
