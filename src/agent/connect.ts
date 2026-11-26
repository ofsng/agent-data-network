// Agent onboarding: one wallet per cluster on the agent owner's machine (0600), topped up
// to a target aUSD balance plus SOL for fees, and the MCP launch command that uses it.
// Idempotent: re-running keeps the same wallet and only funds what is missing.
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Config, ROOT, connect } from "../config";
import { ata, loadKeypair } from "../chain/adn";
import { Wallets, waitFinalized } from "../chain/ops";

export const agentKeyPath = (cluster: string) => join(homedir(), ".config/adn-agent", cluster, "agent.json");

const MIN_SOL = 0.02 * LAMPORTS_PER_SOL;

export async function fundAgentWallet(cfg: Config, w: Wallets, target: bigint) {
  const path = agentKeyPath(cfg.cluster);
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  if (!existsSync(path)) writeFileSync(path, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
  const kp = loadKeypair(path);
  const conn = connect(cfg, "confirmed");
  if ((await conn.getBalance(kp.publicKey, "confirmed")) < MIN_SOL) {
    if (cfg.cluster === "devnet")
      await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: w.deployer.publicKey, toPubkey: kp.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })), [w.deployer]);
    else await conn.confirmTransaction(await conn.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL), "confirmed");
  }
  await getOrCreateAssociatedTokenAccount(conn, w.deployer, cfg.mint!, kp.publicKey, false, "confirmed", { commitment: "confirmed" });
  const have = await getAccount(conn, ata(kp.publicKey, cfg.mint!), "confirmed").then((a) => a.amount, () => 0n);
  // Purchases simulate at finalized commitment: return only once the funding is final.
  if (have < target) await waitFinalized(conn, await mintTo(conn, w.deployer, cfg.mint!, ata(kp.publicKey, cfg.mint!), w.deployer, target - have, [], { commitment: "confirmed" }));
  return { path, address: kp.publicKey.toBase58(), funded: have < target ? target - have : 0n, balance: have < target ? target : have };
}

/** Environment and launch command for the MCP server bound to this cluster's agent wallet. */
export function mcpLaunch(cluster: string, cap: string) {
  const env: Record<string, string> = { ADN_AGENT_KEYPAIR: agentKeyPath(cluster), ADN_AGENT_CAP: cap };
  if (cluster === "devnet") env.SOLANA_CLUSTER = "devnet";
  return { env, command: "npm", args: ["--prefix", ROOT, "run", "--silent", "mcp"] };
}
