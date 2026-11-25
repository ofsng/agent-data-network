# Implementation task specifications

All tasks TODO. H01–H14 P0; H15/H16 optional; B01/B02 after event. Effort optimistic hands-on hours, not elapsed guarantee. Before each task read PRD/Anchor/API as relevant; commit code/test evidence and update PROJECT-STATE.md. No implementation performed by this documentation package.

## H01 — Confirm contest rules
- Epic: Engineering / Day 1 · Priority P0 · Owner Founder / coding agent · Effort 0.5 h (0 = unestimated later).
- Objective / implementation: Check official portal: coding window, AI disclosure, team eligibility, deadlines/time zone, source/video/track; record organizer evidence. Do not code outside allowed window.
- Prerequisites and dependencies: None; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: setup/validation.
- Affected components / output: evidence/rules.md.
- Acceptance: Rules evidence or explicit unresolved blocker; no invented requirement.
- Test requirements: T01.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H02 — Toolchain / mint / x402 spike
- Epic: Engineering / Day 1 · Priority P0 · Owner Founder / coding agent · Effort 1.5 h (0 = unestimated later).
- Objective / implementation: Install official skills/MCP; record revision; pin mutually compatible Rust, Anchor, Solana CLI and TS versions; run hello build/local validator; fund disposable Devnet wallets; verify 6-decimal legacy mint or create TEST mint; check actual x402 full-bundle compatibility for max 45 min.
- Prerequisites and dependencies: H01; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: setup/validation.
- Affected components / output: evidence/toolchain.md.
- Acceptance: Build and local validator work; mint/funding recorded; direct Anchor fallback chosen if x402 unproven.
- Test requirements: T02, T03.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H03 — Config and immutable registry
- Epic: Engineering / Day 1 · Priority P0 · Owner Founder / coding agent · Effort 1.5 h (0 = unestimated later).
- Objective / implementation: Implement initializer authorization, Config, DataAsset seed derivation, register and set_asset_active; validate price/hash/version/mint/authority. Generate IDL.
- Prerequisites and dependencies: H02; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R01, R11.
- Affected components / output: programs/adn registry + tests.
- Acceptance: Only permitted initializer/provider succeeds; terms immutable; inactive toggles work.
- Test requirements: T04, T05, T06.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H04 — Private data store and seed
- Epic: Engineering / Day 1 · Priority P0 · Owner Founder / coding agent · Effort 1 h (0 = unestimated later).
- Objective / implementation: Apply SQLite schema, normalize fixture bytes, generate deterministic fixture IDs/hashes; map real test provider wallets, precreate ATAs; implement import and metadata-only search. Register via H03 when available.
- Prerequisites and dependencies: H02; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R01, R02.
- Affected components / output: src/data + seed evidence.
- Acceptance: 12 rows, correct hashes, no raw bodies in search; A01+B01 selection; missing tag yields gap.
- Test requirements: T07, T08.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H05 — Atomic purchase and receipt
- Epic: Engineering / Day 1 · Priority P0 · Owner Founder / coding agent · Effort 3 h (0 = unestimated later).
- Objective / implementation: Implement purchase_unit and receipt PDA with exact signed expected terms, timestamp, checked split and ATA checks. Construct two instructions same tx, one fee payer; serialize, simulate, measure size. If necessary use tested v0 ALT; never split required demo.
- Prerequisites and dependencies: H03; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R03, R04.
- Affected components / output: program settlement + tx builder.
- Acceptance: One tx for two distinct providers; exact 24k each and 12k treasury; two receipts; fits 1232 bytes.
- Test requirements: T09, T10, T11, T12.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H06 — Adversarial purchase tests
- Epic: Engineering / Day 1 · Priority P0 · Owner Founder / coding agent · Effort 1.5 h (0 = unestimated later).
- Objective / implementation: Test duplicate receipt, wrong signer/mint/ATA, changed terms, inactive, insufficient funds, second instruction failure; assert first transfer and receipt rolled back; verify actual token balance deltas.
- Prerequisites and dependencies: H05; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R04, R11.
- Affected components / output: tests/anchor purchase.
- Acceptance: No partial transfer or receipt, including deliberate second failure; fee exception documented.
- Test requirements: T13, T14, T15, T16, T17.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H07 — Quote and delivery verification API
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 2 h (0 = unestimated later).
- Objective / implementation: Create search/quote/receipt/challenge/delivery/health routes, 120s quote, wallet proof 60s one-use nonce, finalized program/PDA verification, exact bytes, hash compare, SQL reconciliation.
- Prerequisites and dependencies: H04, H05; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R02, R03, R05.
- Affected components / output: src/chain + API + auth.
- Acceptance: Unpaid/wrong buyer/forged receipt/replay denied; fresh nonce same receipt free; timeout pending not recharged.
- Test requirements: T18, T19, T20, T21, T22.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H08 — Purchase demo CLI
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 0.75 h (0 = unestimated later).
- Objective / implementation: Wire deterministic agent search→quote→budget→sign→finalized→deliver→source report; save tx signature and receipts; assert exact deltas and hashes.
- Prerequisites and dependencies: H06, H07; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R05, R09.
- Affected components / output: scripts/demo-purchase.
- Acceptance: Real two-provider Devnet tx when deployment ready; local test first; no mock success.
- Test requirements: T23.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H09 — Bounty funding and submission
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 1.5 h (0 = unestimated later).
- Objective / implementation: Implement Bounty PDA and vault ATA, transfer reward, deadline; submit inactive asset by owning provider; hash canonical requirement; enforce no transfer on submission.
- Prerequisites and dependencies: H03; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R06, R07.
- Affected components / output: program bounty open + submit.
- Acceptance: 2 TEST locked, no payout upon submit; wrong requester/provider/expired submission rejected.
- Test requirements: T24, T25, T26.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H10 — Bounty accept and expiry refund
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 2 h (0 = unestimated later).
- Objective / implementation: Implement requester acceptance with selected submission + expected hashes, exact reward split and bounty receipt; expiry refund; terminal guards; tests for races/unauthorized and unsolicited vault surplus.
- Prerequisites and dependencies: H09, H05; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R08.
- Affected components / output: program bounty settle + tests.
- Acceptance: 1.6 TEST provider, 0.4 treasury, receipt; independent full refund; no double payout.
- Test requirements: T27, T28, T29, T30, T31.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H11 — Gap-to-data agent demo
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 1 h (0 = unestimated later).
- Objective / implementation: CLI funds bounded missing-tag bounty; provider registers solution; deterministic required-field review, requester signs acceptance, deliver via bounty receipt, provider activates; separate expired refund demo.
- Prerequisites and dependencies: H10, H07; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R06, R07, R08, R09.
- Affected components / output: scripts/demo-bounty.
- Acceptance: End-to-end gap, funding, review, acceptance, delivery, catalog activation and refund evidence.
- Test requirements: T32, T33.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H12 — Minimal evidence UI
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 1 h (0 = unestimated later).
- Objective / implementation: Catalog, receipts, bounty and evidence views; real cluster/mint status, pending/finalized, Explorer links, explicit synthetic badge. Read-only acceptable; CLI actions documented.
- Prerequisites and dependencies: H07; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R10.
- Affected components / output: app/ dashboard.
- Acceptance: No raw payload, no keys, no fake balances, accessible responsive screen.
- Test requirements: T34.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H13 — Devnet deployment and integrated verification
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 1.5 h (0 = unestimated later).
- Objective / implementation: Run build/test, deploy once after rule clearance, initialize config, seed and run both demos, measure receipt rent, tx size/CU, actual deltas; check no secrets, persist sanitized evidence.
- Prerequisites and dependencies: H08, H11, H12; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R12.
- Affected components / output: evidence/devnet.json + PROJECT-STATE.
- Acceptance: Real program ID and finalized signatures, receipt hashes and balance evidence; disclose unavailable network.
- Test requirements: T35, T36.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H14 — Submission and demo freeze
- Epic: Engineering / Day 2 · Priority P0 · Owner Founder / coding agent · Effort 1.5 h (0 = unestimated later).
- Objective / implementation: Freeze core, run smoke, record video per portal rules, update English pitch with real evidence only, package README/reproduction and limitations.
- Prerequisites and dependencies: H13; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: R12.
- Affected components / output: submission assets.
- Acceptance: Submission checklist complete or explicit portal blocker; no false claims.
- Test requirements: T37.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H15 — Optional x402 transport
- Epic: Engineering / Day 2 · Priority P1 · Owner Founder / coding agent · Effort 1 h (0 = unestimated later).
- Objective / implementation: Only if H02 full compatibility passed: use reference SDK/facilitator, verify exact complete two-receipt transaction and buyer binding; no duplicate payment path. Otherwise skip.
- Prerequisites and dependencies: H13; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: setup/validation.
- Affected components / output: optional x402 evidence.
- Acceptance: End-to-end verified full transaction or explicitly omitted.
- Test requirements: T38.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## H16 — Optional product MCP / third unit
- Epic: Engineering / Day 2 · Priority P1 · Owner Founder / coding agent · Effort 1 h (0 = unestimated later).
- Objective / implementation: Expose metadata search or verified read tool with same auth; OR test third unit within size/compute budget. Do not risk core.
- Prerequisites and dependencies: H13; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: setup/validation.
- Affected components / output: optional evidence.
- Acceptance: Verified optional feature only; no registry claim unless published.
- Test requirements: T39.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## B01 — Post-event online product validation
- Epic: Business / Post-event · Priority Later · Owner Founder / coding agent · Effort 0 h (0 = unestimated later).
- Objective / implementation: AI desk research and opt-in product analytics; actual paid demand after legal approval.
- Prerequisites and dependencies: None; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: setup/validation.
- Affected components / output: market evidence.
- Acceptance: Document actual evidence, not AI estimates.
- Test requirements: post-event evidence.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.

## B02 — Post-event commercial and scale review
- Epic: Business / Post-event · Priority Later · Owner Founder / coding agent · Effort 0 h (0 = unestimated later).
- Objective / implementation: Re-estimate rent, fees, legal rights, refunds, security audit, commercial pricing and compressed receipts; revise archived finance model.
- Prerequisites and dependencies: B01; rule clearance applies to all implementation. Inputs: active specs, configured Devnet or local validator and synthetic fixtures as relevant. Requirements: setup/validation.
- Affected components / output: commercial review.
- Acceptance: Separate commercial GO decision.
- Test requirements: post-event evidence.
- DoD: deliverable exists, acceptance checked against actual output, test evidence recorded, no leaked secrets, no unresolved critical security issue, status updated; failed checks stay blocked.
- Risks: time/toolchain/RPC, incorrect authority or amount where relevant. Follow documented fallback; never substitute simulated results for Devnet.
