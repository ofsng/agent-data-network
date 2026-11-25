# Decision register
Decided = explicit founder direction; Proposed = implementation baseline, reversible; Verified = documented external fact; Unknown = unresolved; Hypothesis = measurable unproven claim.

| ID | Status | Decision and rationale | Revisit condition |
|---|---|---|---|
| D01 | Decided | Shared data pool; paid atom-level retrieval; reward contributors | Demand fails |
| D19 | Decided | Development first; no physical interviews; AI online research only as needed | Post-event |
| D20 | Decided | 2-day Solana hackathon; synthetic data allowed | Sprint cutoff |
| D29 | Decided | Adopt feedback: Anchor, on-chain asset/receipt, atomic multi-provider settlement, funded bounty | Only founder-directed change |
| D30 | Proposed | P0 direct buyer-signed Anchor transactions; x402 V2 optional if actual facilitator accepts complete transaction and receipt rent payer | H02 spike, 45 min max |
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
