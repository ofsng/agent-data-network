# PROJECT-STATE — Agent Data Network V1.3 (Devnet hackathon build)

Last update: 2026-11-25. Cluster for evidence: local validator only (Devnet blocked on funding). Reproduce: ./scripts/local-e2e.sh

| Task | Status | Actual changes | Tests / result | Evidence |
|---|---|---|---|---|
| H01 rules | DONE (hour unknown) | evidence/rules.md | T01 pass: pre-event building allowed, AI allowed, open source mandatory, video < 3 min | evidence/rules.md |
| H02 toolchain/mint/x402 | DONE except Devnet funding | Agave 4.1.2, Anchor 1.2.2, skill + MCP installed, workspace | T02 pass; T03 local mint pass, x402 → direct Anchor | evidence/h02-toolchain.md |
| H03 config/registry | DONE (local) | programs/adn/src/lib.rs | T04 T05 T06 pass (local validator) | evidence/local-anchor-tests.txt |
| H04 data store/seed | DONE (local) | src/data/store.ts, schema, fixtures, seed CLI | T07 12/12 manifest match; T08 A01/B01 top, no body, gap=true | evidence/localnet-demo-output.txt |
| H05 atomic purchase | DONE (local) | purchase_unit, src/chain/adn.ts bundle builder | T09 T10 T11 T12 pass; 784 B, 54,832 CU, fee 5000 lamports, receipt rent 2,658,720 lamports | evidence/local-anchor-tests.txt |
| H06 adversarial purchase | DONE (local) | tests/anchor | T13 T14 T15 T16 T17 pass; failed-tx network fee 5000 lamports | evidence/local-anchor-tests.txt |
| H07 API | DONE (local) | src/api/server.ts, src/chain/verify.ts, reconcileQuotes | T18 T19 T20 T21 T22 pass | evidence/local-api-tests.txt |
| H08 purchase CLI | DONE (local) | src/agent/agent.ts, src/cli.ts | T23 local: exact deltas, 2 receipts, 2 hash-verified deliveries | evidence/localnet-purchase.json |
| H09 bounty fund/submit | DONE (local) | create_bounty, submit_bounty_solution | T24 T25 T26 pass | |
| H10 accept/refund | DONE (local) | accept_bounty_solution, refund_expired_bounty | T27 T28 T29 T30 T31 pass | |
| H11 gap demo | DONE (local) | runBounty/runRefund | T32 local (gap→fund→wrong rejected→accept→deliver→activate→gap false); T33 pass | evidence/localnet-bounty.json, localnet-refund.json |
| H12 UI | DONE (local) | src/api/dashboard.html (read-only) | T34 visual check desktop; leak scan clean | |
| H13 Devnet | BLOCKED (funding) | scripts/devnet.sh ready; dry run exits `BLOCKED: deployer needs >= 4.0 Devnet SOL (has 0)` | T35 pending | |
| H14 submission | IN PROGRESS | README with reproduction, disclosure, limitations | T37 pending (video, portal) | README.md |
| H15 x402 | SKIPPED | spec incompatible (see H02) | T38 omitted | |
| H16 MCP/3rd unit | TODO (optional) | | | |

## Blockers
- Devnet faucet rate-limited: deployer `Cu7ctAUxW25GsGGPVvNupujU81A9jvEZUGjo2sUdgVZ7` needs ≈3 SOL; buyer `8PwMwNm9LSoPFEJG2gdTWdcFGvjx2CtPWWLx6DCmEjam`, requester `BYJzQqCc3yZdCUn5EQtBwhDfGwaRpxcQRJ6wiomRw2mr`, providerA `B3MfpnQkA1wPddYu5DkzewmSnEetwy8zfWiPNhVkWvAm`, providerB `GpB87pmju8jM3haqYUeEH1kYLMGVAoDz9B66tXARsCpD` need ≈0.3 SOL each (treasury `k3fiTTbTdJV5CT8cJHw6KBFzsFyoUWpxSePtBsD8Qj7` 0.05).
- Exact UTC submission hour only in Dev3pack dashboard.

## Divergences from spec
- Initializer pinning: checked against the program's upgrade authority (ProgramData), not a compile-time key.
- Treasury-alias in purchase is rejected by Anchor's duplicate-mutable-account check (error 2040) before the custom AliasedAccounts check.
- Deadline/expiry boundaries: purchase requires now < expires_at; accept requires now < deadline; refund requires now >= deadline.

## Measured (local validator)
Bundle 784 B, 54,832–63,832 CU, fee 5000 lamports, receipt rent 2,658,720 lamports (local) / 1,940,560 (Devnet `solana rent 254`). Program .so 370,960 B → Devnet program-data rent 1.88535564 SOL.

## Fixes found during verification
- Evidence JSON/logs initially contained paid bodies (served by /api/v1/evidence) → now hashes + byte length only; saved logs redact the buyer report; leak scan in local-e2e.sh.
- Refund demo deadline used finalized block time (~13 s stale) → early refund was actually late; now confirmed time + 45 s window, and the script asserts DeadlineNotReached.

## Next action
Founder funds Devnet deployer with ≈4.5 SOL → run ./scripts/devnet.sh → record T35 evidence → video (<3 min) and portal submission (T37). Make repo public before submission.
