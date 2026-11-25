// T54: the MCP stdio server speaks the protocol to a real MCP client, exposes only
// read-only tools, verifies a receipt from the last run on chain and leaks no paid bytes.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "fs";
import { join } from "path";
import { expect } from "chai";
import { ROOT } from "../../src/config";
import { manifestPath } from "../../src/demo/orchestrator";

describe("mcp (T54)", () => {
  const m = JSON.parse(readFileSync(manifestPath(process.env.SOLANA_CLUSTER ?? "localnet"), "utf8"));
  const client = new Client({ name: "adn-test", version: "0.0.0" });
  const text = (r: any) => r.content.map((c: any) => c.text).join("");

  before(async () => {
    await client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", join(ROOT, "src/mcp/server.ts")], cwd: ROOT, stderr: "ignore" }));
  });
  after(() => client.close());

  it("T54 MCP: read-only tool list, search, on-chain receipt verification, no paid content", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).to.deep.equal(["get_bounty_status", "get_data_quote", "list_bounties", "network_status", "search_data", "verify_receipt"]);
    expect(tools.some((t) => /purchase|sign|retrieve|deliver/.test(t))).to.equal(false);

    const status = JSON.parse(text(await client.callTool({ name: "network_status", arguments: {} })));
    expect(status.programId).to.equal(m.programId);
    expect(status.rpcOk).to.equal(true);

    const search = text(await client.callTool({ name: "search_data", arguments: { query: "inverter x100 efficiency" } }));
    expect(JSON.parse(search).items.length).to.be.greaterThan(0);

    const r = m.receipts[0];
    const verified = JSON.parse(text(await client.callTool({ name: "verify_receipt", arguments: { receiptPda: r.pda } })));
    expect(verified.buyer).to.equal(r.buyer);
    expect(verified.contentHash).to.equal(r.contentHash);

    const bad = await client.callTool({ name: "verify_receipt", arguments: { receiptPda: "not-a-key" } });
    expect(bad.isError).to.equal(true);

    // Paid bytes and the bounty answer never appear in any read-only response.
    const answer = JSON.parse(readFileSync(join(ROOT, "fixtures", "bounty.json"), "utf8")).solution.recycling_certificate;
    const all = search + JSON.stringify(verified) + text(await client.callTool({ name: "list_bounties", arguments: {} }));
    expect(all).to.not.include(answer);
    expect(all).to.not.match(/Peak efficiency|lead time 5 business days/i);
  });
});
