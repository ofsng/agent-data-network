// Local operator CLI (reproducibility interface). Usage: npm run cli -- <command>
import { connect, loadConfig } from "./config";
import { bootstrap, wallets } from "./chain/ops";
import { openDb, search } from "./data/store";
import { createService } from "./api/service";
import { DemoOrchestrator, manifestPath } from "./demo/orchestrator";
import { relative } from "path";
import { spawnSync } from "child_process";
import { ROOT } from "./config";
import { fundAgentWallet, mcpLaunch } from "./agent/connect";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  let cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const w = wallets(cfg);
  console.log(`[${cfg.cluster}] program ${cfg.programId.toBase58()} rpc ${cfg.rpcUrl.replace(/api-key=[^&]+/, "api-key=***")}`);

  switch (cmd) {
    case "bootstrap": {
      const mint = await bootstrap(cfg, connect(cfg, "confirmed"), w);
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
      const orch = new DemoOrchestrator(createService(cfg, db), w);
      const { runId, state } = await orch.createRun();
      if (state.status === "error") throw new Error(state.error!.message);
      console.log(`run ${runId} (${state.mode})`);
      const s = await orch.runAll(runId, (m) => console.log("  " + m));
      console.log(`evidence -> evidence/runs/${runId}.json and ${relative(ROOT, manifestPath(cfg.cluster))} (${s.status})`);
      break;
    }
    case "agent-wallet":
    case "connect": {
      // agent-wallet: create/top up this cluster's agent wallet. connect: the same, then
      // (re)register the "adn" MCP server in Claude Code at user scope with a spending cap.
      const flag = (name: string, d: string) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d; };
      const cap = flag("--cap", "0.5");
      const target = BigInt(Math.round(Number(args[0] ?? "1") * 1e6));
      const wlt = await fundAgentWallet(cfg, w, target);
      console.log(`agent wallet ${wlt.address} on ${cfg.cluster}: ${Number(wlt.balance) / 1e6} aUSD${wlt.funded ? ` (+${Number(wlt.funded) / 1e6} funded)` : ""}; key ${wlt.path}`);
      const m = mcpLaunch(cfg.cluster, cap);
      const addArgs = ["mcp", "add", "adn", "--scope", "user", ...Object.entries(m.env).flatMap(([k, v]) => ["--env", `${k}=${v}`]), "--", m.command, ...m.args];
      if (cmd === "connect") {
        spawnSync("claude", ["mcp", "remove", "adn", "--scope", "user"], { stdio: "ignore" });
        const r = spawnSync("claude", addArgs, { encoding: "utf8" });
        if (r.status === 0) console.log(`MCP server "adn" registered in Claude Code (user scope, cap ${cap} aUSD). Restart Claude Code or open a new session to load its tools.`);
        else console.log(`Could not run the claude CLI${r.error ? ` (${r.error.message})` : ""}. Register the server manually:`);
        if (r.status === 0) break;
      }
      console.log(`\nClaude Code:\n  claude ${addArgs.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
      console.log(`\nClaude Desktop / Cursor (mcpServers):\n${JSON.stringify({ adn: m }, null, 2)}`);
      break;
    }
    default:
      console.log("commands: bootstrap | search <q> [--tag t] | demo | agent-wallet [aUSD] | connect [aUSD] [--cap aUSD]");
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message ?? e);
  process.exit(1);
});
