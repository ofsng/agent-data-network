#!/usr/bin/env bash
# Start a local validator with the built program loaded as upgradeable,
# upgrade authority = deployer (required by initialize_config).
#   ADN_RPC_PORT   (default 8899)        ADN_LEDGER (default ./test-ledger)
#   ADN_RESET=1    wipe the ledger (default for tests); ADN_RESET=0 keeps chain state
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
KEYS="${ADN_KEYS_DIR:-$HOME/.config/adn-demo/keys}"
PORT="${ADN_RPC_PORT:-8899}"
LEDGER="${ADN_LEDGER:-$(pwd)/test-ledger}"
PIDFILE="$LEDGER.pid"
PROGRAM_ID=$(solana-keygen pubkey target/deploy/adn-keypair.json)
AUTH=$(solana-keygen pubkey "$KEYS/deployer.json")
if [ -f "$PIDFILE" ]; then kill "$(cat "$PIDFILE")" 2>/dev/null || true; sleep 2; fi
RESET=(); [ "${ADN_RESET:-1}" = "1" ] && RESET=(--reset)
EXTRA=()
if [ "$PORT" != "8899" ]; then
  EXTRA=(--faucet-port $((PORT + 1010)) --gossip-port $((PORT + 11)) --dynamic-port-range $((PORT + 20))-$((PORT + 120)))
fi
solana-test-validator "${RESET[@]}" --quiet --ledger "$LEDGER" --rpc-port "$PORT" "${EXTRA[@]}" \
  --upgradeable-program "$PROGRAM_ID" target/deploy/adn.so "$AUTH" > "$LEDGER.log" 2>&1 &
echo $! > "$PIDFILE"
for _ in $(seq 1 60); do solana -u "http://127.0.0.1:$PORT" cluster-version >/dev/null 2>&1 && break; sleep 1; done
solana -u "http://127.0.0.1:$PORT" cluster-version >/dev/null
echo "validator up on :$PORT (ledger $LEDGER); program $PROGRAM_ID authority $AUTH"
