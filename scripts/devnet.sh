#!/usr/bin/env bash
# Devnet deployment + full guided run with real Devnet transactions. Needs only the
# deployer wallet funded with Devnet SOL; refuses anything that is not Devnet.
# Idempotent: an existing deployment/config/mint is reused; each call adds a new run.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
export SOLANA_CLUSTER=devnet
export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
case "$SOLANA_RPC_URL" in *mainnet*) echo "refusing mainnet"; exit 1;; esac
KEYS="${ADN_KEYS_DIR:-$HOME/.config/adn-demo/keys}"
U=(-u "$SOLANA_RPC_URL" --keypair "$KEYS/deployer.json")
filter() { grep -v -E "ws error: Unexpected server response: 429|Too Many Requests|MODULE_TYPELESS|Reparsing as ES|To eliminate this|add \"type\"|trace-warnings" || true; }
mkdir -p evidence

GENESIS=$(solana "${U[@]}" genesis-hash)
[ "$GENESIS" = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG" ] || { echo "not Devnet genesis: $GENESIS"; exit 1; }
DEPLOYER=$(solana-keygen pubkey "$KEYS/deployer.json")
PROGRAM_ID=$(solana-keygen pubkey target/deploy/adn-keypair.json)
SO_BYTES=$(stat -c%s target/deploy/adn.so)
RENT=$(solana "${U[@]}" rent $((SO_BYTES + 45)) | awk '/Rent-exempt/{print $3}')
BAL=$(solana "${U[@]}" balance "$DEPLOYER" | awk '{print $1}')
echo "deployer $DEPLOYER balance $BAL SOL; program $PROGRAM_ID ($SO_BYTES bytes, programdata rent $RENT SOL)"

if ! solana "${U[@]}" program show "$PROGRAM_ID" >/dev/null 2>&1; then
  # Peak need: programdata rent + an equally sized temporary buffer (refunded) + fees/runs.
  NEED=$(awk "BEGIN{printf \"%.2f\", 2*$RENT + 0.4}")
  awk "BEGIN{exit !($BAL >= $NEED)}" || { echo "BLOCKED: deployer needs >= $NEED Devnet SOL (has $BAL)"; exit 2; }
  solana "${U[@]}" program deploy target/deploy/adn.so --program-id target/deploy/adn-keypair.json \
    --keypair "$KEYS/deployer.json" --upgrade-authority "$KEYS/deployer.json" \
    --max-sign-attempts 100 --with-compute-unit-price 10000 --commitment finalized 2>&1 | tee evidence/devnet-deploy-output.txt
fi
solana "${U[@]}" program show "$PROGRAM_ID" | tee evidence/devnet-program-show.txt
DUMP=$(mktemp); solana "${U[@]}" program dump "$PROGRAM_ID" "$DUMP" >/dev/null
DEPLOYED_SHA=$(head -c "$SO_BYTES" "$DUMP" | sha256sum | cut -d' ' -f1); rm -f "$DUMP"
LOCAL_SHA=$(sha256sum target/deploy/adn.so | cut -d' ' -f1)
[ "$DEPLOYED_SHA" = "$LOCAL_SHA" ] || { echo "deployed bytes differ from target/deploy/adn.so"; exit 1; }
echo "deployed program bytes == target/deploy/adn.so ($LOCAL_SHA)"

# Providers pay rent for their listings; agent run wallets are funded per run by the orchestrator.
for n in providerA providerB; do
  PK=$(solana-keygen pubkey "$KEYS/$n.json")
  B=$(solana "${U[@]}" balance "$PK" | awk '{print $1}')
  if awk "BEGIN{exit !($B < 0.05)}"; then
    solana "${U[@]}" transfer --keypair "$KEYS/deployer.json" --allow-unfunded-recipient "$PK" 0.1 --commitment finalized >/dev/null
    echo "funded $n 0.1 Devnet SOL"
  fi
done

npx tsx src/cli.ts bootstrap 2>&1 | filter
npx tsx src/cli.ts demo 2>&1 | filter | tee evidence/devnet-demo-output.txt
npx tsx scripts/verify-evidence.ts 2>&1 | filter | tee evidence/devnet-verify-output.txt

python3 -I - "$PROGRAM_ID" "$LOCAL_SHA" <<'PY'
import hashlib, json, sys
pid, so = sys.argv[1], sys.argv[2]
m = json.load(open("evidence/devnet-run-manifest.json"))
d = {"programId": pid, "cluster": "devnet", "soSha256": so, "deployedBytesMatch": True,
     "idlSha256": hashlib.sha256(open("idl/adn.json", "rb").read()).hexdigest(),
     "programShow": open("evidence/devnet-program-show.txt").read(),
     "explorer": f"https://explorer.solana.com/address/{pid}?cluster=devnet",
     "mint": m["mint"], "lastRun": m["runId"], "lastRunStatus": m["status"]}
json.dump(d, open("evidence/devnet-deploy.json", "w"), indent=2)
print("evidence/devnet-deploy.json written")
PY
