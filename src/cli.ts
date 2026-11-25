// Local operator CLI (reproducibility interface). Usage: npm run cli -- <command>
import { Connection } from "@solana/web3.js";
import { loadConfig } from "./config";
import { bootstrap, wallets } from "./chain/ops";
import { openDb, search } from "./data/store";
import { createService } from "./api/service";
import { DemoOrchestrator } from "./demo/orchestrator";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  let cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const w = wallets(cfg);
  console.log(`[${cfg.cluster}] program ${cfg.programId.toBase58()} rpc ${cfg.rpcUrl.replace(/api-key=[^&]+/, "api-key=***")}`);

  switch (cmd) {
    case "bootstrap": {
      const mint = await bootstrap(cfg, new Connection(cfg.rpcUrl, "confirmed"), w);
      console.log(`mint ${mint.toBase58()} (TEST, 6 decimals); deployment saved to ${cfg.deploymentPath}`);
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
      console.log(`evidence -> evidence/runs/${runId}.json and evidence/run-manifest.json (${s.status})`);
      break;
    }
    default:
      console.log("commands: bootstrap | search <q> [--tag t] | demo");
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message ?? e);
  process.exit(1);
});
