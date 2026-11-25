#!/usr/bin/env bash
# H13 — Devnet deployment and integrated verification. Requires only the deployer
# wallet to be funded with Devnet SOL (≈4.5 SOL); never touches mainnet.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
export SOLANA_CLUSTER=devnet
export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
case "$SOLANA_RPC_URL" in *mainnet*) echo "refusing mainnet"; exit 1;; esac
KEYS="${ADN_KEYS_DIR:-$HOME/.config/adn-demo/keys}"
U=(-u "$SOLANA_RPC_URL")
filter() { grep -v -E "MODULE_TYPELESS|Reparsing as ES|To eliminate this|add \"type\"|trace-warnings" || true; }
redact() { sed -E 's/^  - .*  \[source /  - <paid content redacted>  [source /'; }
mkdir -p evidence

GENESIS=$(solana "${U[@]}" genesis-hash)
[ "$GENESIS" = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG" ] || { echo "not Devnet genesis: $GENESIS"; exit 1; }
DEPLOYER=$(solana-keygen pubkey "$KEYS/deployer.json")
PROGRAM_ID=$(solana-keygen pubkey target/deploy/adn-keypair.json)
BAL=$(solana "${U[@]}" balance "$DEPLOYER" | awk '{print $1}')
echo "deployer $DEPLOYER balance $BAL SOL; program $PROGRAM_ID"

if ! solana "${U[@]}" program show "$PROGRAM_ID" >/dev/null 2>&1; then
  awk "BEGIN{exit !($BAL >= 4.0)}" || { echo "BLOCKED: deployer needs >= 4.0 Devnet SOL (has $BAL)"; exit 2; }
  solana "${U[@]}" program deploy target/deploy/adn.so --program-id target/deploy/adn-keypair.json \
    --keypair "$KEYS/deployer.json" --upgrade-authority "$KEYS/deployer.json" --commitment finalized 2>&1 | tee evidence/devnet-deploy-output.txt
fi
solana "${U[@]}" program show "$PROGRAM_ID" | tee evidence/devnet-program-show.txt

# Fund role wallets from the deployer (Devnet SOL only, small amounts).
for n in buyer providerA providerB requester treasury; do
  PK=$(solana-keygen pubkey "$KEYS/$n.json")
  B=$(solana "${U[@]}" balance "$PK" | awk '{print $1}')
  awk "BEGIN{exit !($B < 0.05)}" && solana "${U[@]}" transfer --keypair "$KEYS/deployer.json" --allow-unfunded-recipient "$PK" 0.1 --commitment finalized >/dev/null && echo "funded $n 0.1 SOL"
done

npm run -s cli -- bootstrap 2>&1 | filter
npm run -s cli -- seed 2>&1 | filter | tail -1
(fuser -k 8787/tcp 2>/dev/null || true)
setsid npm run -s server > evidence/devnet-server.log 2>&1 &
sleep 6
npm run -s cli -- demo 2>&1 | filter | redact | tee evidence/devnet-demo-output.txt
npm run -s cli -- demo-refund 60 2>&1 | filter | redact | tee -a evidence/devnet-demo-output.txt

python3 -I - "$PROGRAM_ID" <<'PY'
import hashlib, json, subprocess, sys
pid = sys.argv[1]
d = {"programId": pid, "cluster": "devnet",
     "soSha256": hashlib.sha256(open("target/deploy/adn.so", "rb").read()).hexdigest(),
     "idlSha256": hashlib.sha256(open("idl/adn.json", "rb").read()).hexdigest(),
     "programShow": open("evidence/devnet-program-show.txt").read(),
     "explorer": f"https://explorer.solana.com/address/{pid}?cluster=devnet"}
json.dump(d, open("evidence/devnet-deploy.json", "w"), indent=2)
print("evidence/devnet-deploy.json written")
PY
