# PROJECT-STATE — Agent Data Network V1.5 (single-session hackathon demo)

Last update: 2026-11-25. Active spec: `STARTUP-PACKAGE/` V1.5 (archive excluded). Runtime: **local validator, real transactions**. Devnet: scripted, blocked on faucet funding.

## Gates
| Gate | Status | Evidence |
|---|---|---|
| Technical (local chain) | **MET** — every economic step is a finalized local-validator tx of the real Anchor program | evidence/run-manifest.json (`technicalGate: MET_LOCAL_VALIDATOR`) |
| UX (guided browser demo) | **MET** — full run through the UI, step-by-step and auto, failure + retry, mobile | evidence/ui-smoke.json, evidence/screenshots/ |
| Devnet | NOT DONE — faucet rate-limited; `scripts/devnet.sh` ready | evidence/h02-toolchain.md |
| Contest submission | PENDING (founder) — video < 3 min, public repo, portal form | evidence/rules.md |

## Task status (V1.3 IDs reconciled with V1.5)
| Task | Status | What was reused / changed in V1.5 |
|---|---|---|
| H01 rules | DONE | Re-used evidence/rules.md (pre-event building allowed, AI allowed, open source mandatory, video < 3 min). Exact UTC deadline only in dashboard. |
| H02 toolchain / x402 | DONE | Agave 4.1.2, Anchor 1.2.2, solana-dev skill + Solana docs MCP. x402: incompatible → direct Anchor (no x402 labels). |
| H03 registry, H05 purchase, H06 adversarial, H09/H10 bounty | DONE (unchanged program) | 8-instruction ABI unchanged; 17 program tests pass on an isolated validator. |
| H04 data + trust (R01/R13) | DONE | NEW: asset_trust sidecar (migration 004), validation TEXT_V1/BOUNTY_JSON_V2, per-asset verified snapshots (0600, outside repo). |
| H07 API (R03/R05/R14) | DONE | NEW: shared service; prequote preflight (trust, bytes == chain hashes, snapshot) 422/503; post-payment corruption → exact restore, free retry; receipt-first reconciliation. |
| H08/H11 agent + gap (R09/R15/R18) | DONE | NEW: typed tools (no generic signer), durable spend reservations, requirement v2 (no answer), bounded review re-run before accept, activation, **resale to a second agent**, separate refund requester/budget. |
| H12 guided UI (R10/R17) | DONE | NEW: 8-section product UI, Run/Next/Pause/Reset, live balances, escrow, receipts, earnings, evidence. |
| H13 rehearse/verify (R19) | DONE (local) | `npm run setup` from scratch, 2 headless runs + 1 UI run, all COMPLETE with exact deltas; full regression green. |
| H14 freeze/deliver | DONE except founder actions | README, DEMO-SCRIPT.md, evidence manifest, screenshots. |
| H16 tool facade | DONE (facade) | Typed tools + negative tests (T46/T47). MCP stdio server not implemented (SDK not installed) → labeled "MCP: not connected". |
| H15 x402, H17 live LLM | SKIPPED (optional) | Labeled in UI/health; no claims. |

## Tests actually run (latest `npm test`, see evidence/test-summary.json)
- Rust unit: 2/2 (split math, receipt = 254 B)
- Anchor program (isolated local validator): 17/17 — T04–T06, T09–T17, T24–T31
- App/API: 14/14 — T18–T22, T40–T47, T50, T52–T53, demo-route guards
- Browser smoke: pass — T49 happy path, T50 privacy, T51 injected failure (snapshot removed → SNAPSHOT_UNAVAILABLE shown, no charge) and retry, mobile no horizontal scroll, 0 console errors

## Measured (local validator 4.1.2)
Bundle 784 B (2 × purchase_unit), ~54–64k CU, fee 5,000 lamports; resale tx 571 B, ~25k CU; receipt deposit 2,658,720 lamports local (Devnet `solana rent 254` = 1,940,560). Full guided run ≈ 2.5 min (dominated by ~13 s local finality per tx).

## Fixes found during V1.5 verification
- Run setup read new ATAs at finalized commitment → `confirmed` read-back.
- SOL-spent figure lost between steps → passed explicitly.
- Refund delta measured from before funding (net 0) → separate funding/refund deltas.
- Reconciliation relied on signature history (unavailable for older local sigs) → receipt PDAs first.
- Isolated test validator port collision → separate port block (18899).
- UI: unsized check icons, price wrap, sticky header, inactive-listing clutter, mobile hero order.

## Blockers / founder actions
1. Devnet SOL (≈4.5) for deployer `Cu7ctAUxW25GsGGPVvNupujU81A9jvEZUGjo2sUdgVZ7` → `./scripts/devnet.sh` (optional; rules accept devnet or mainnet addresses, local is fine for the demo itself).
2. Record video (< 3 min) per DEMO-SCRIPT.md; make GitHub repo public; submit on Dev3pack portal before the 29 Nov deadline (exact UTC hour in dashboard).

## Divergences from spec
- Single Node HTTP server + vanilla-JS UI instead of Next.js (spec allows reuse of working stack).
- Simulation mode not implemented: real local chain is available, so no fallback was needed; UI never shows simulated data.
- Reset = new isolated run (fresh agent wallets) on the same ledger; previous run's commissioned listing is withdrawn by its provider via a real `set_asset_active(false)` so the gap is real again. Full chain reset = `npm run setup`.
- Agent run wallets are generated per run under `~/.config/adn-demo/runs/` (0600), funded with exactly their caps.
