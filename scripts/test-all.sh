#!/usr/bin/env bash
# Full regression: Rust unit tests, program tests on an ISOLATED validator (port 18899),
# app/API tests and the browser smoke test against the running demo validator + app.
# Requires `npm start` (validator + app on :8787) and at least one completed run.
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
filter() { grep -v -E "MODULE_TYPELESS|Reparsing as ES|To eliminate this|add \"type\"|trace-warnings" || true; }
count() { grep -oE "[0-9]+ $2" "$1" | tail -1 | grep -oE "^[0-9]+" || echo 0; }
mkdir -p evidence
SUM=()
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cargo test -p adn --lib 2>&1 | tee /tmp/adn-rust.txt | grep "test result"
RP=$(grep -oE "[0-9]+ passed" /tmp/adn-rust.txt | grep -oE "^[0-9]+" | tail -1); RF=$(grep -oE "[0-9]+ failed" /tmp/adn-rust.txt | grep -oE "^[0-9]+" | tail -1)
SUM+=("{\"suite\":\"Rust unit (split math, receipt size)\",\"passed\":${RP:-0},\"failed\":${RF:-0},\"ranAt\":\"$now\"}")

echo "== program tests on isolated validator :18899"
ADN_RPC_PORT=18899 ADN_LEDGER="$(pwd)/test-ledger-programtests" ADN_RESET=1 ./scripts/localnet.sh
SOLANA_RPC_URL=http://127.0.0.1:18899 ADN_TEST_VERBOSE=1 npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/anchor/**/*.ts' 2>&1 | filter > evidence/local-anchor-tests.txt
kill "$(cat test-ledger-programtests.pid)" 2>/dev/null || true
grep -E "passing|failing" evidence/local-anchor-tests.txt
SUM+=("{\"suite\":\"Anchor program (local validator)\",\"passed\":$(count evidence/local-anchor-tests.txt passing),\"failed\":$(count evidence/local-anchor-tests.txt failing),\"ranAt\":\"$now\"}")

echo "== app / API tests"
npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/app/**/*.ts' 2>&1 | filter > evidence/local-api-tests.txt
grep -E "passing|failing" evidence/local-api-tests.txt
SUM+=("{\"suite\":\"App/API security, trust, budget, resale\",\"passed\":$(count evidence/local-api-tests.txt passing),\"failed\":$(count evidence/local-api-tests.txt failing),\"ranAt\":\"$now\"}")

echo "== browser smoke (full guided run through the UI, failure injection, mobile)"
npx tsx scripts/ui-smoke.ts > /tmp/adn-ui.txt 2>&1; UI=$?
grep -E '"passed"' /tmp/adn-ui.txt | tail -1
SUM+=("{\"suite\":\"Browser smoke (UI run, failure/retry, privacy, mobile)\",\"passed\":$([ $UI = 0 ] && echo 1 || echo 0),\"failed\":$([ $UI = 0 ] && echo 0 || echo 1),\"ranAt\":\"$now\"}")

(IFS=,; echo "[${SUM[*]}]") | python3 -m json.tool > evidence/test-summary.json
cat evidence/test-summary.json
