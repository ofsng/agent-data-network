// Runtime configuration. Only localnet and devnet are accepted; key paths are
// read by the local CLI only and never exposed through the API.
import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { PROGRAM_ID } from "./chain/adn";

export type Cluster = "localnet" | "devnet";
export const ROOT = resolve(__dirname, "..");

const expand = (p: string) => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);
const keyDir = join(homedir(), ".config/adn-demo/keys");

export interface Deployment {
  cluster: Cluster;
  programId: string;
  mint: string;
  treasury: string;
  mintLabel: string;
  wallets: Record<string, string>;
  createdAt: string;
}

export function loadConfig() {
  const cluster = (process.env.SOLANA_CLUSTER ?? "localnet") as Cluster;
  if (cluster !== "localnet" && cluster !== "devnet") throw new Error(`unsupported cluster ${cluster}`);
  const rpcUrl =
    process.env.SOLANA_RPC_URL ?? (cluster === "devnet" ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899");
  if (/mainnet/i.test(rpcUrl)) throw new Error("mainnet RPC refused");
  if (process.env.PROGRAM_ID && process.env.PROGRAM_ID !== PROGRAM_ID.toBase58())
    throw new Error("PROGRAM_ID does not match generated IDL");
  const deploymentPath = join(ROOT, "deployments", `${cluster}.json`);
  const deployment: Deployment | undefined = existsSync(deploymentPath)
    ? JSON.parse(readFileSync(deploymentPath, "utf8"))
    : undefined;
  const mint = process.env.PAYMENT_MINT || deployment?.mint;
  const treasury = process.env.TREASURY_PUBKEY || deployment?.treasury;
  return {
    cluster,
    rpcUrl,
    programId: PROGRAM_ID,
    mint: mint ? new PublicKey(mint) : undefined,
    treasury: treasury ? new PublicKey(treasury) : undefined,
    deployment,
    deploymentPath,
    dbPath: resolve(ROOT, process.env.DATABASE_PATH ?? `data/adn-${cluster}.db`),
    deliveryDomain: process.env.DELIVERY_DOMAIN ?? "adn.local",
    apiUrl: process.env.ADN_API_URL ?? "http://127.0.0.1:8787",
    port: Number(process.env.PORT ?? 8787),
    keys: {
      deployer: expand(process.env.DEPLOYER_KEYPAIR_PATH ?? join(keyDir, "deployer.json")),
      buyer: expand(process.env.DEMO_BUYER_KEYPAIR_PATH ?? join(keyDir, "buyer.json")),
      providerA: expand(process.env.DEMO_PROVIDER_A_KEYPAIR_PATH ?? join(keyDir, "providerA.json")),
      providerB: expand(process.env.DEMO_PROVIDER_B_KEYPAIR_PATH ?? join(keyDir, "providerB.json")),
      requester: expand(process.env.DEMO_REQUESTER_KEYPAIR_PATH ?? join(keyDir, "requester.json")),
      treasury: expand(process.env.DEMO_TREASURY_KEYPAIR_PATH ?? join(keyDir, "treasury.json")),
    },
  };
}

export type Config = ReturnType<typeof loadConfig>;

export function saveDeployment(cfg: Config, d: Deployment) {
  mkdirSync(dirname(cfg.deploymentPath), { recursive: true });
  writeFileSync(cfg.deploymentPath, JSON.stringify(d, null, 2) + "\n");
}

export const explorer = (cluster: Cluster, kind: "tx" | "address", id: string) =>
  cluster === "devnet"
    ? `https://explorer.solana.com/${kind}/${id}?cluster=devnet`
    : `https://explorer.solana.com/${kind}/${id}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`;

// The public Devnet RPC rate-limits per IP and per method (HTTP 429). Every Devnet
// connection shares one paced fetch that backs off on 429; localnet is unthrottled.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextSlot = 0;
async function pacedFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  for (let attempt = 0; ; attempt++) {
    const now = Date.now();
    const at = Math.max(now, nextSlot);
    nextSlot = at + Number(process.env.ADN_RPC_GAP_MS ?? 250);
    await sleep(at - now);
    const res = await fetch(input, init);
    if (res.status !== 429 || attempt >= 8) return res;
    await sleep(Math.min(16_000, 1000 * 2 ** attempt));
  }
}

export function connect(cfg: Pick<Config, "cluster" | "rpcUrl">, commitment: Commitment) {
  return cfg.cluster === "devnet"
    ? new Connection(cfg.rpcUrl, { commitment, fetch: pacedFetch as any, disableRetryOnRateLimit: true })
    : new Connection(cfg.rpcUrl, commitment);
}
