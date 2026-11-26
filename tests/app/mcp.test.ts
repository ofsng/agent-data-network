// T54: the MCP stdio server speaks the protocol to a real MCP client. Without a wallet it
// exposes only read-only tools, verifies a receipt from the last run on chain and leaks no
// paid bytes. T55: with an agent wallet it buys within its cap and retrieves exact bytes.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { expect } from "chai";
import { ROOT, connect, loadConfig } from "../../src/config";
import { waitFinalized, wallets } from "../../src/chain/ops";
import { ata } from "../../src/chain/adn";
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
    expect(all).to.not.match(/Peak efficiency|Standard lead time 5 business days/i);
  });
});

describe("mcp agent wallet (T55)", () => {
  const cfg = loadConfig();
  const w = wallets(cfg);
  const conn = connect(cfg, "confirmed");
  const kp = Keypair.generate();
  const client = new Client({ name: "adn-test-wallet", version: "0.0.0" });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    return { error: !!r.isError, body: JSON.parse(r.content.map((c: any) => c.text).join("")) };
  };

  before(async function () {
    if (cfg.cluster !== "localnet") this.skip();
    const dir = mkdtempSync(join(tmpdir(), "adn-mcp-"));
    writeFileSync(join(dir, "agent.json"), JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
    await conn.confirmTransaction(await conn.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL), "confirmed");
    await getOrCreateAssociatedTokenAccount(conn, w.deployer, cfg.mint!, kp.publicKey, false, "confirmed", { commitment: "confirmed" });
    // Purchases simulate at finalized commitment, so the funding must be final first.
    await waitFinalized(conn, await mintTo(conn, w.deployer, cfg.mint!, ata(kp.publicKey, cfg.mint!), w.deployer, 200_000n, [], { commitment: "confirmed" }));
    const env = { ...process.env, ADN_AGENT_KEYPAIR: join(dir, "agent.json"), ADN_AGENT_CAP: "0.05" } as Record<string, string>;
    await client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", join(ROOT, "src/mcp/server.ts")], cwd: ROOT, env, stderr: "ignore" }));
  });
  after(() => client.close());

  it("T55 MCP wallet: cap enforced before signing, purchase finalizes, receipt verifies, exact bytes retrieved", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).to.include.members(["wallet_status", "purchase_data", "retrieve_data"]);
    expect(tools.some((t) => /sign|transfer/.test(t))).to.equal(false);

    const units = (await call("search_data", { query: "inverter x100 efficiency lead time" })).body.items;
    const spec = units.find((u: any) => /datasheet/.test(u.title));
    const stock = units.find((u: any) => /lead time/.test(u.title));
    // 0.06 aUSD for both is over the 0.05 cap: refused, nothing signed or reserved.
    const over = await call("purchase_data", { assetPdas: [spec.assetPda, stock.assetPda] });
    expect(over.error).to.equal(true);
    expect((await call("wallet_status")).body.spent).to.equal("0 aUSD");

    const bought = await call("purchase_data", { assetPdas: [spec.assetPda], maxSpend: "0.03" });
    expect(bought.error, JSON.stringify(bought.body)).to.equal(false);
    expect(bought.body.status).to.equal("FINALIZED");
    const receipt = bought.body.receipts[0];
    expect(receipt.amount).to.equal("0.03 aUSD");

    const got = await call("retrieve_data", { receiptPda: receipt.receiptPda });
    expect(got.body.content).to.include("Peak efficiency 97.6%");
    expect(got.body.contentHash).to.equal(receipt.contentHash);
    const status = (await call("wallet_status")).body;
    expect([status.spent, status.remaining]).to.deep.equal(["0.03 aUSD", "0.02 aUSD"]);
  });
});
