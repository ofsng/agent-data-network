#!/usr/bin/env bash
# Start (or resume) the local validator without wiping it, then the web app.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
[ -f deployments/localnet.json ] || { echo "Run 'npm run setup' first."; exit 1; }
if ! solana -u localhost cluster-version >/dev/null 2>&1; then ADN_RESET=0 ./scripts/localnet.sh; fi
(fuser -k 8787/tcp 2>/dev/null || true)
echo "ADN app → http://127.0.0.1:8787  (Ctrl+C to stop the app; the validator keeps running)"
exec npx tsx src/api/server.ts
