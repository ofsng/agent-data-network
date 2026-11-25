// Local operator/agent CLI (authoritative action interface). Usage: npm run cli -- <command>
import { Connection } from "@solana/web3.js";
import { loadConfig } from "./config";
import { bootstrap, publishAsset, wallets } from "./chain/ops";
import { loadFixtures, openDb, search } from "./data/store";
import { Budget, runBounty, runPurchase, runRefund } from "./agent/agent";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  let cfg = loadConfig();
  const connection = new Connection(cfg.rpcUrl, "confirmed");
  const db = openDb(cfg.dbPath);
  const w = wallets(cfg);
  const fx = loadFixtures();
  console.log(`[${cfg.cluster}] program ${cfg.programId.toBase58()} rpc ${cfg.rpcUrl.replace(/api-key=[^&]+/, "api-key=***")}`);

  switch (cmd) {
    case "bootstrap": {
      const mint = await bootstrap(cfg, connection, w);
      console.log(`mint ${mint.toBase58()} (TEST, 6 decimals); deployment saved to ${cfg.deploymentPath}`);
      break;
    }
    case "seed": {
      const provider = { northlab: w.providerA, southsupply: w.providerB } as Record<string, typeof w.providerA>;
      await Promise.all(
        fx.rows.map((r) =>
          publishAsset(connection, db, {
            label: r.id, provider: provider[r.supplier_id], title: r.title, tags: r.tags, teaser: r.summary,
            body: r.body, license: fx.license, price: BigInt(r.price), active: true,
          }),
        ),
      );
      const n = db.prepare("SELECT count(*) AS n FROM assets WHERE active=1 AND finalized_slot IS NOT NULL").get() as { n: number };
      console.log(`seeded; ${n.n} finalized active assets indexed`);
      break;
    }
    case "search": {
      const tagIdx = args.indexOf("--tag");
      const tag = tagIdx >= 0 ? args.splice(tagIdx, 2)[1] : undefined;
      console.log(JSON.stringify(search(db, args.join(" "), tag), null, 2));
      break;
    }
    case "demo": {
      cfg = loadConfig();
      const budget = new Budget();
      await runPurchase(cfg, connection, db, w, budget);
      await runBounty(cfg, connection, db, w, budget, fx.license);
      break;
    }
    case "demo-purchase":
      await runPurchase(cfg, connection, db, w, new Budget());
      break;
    case "demo-bounty":
      await runBounty(cfg, connection, db, w, new Budget(), fx.license);
      break;
    case "demo-refund":
      await runRefund(cfg, connection, w, Number(args[0] ?? 45));
      break;
    default:
      console.log("commands: bootstrap | seed | search <q> [--tag t] | demo | demo-purchase | demo-bounty | demo-refund [waitSecs]");
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message ?? e);
  process.exit(1);
});
