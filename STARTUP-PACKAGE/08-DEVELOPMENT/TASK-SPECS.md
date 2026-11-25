# V1.5 task specifications
Template statuses TODO; reconcile actual completed work. No invented duration or restart. H15/H17 live integrations optional; H16 facade P0. All P0 chain claims require actual local/Devnet evidence.

## H01 — Rules and repository reconciliation
- Priority / owner: P0 / Founder / coding agent
- Dependencies: None; Requirements: setup/commercial
- Implementation: Inspect repo and actual evidence; verify contest window/AI disclosure/chain requirement; preserve prior working state.
- Deliverable: PROJECT-STATE.md + evidence/rules.md
- Acceptance: Rules recorded and old task evidence reconciled; unresolved eligibility disclosed.
- Tests: T01
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H02 — Local runtime and toolchain
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H01; Requirements: setup/commercial
- Implementation: Reuse installed Solana Skills/docs MCP and Anchor; build local validator, disposable 6-decimal test mint, funded accounts; timebox external setup, do not block UI on Devnet.
- Deliverable: evidence/toolchain.md
- Acceptance: Actual local runtime available or explicit blocker; isolated fallback labeled.
- Tests: T02, T03
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H03 — Registry and immutable assets
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H02; Requirements: R01, R11
- Implementation: Reuse 8-instruction ABI; verify initializer and provider constraints, asset PDA and status.
- Deliverable: program + IDL
- Acceptance: Actual registry and authorization tests pass.
- Tests: T04, T05, T06
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H04 — Fixture store and trust
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H02; Requirements: R01, R02, R13
- Implementation: Import 12 unchanged fixtures and sidecars, immutable private bytes, deterministic metadata search and verified snapshot.
- Deliverable: fixture store
- Acceptance: 12 hashes match; source/schema labels, no raw body and gap works.
- Tests: T07, T08, T40, T41
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H05 — Atomic purchase and receipt
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H03, H04; Requirements: R03, R04
- Implementation: Two purchase_unit instructions in one actual local transaction; verify exact split and two PDAs; standalone unit for later resale.
- Deliverable: chain settlement service
- Acceptance: Actual -60000/+24000/+24000/+12000, two receipts, size and fee measured.
- Tests: T09, T10, T11, T12
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H06 — Critical payment negative tests
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H05; Requirements: R04, R11
- Implementation: Wrong mint/ATA, second instruction fail, duplicate, expired/deactivated, insufficient balance; keep actual evidence.
- Deliverable: anchor test results
- Acceptance: No partial movement/receipt or duplicate; network fees distinguished.
- Tests: T13, T14, T15, T16, T17
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H07 — Quote and receipt-gated delivery
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H05, H04; Requirements: R03, R05, R14
- Implementation: Preflight exact content/license and snapshot; quote, wallet challenge, finalized receipt gate, retry and recover.
- Deliverable: delivery service
- Acceptance: Unauthorized/mismatch blocked, exact recovery no second charge.
- Tests: T18, T19, T20, T21, T22, T42, T43
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H08 — Deterministic purchase agent
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H07, H16; Requirements: R09
- Implementation: Use typed facade search/quote/purchase/verify/retrieve; display actual trace and source facts.
- Deliverable: purchase driver
- Acceptance: Actual tool calls, two receipts, no hardcoded success.
- Tests: T23
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H09 — Bounty funding and submission
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H03, H04; Requirements: R06, R07
- Implementation: Use existing bounty PDA/vault, public requirement hash, inactive submission and bounded review.
- Deliverable: bounty service
- Acceptance: Funded OPEN, no payout on submit, invalid submission rejected.
- Tests: T24, T25, T26, T44
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H10 — Bounty accept and refund
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H09, H07; Requirements: R08, R15
- Implementation: Requester signs after deterministic review; accept receipt and split; separate expiry refund; wrong signer/replay/race negative cases.
- Deliverable: bounty settlement/tests
- Acceptance: Actual payout 1.6/0.4 TEST; separate refund 2 TEST, no commission.
- Tests: T27, T28, T29, T30, T31, T45
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H11 — Gap-to-data and resale driver
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H08, H10; Requirements: R09, R15, R18
- Implementation: Use gap to fund, accept, retrieve, activate and second buyer purchases via existing instruction.
- Deliverable: complete driver
- Acceptance: Full chain-backed lifecycle and new buyer receipt; distinct budget.
- Tests: T32, T52
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H12 — Polished guided browser UI
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H11, H06; Requirements: R10, R17
- Implementation: One browser guided journey with actual step state, balances, evidence, mode, error and reset; no new design framework.
- Deliverable: browser demo
- Acceptance: All scenes usable, no fake success or private prepay data.
- Tests: T34, T49, T50, T51
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H13 — Rehearse and verify
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H12; Requirements: R12, R19
- Implementation: Two clean runs; local chain evidence, negative tests, isolated reset and fallback modes; optional Devnet only if ready.
- Deliverable: evidence/run-manifest.json
- Acceptance: Technical and UX gates separately recorded; actual evidence manifest, no secret.
- Tests: T35, T36, T53, T54, T55
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H14 — Freeze and deliver
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H13; Requirements: R12, R19
- Implementation: Document exact commands, test results, limitations, screenshots; update pitch with actual proof if available; no unauthorized submission.
- Deliverable: README + PROJECT-STATE + demo evidence
- Acceptance: Single-session handoff, truthful state, final rehearsal.
- Tests: T37
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H15 — Optional x402 live compatibility
- Priority / owner: P1 / Founder / coding agent
- Dependencies: H13; Requirements: R20
- Implementation: Reuse verified integration or short bounded spike only if core passes; otherwise direct Anchor with explicit not-connected/preview.
- Deliverable: transport evidence
- Acceptance: Actual full atomic settlement via compatible x402 or clearly omitted.
- Tests: T38, T56
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H16 — Shared agent tools and spend guard
- Priority / owner: P0 / Founder / coding agent
- Dependencies: H07; Requirements: R16, R20
- Implementation: Implement typed tool facade and durable serialized cap; optional stdio MCP handshake if SDK ready; use same functions for deterministic driver.
- Deliverable: tool facade
- Acceptance: Actual calls and cap/replay/access tests, MCP state accurately labeled.
- Tests: T33, T39, T46, T47
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## H17 — Optional external AI agent
- Priority / owner: P1 / Founder / coding agent
- Dependencies: H13, H16; Requirements: R16, R20
- Implementation: Use installed external client only if available; actual tool trace or label deterministic. No new credentials or long setup.
- Deliverable: agent evidence
- Acceptance: Actual external trace or explicit not-connected.
- Tests: T48
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## B01 — Post-event online product validation
- Priority / owner: Later / Founder / coding agent
- Dependencies: None; Requirements: setup/commercial
- Implementation: AI desk research and opt-in product analytics; actual paid demand after legal approval.
- Deliverable: market evidence
- Acceptance: Document actual evidence, not AI estimates
- Tests: 
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.


## B02 — Post-event commercial and scale review
- Priority / owner: Later / Founder / coding agent
- Dependencies: B01; Requirements: setup/commercial
- Implementation: Post-event commercial gates G5–G7: rent compression/batching, delivery/refund, bounty dispute/producer risk, rights, independent quality, actual demand and compliance. Use POST-HACKATHON-SCALING; no real sales without separate approval.
- Deliverable: commercial review
- Acceptance: Separate commercial GO decision
- Tests: 
- Done: record actual diff, commands, results, mode and blockers in PROJECT-STATE; no fabricated pass. Preserve prior evidence and test affected behavior. Use local disposable fixtures, no real funds.
