# Decision register
Decided = explicit founder direction; Proposed = implementation baseline, reversible; Verified = documented external fact; Unknown = unresolved; Hypothesis = measurable unproven claim.

| ID | Status | Decision and rationale | Revisit condition |
|---|---|---|---|
| D01 | Decided | Shared data pool; paid atom-level retrieval; reward contributors | Demand fails |
| D19 | Decided | Development first; no physical interviews; AI online research only as needed | Post-event |
| D20 | Decided | 2-day Solana hackathon; synthetic data allowed | Sprint cutoff |
| D29 | Decided | Adopt feedback: Anchor, on-chain asset/receipt, atomic multi-provider settlement, funded bounty | Only founder-directed change |
| D30 | Proposed | P0 direct buyer-signed Anchor transactions; x402 V2 optional if actual facilitator accepts complete transaction and receipt rent payer | H15 optional spike, 45 min max; reuse H02 evidence |
| D31 | Proposed | Two distinct providers/units in one transaction using two purchase_unit instructions; no dynamic account arrays. Three-unit bundle stretch after measuring 1232-byte limit | H05 serialization |
| D32 | Proposed | Original SPL Token Program, fixed 6 decimals, verified Devnet test mint or custom mint labeled DEMO (never pretend USDC), immutable config 2000 bps | H02 mint proof |
| D33 | Proposed | Provider share = amount minus floor(amount × 2000 / 10000); applies to purchase and bounty; buyer/requester funds SOL fees and receipt rent | Cost measurement |
| D34 | Proposed | Receipt proves paid entitlement for hash/version/license, not legal ownership, actual consumption, correctness or delivery. No close/reuse. | Post-event storage strategy |
| D35 | Proposed | Buyer signs approval of bounty submission; no payout on upload; refund at expiry; no arbitration or partial rewards in demo | Real pilot |
| D36 | Proposed | One Next.js Node app, persistent SQLite, local protected CLI wallets, metadata search, UTF-8 synthetic JSON/text, deterministic agent | Pilot |
| D37 | Proposed | Bounty submission asset registered inactive; provider can activate after settlement; original license allows nonexclusive resale | License review |
| D38 | Proposed | Only local/protected demo; no exposed signing endpoints or raw paid payload; direct token transfers, not internal wallet balance | Security review |
| D39 | Unknown | Actual program/toolchain compatibility, mint/funding, contest rules, x402 runtime, account rent & transaction size | H01/H02/H05 |
| D40 | Hypothesis | Combined license evidence, multi-party payment and funded demand improve buyer trust enough to pay | Online pilot after event |

Supersedes V1.2 off-chain earnings and mandatory x402. No compliance rationale prohibits Devnet Anchor demo; mainnet commercial/legal gate is separate. No claim that competitors cannot copy. No token issuance for fundraising (a test-only mint is allowed).

## V1.4 delta (25 November 2026)
Founder accepted the feedback-driven revision in the conversation. The following decisions supersede conflicting V1.3 language, without changing the on-chain ABI.
| ID | Status | Decision | Revisit |
|---|---|---|---|
| D41 | Decided | Preserve V1.3 core, prioritize funded demand as supply-growth engine; synthetic solar equipment demo, no physical research. | Post-event evidence |
| D42 | Proposed | P0 off-chain Trust Layer: source declaration, timestamp, license attestation, schema and SHA-256 checks; distinguish integrity, schema validity and truth. | Real rights and data audit |
| D43 | Proposed | P0 quote preflight checks exact archived bytes; persistent SQLite backup and recovery; retry original receipt free. No claim of fair exchange. | Commercial delivery design |
| D44 | Proposed | P0 bounty review exposes bounded metadata and pass/fail criteria, no full body or answer; private local deterministic validator plus requester-signed accept; use new requirement schema for new bounties only. | Independent validation and dispute design |
| D45 | Proposed | P1 product MCP stdio adapter + external model tool-call evidence, no public remote signer; deterministic P0 fallback. Solana developer MCP remains distinct. | After P0 and available time |
| D46 | Proposed | Preserve 8 instructions, PDA seeds, mint, config and immutable receipts; no program upgrade just for V1.4 unless actual bug requires it; original body/license bytes unchanged. | Actual implementation conflict |
| D47 | Proposed | H12 UI, H15 x402, H16 MCP, H17 live agent optional; final 3 hours protected. Product MCP before x402 if both feasible. | Real remaining time |
| D48 | Proposed | Commercial NO-GO until receipt rent, paid delivery recovery/refund, bounty producer protection, rights and actual demand proven. | G5–G7 |
| D49 | Unknown | Existing repo implementation status and actual remaining hours; inspect, preserve and reconcile before coding. | Migration audit |

## V1.5 active decisions (supersede D20/D30/D36/D45/D47 where conflicting)
| ID | Status | Decision |
|---|---|---|
| D50 | Decided | Optimize for one autonomous AI coding session, polished hackathon demo, retain V1.4 functional story; no production infrastructure requirement. |
| D51 | Proposed | Actual local validator is baseline technical proof; Devnet optional unless official rules mandate it; isolated simulation only for honest fallback, never technical pass. |
| D52 | Proposed | Guided browser demo mandatory, deterministic tools and evidence mandatory, real model/MCP handshake and x402 compatibility stretch; no new accounts/services. |
| D53 | Proposed | Add accepted bounty resale using existing activation and purchase_unit, no ABI changes. |
| D54 | Proposed | Simplify backup to verified local immutable snapshot and use serialized durable run guard; preserve working stronger implementation. |
| D55 | Unknown | Current repo state, actual coding session capacity and official rules; no completion guarantee. |
All prior commercial NO-GO and honesty constraints retained.
