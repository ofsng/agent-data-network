#!/usr/bin/env bash
# One-time (or full reset) setup: disposable keys outside the repo, program build,
# fresh local validator, local SOL, TEST mint, config and ATAs. Never touches Devnet/mainnet.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
KEYS="${ADN_KEYS_DIR:-$HOME/.config/adn-demo/keys}"
mkdir -p "$KEYS" && chmod 700 "$KEYS"
for n in deployer buyer providerA providerB requester treasury; do
  [ -f "$KEYS/$n.json" ] || solana-keygen new --no-bip39-passphrase -s -o "$KEYS/$n.json" >/dev/null
  chmod 600 "$KEYS/$n.json"
done
[ -d node_modules ] || npm ci
anchor build 2>&1 | grep -E "^error|Finished" || true
cp target/idl/adn.json idl/adn.json; cp target/types/adn.ts idl/adn.ts; cp target/types/adn_errors.ts idl/adn_errors.ts
(fuser -k 8787/tcp 2>/dev/null || true)
ADN_RESET=1 ./scripts/localnet.sh
rm -f deployments/localnet.json data/adn-localnet.db data/adn-localnet.db-*
rm -rf "$HOME/.config/adn-demo/snapshots/localnet" evidence/runs evidence/run-manifest.json
for n in deployer providerA providerB treasury buyer requester; do solana -u localhost airdrop 50 "$KEYS/$n.json" >/dev/null; done
SOLANA_CLUSTER=localnet npx tsx src/cli.ts bootstrap 2>&1 | grep -v MODULE_TYPELESS | tail -1
echo "setup complete — run: npm start"
