// Local operator CLI (reproducibility interface). Usage: npm run cli -- <command>
import { connect, loadConfig } from "./config";
import { bootstrap, wallets } from "./chain/ops";
import { openDb, search } from "./data/store";
import { createService } from "./api/service";
import { DemoOrchestrator, manifestPath } from "./demo/orchestrator";
import { relative } from "path";
import { spawnSync } from "child_process";
import { ROOT } from "./config";
import { agentKeyPath, ensureAgentWallet, fundAgentWallet, mcpLaunch, operatorWallets } from "./agent/connect";
import { AgentAccount, DEFAULT_ALLOWANCE, DEFAULT_APPROVE_ABOVE, fmtAUSD, parseAUSD } from "./agent/account";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  let cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  // Operator keys exist only on the marketplace operator's machine; agent commands work without them.
  const w = () => wallets(cfg);
  console.log(`[${cfg.cluster}] program ${cfg.programId.toBase58()} rpc ${cfg.rpcUrl.replace(/api-key=[^&]+/, "api-key=***")}`);

  switch (cmd) {
    case "bootstrap": {
      const mint = await bootstrap(cfg, connect(cfg, "confirmed"), w());
      console.log(`mint ${mint.toBase58()} (aUSD, 6 decimals); deployment saved to ${cfg.deploymentPath}`);
      break;
    }
    case "search": {
      const tagIdx = args.indexOf("--tag");
      const tag = tagIdx >= 0 ? args.splice(tagIdx, 2)[1] : undefined;
      console.log(JSON.stringify(search(db, args.join(" "), tag), null, 2));
      break;
    }
    case "demo": {
      // Same orchestrator as the browser: new isolated run, every step on the real chain.
      cfg = loadConfig();
      const orch = new DemoOrchestrator(createService(cfg, db), w());
      const { runId, state } = await orch.createRun();
      if (state.status === "error") throw new Error(state.error!.message);
      console.log(`run ${runId} (${state.mode})`);
      const s = await orch.runAll(runId, (m) => console.log("  " + m));
      console.log(`evidence -> evidence/runs/${runId}.json and ${relative(ROOT, manifestPath(cfg.cluster))} (${s.status})`);
      break;
    }
    case "agent-wallet":
    case "connect": {
      // One command for a person or an agent: wallet on this machine, funding where the
      // operator keys are present, a starting allowance, and the "adn" MCP server in Claude Code.
      // Safe to re-run: the wallet is kept and only missing funds are added.
      const flag = (name: string, d?: string) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d; };
      const allowanceArg = flag("--allowance") ?? flag("--cap");
      const approveAbove = parseAUSD(flag("--approve-above", "0.1")!);
      const target = parseAUSD(args[0] ?? "1");
      const path = agentKeyPath(cfg.cluster);
      const { keypair } = ensureAgentWallet(path);
      const ops = operatorWallets(cfg);
      const funded = ops ? await fundAgentWallet(cfg, ops, target, path) : null;
      const acct = new AgentAccount(db, cfg.cluster, keypair.publicKey.toBase58());
      if (!acct.active() || allowanceArg) acct.addGrant(allowanceArg ? parseAUSD(allowanceArg) : DEFAULT_ALLOWANCE, acct.active() ? "cli" : "setup", approveAbove ?? DEFAULT_APPROVE_ABOVE);
      const t = acct.totals();
      console.log(`wallet     ${keypair.publicKey.toBase58()} (key ${path}, stays on this machine)`);
      console.log(funded ? `funds      ${fmtAUSD(funded.balance)}${funded.funded ? ` (+${fmtAUSD(funded.funded)})` : ""} and SOL for fees` : `funds      none added: this machine has no operator keys. Send aUSD and 0.02 SOL to the wallet above.`);
      console.log(`allowance  ${fmtAUSD(t.remaining)} left; purchases above ${fmtAUSD(t.approveAbove)} ask you first`);
      const m = mcpLaunch(cfg.cluster);
      const addArgs = ["mcp", "add", "adn", "--scope", "user", ...Object.entries(m.env).flatMap(([k, v]) => ["--env", `${k}=${v}`]), "--", m.command, ...m.args];
      let registered = false;
      if (cmd === "connect") {
        spawnSync("claude", ["mcp", "remove", "adn", "--scope", "user"], { stdio: "ignore" });
        registered = spawnSync("claude", addArgs, { encoding: "utf8" }).status === 0;
      }
      if (registered) console.log(`mcp        "adn" registered in Claude Code (user scope)`);
      else {
        console.log(`\nClaude Code:\n  claude ${addArgs.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
        console.log(`\nClaude Desktop / Cursor (mcpServers):\n${JSON.stringify({ adn: m }, null, 2)}`);
      }
      console.log(`\nNEXT: reload MCP servers (Claude Code: /mcp, or open a new session), then call the adn tool get_started.`);
      console.log(`Watch and approve: http://127.0.0.1:${cfg.port}/#connect (npm start)`);
      break;
    }
    case "allow": {
      // A human grants the agent wallet on this machine a new allowance.
      const acct = new AgentAccount(db, cfg.cluster, ensureAgentWallet(agentKeyPath(cfg.cluster)).keypair.publicKey.toBase58());
      const g = acct.addGrant(parseAUSD(args[0] ?? "0.5"), "cli");
      console.log(`new allowance ${fmtAUSD(g.cap)} for ${acct.buyer}; remaining ${fmtAUSD(acct.totals().remaining)}`);
      break;
    }
    default:
      console.log("commands: bootstrap | search <q> [--tag t] | demo | connect [fund aUSD] [--allowance aUSD] [--approve-above aUSD] | allow <aUSD>");
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message ?? e);
  process.exit(1);
});
