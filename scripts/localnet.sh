#!/usr/bin/env bash
# Start a fresh local validator with the built program loaded as upgradeable,
# upgrade authority = deployer (required by initialize_config).
set -euo pipefail
KEYS="${ADN_KEYS_DIR:-$HOME/.config/adn-demo/keys}"
LEDGER="${ADN_LEDGER:-$(pwd)/test-ledger}"
PROGRAM_ID=$(solana-keygen pubkey target/deploy/adn-keypair.json)
AUTH=$(solana-keygen pubkey "$KEYS/deployer.json")
PIDFILE="$LEDGER.pid"
if [ -f "$PIDFILE" ]; then kill "$(cat "$PIDFILE")" 2>/dev/null || true; sleep 2; fi
solana-test-validator --reset --quiet --ledger "$LEDGER" \
  --upgradeable-program "$PROGRAM_ID" target/deploy/adn.so "$AUTH" > "$LEDGER.log" 2>&1 &
echo $! > "$PIDFILE"
for _ in $(seq 1 60); do solana -u localhost cluster-version >/dev/null 2>&1 && break; sleep 1; done
echo "validator up; program $PROGRAM_ID authority $AUTH"
