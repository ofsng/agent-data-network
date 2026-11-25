#!/usr/bin/env bash
# Full local reproduction: program tests on a fresh validator, then a second fresh
# validator for bootstrap -> seed -> API -> agent demo -> refund -> API tests.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
export SOLANA_CLUSTER=localnet
KEYS="${ADN_KEYS_DIR:-$HOME/.config/adn-demo/keys}"
# Paid content appears only in the buyer's terminal; saved logs redact it.
redact() { sed -E 's/^  - .*  \[source /  - <paid content redacted>  [source /'; }
filter() { grep -v -E "MODULE_TYPELESS|Reparsing as ES|To eliminate this|add \"type\"|trace-warnings" || true; }

anchor build 2>&1 | grep -E "error|Finished" | filter
cp target/idl/adn.json idl/adn.json; cp target/types/adn.ts idl/adn.ts; cp target/types/adn_errors.ts idl/adn_errors.ts
cargo test -p adn --lib 2>&1 | grep "test result"

echo "== program tests (fresh validator)"
./scripts/localnet.sh
ADN_TEST_VERBOSE=1 npm run -s test:anchor 2>&1 | filter | tee evidence/local-anchor-tests.txt | grep -E "passing|failing|✔|[0-9]+\)"

echo "== demo (fresh validator)"
(fuser -k 8787/tcp 2>/dev/null || true)
./scripts/localnet.sh
rm -f deployments/localnet.json data/adn-localnet.db*
for n in deployer buyer providerA providerB requester treasury; do solana -u localhost airdrop 10 "$KEYS/$n.json" >/dev/null; done
npm run -s cli -- bootstrap 2>&1 | filter
npm run -s cli -- seed 2>&1 | filter | tail -1
setsid npm run -s server > test-ledger.server.log 2>&1 &
sleep 5
npm run -s cli -- demo 2>&1 | filter | redact | tee evidence/localnet-demo-output.txt
npm run -s cli -- demo-refund 45 2>&1 | filter | redact | tee -a evidence/localnet-demo-output.txt
npm run -s test:app 2>&1 | filter | tee evidence/local-api-tests.txt | grep -E "passing|failing|✔|[0-9]+\)"

echo "== leak scan: paid bodies must not appear in public endpoints/evidence"
LEAK=0
for s in "Peak efficiency 97.4%" "Stock 18 units" "recycling_certificate\":\"FICT" ; do
  if curl -s localhost:8787/api/v1/evidence | grep -qF "$s"; then echo "LEAK in /evidence: $s"; LEAK=1; fi
  if curl -s "localhost:8787/api/v1/assets?q=inverter%20x100%20efficiency%20lead%20time%20recycling&limit=20" | grep -qF "$s"; then echo "LEAK in /assets: $s"; LEAK=1; fi
  if grep -qF "$s" evidence/*.json evidence/*.txt; then echo "LEAK in evidence json: $s"; LEAK=1; fi
done
[ $LEAK = 0 ] && echo "no paid body found in public endpoints or evidence JSON"
