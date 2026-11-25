# Test execution matrix
All tests PENDING in this template (reconcile existing runtime evidence before rerunning); no runtime program tested yet. Use actual local validator for success, refund and adversarial scenarios; Devnet optional unless official rules mandate it. Inputs: synthetic fixtures, fresh disposable wallets, configured mint, real program ID. Automated where practical; retain tx logs, balance snapshots and assertions. Every failed P0 test blocks corresponding completion, never mark actual-chain tests passed from simulation alone.

| ID | Area | Steps | Expected result / acceptance | Status |
|---|---|---|---|---|
| T01 | Rules | Record official allowed window, deadline, AI rules and submission; mark missing fields unknown | No coding outside permitted period | PENDING |
| T02 | Toolchain | Run actual anchor build/test and record versions; verify official skill/MCP installation | Toolchain works or documented blocker | PENDING |
| T03 | Mint/x402 | Check mint owner/decimals/funding; direct Anchor readiness; facilitator compatibility deferred to T38 | Correct mint and direct Anchor ready | PENDING |
| T04 | Initializer | Attempt unauthorized config init then authorized init and repeat | Unauthorized and repeat fail; correct config | PENDING |
| T05 | Registry | Register correct asset; attempt wrong provider status update and changed immutable fields | Only provider toggle; price/hash unchanged | PENDING |
| T06 | Registry invalid | Attempt zero price, zero hash, invalid version and duplicate PDA | All reject, no initialized asset | PENDING |
| T07 | Canonical hashes | Import 12 fixtures and recalculate exact body/license SHA256 | All match stored bytes | PENDING |
| T08 | Search | Search inverter X100 efficiency and lead time; inspect raw response; missing recycling tag | A01+B01, no body, gap true | PENDING |
| T09 | Bundle success | Sign two purchase instructions same tx from buyer; read all token pre/post balances | Buyer -60000, providerA +24000, providerB +24000, treasury +12000, 2 receipts | PENDING |
| T10 | Receipt integrity | Decode receipt PDA and compare all hash/license/version/price fields | Exact match, correct owner/kind/buyer | PENDING |
| T11 | Size/CU | Serialize actual signed bundle and simulate | <=1232 bytes and simulation succeeds; record CU | PENDING |
| T12 | Rounding | Test amount 30001 and small positive amount | fee floor; sum exact, no overflow | PENDING |
| T13 | Atomic failure | Second instruction invalid terms after first valid; submit/simulate local validator transaction | No provider/treasury delta or receipts; network fee may apply | PENDING |
| T14 | Replay | Rebuild same order ID and asset with fresh blockhash | Duplicate init rejects; no additional payment | PENDING |
| T15 | Wrong accounts | Substitute wrong mint, wrong ATA, provider/treasury alias, unauthorized buyer token source | Reject all; no movement | PENDING |
| T16 | Stale asset | Deactivate after quote, change expected hash/price, or let quote expire | Reject all; old receipt remains valid | PENDING |
| T17 | Insufficient funds | Buyer balance covers first but not second instruction | Whole transaction fails, no receipt | PENDING |
| T18 | Delivery authorization | No receipt, forged PDA, wrong owner/mint/buyer or invalid signature | No body returned | PENDING |
| T19 | Nonce replay | Replay same challenge or expired challenge, then new valid challenge | First replay denied; fresh valid proof accepted | PENDING |
| T20 | Hash mismatch | Modify stored exact bytes after receipt; attempt delivery | HashMismatch, no body; restore and retry free | PENDING |
| T21 | Pending recovery | Simulate RPC timeout and DB crash after tx; reconcile same order ID | Pending not recharged; recover same receipt from finalized chain | PENDING |
| T22 | Quote limits | Duplicate asset/provider, over-budget or >2 items; search oversized input | Reject, no signing or charge | PENDING |
| T23 | Purchase E2E | Run deterministic CLI using actual receipt-gated retrieval | Two source-linked facts, signature, exact hashes; no raw free facts | PENDING |
| T24 | Escrow funding | Create 2 TEST bounty with valid deadline; read balances | Requester -2000000; vault +2000000; OPEN | PENDING |
| T25 | Submission | Provider registers inactive asset, submits; check vault | No release; correct submission PDA | PENDING |
| T26 | Submission invalid | Wrong owner, expired/closed bounty, active asset or wrong bounty reference | Reject; no funds move | PENDING |
| T27 | Accept success | Requester accepts validated submission; read balances and receipt | Vault -2000000; provider +1600000; treasury +400000; ACCEPTED; bounty receipt | PENDING |
| T28 | Unauthorized accept | Wrong signer, wrong submission/asset/hash/vault/ATA | All reject; OPEN and funds unchanged | PENDING |
| T29 | Refund boundaries | Try early refund, then expired refund; try accept at/after expiry | Early refund rejected; full reward returned; no fee; late accept rejected | PENDING |
| T30 | Double release/race | Repeat accept/refund and concurrent competing accept/refund | Exactly one terminal transition, no repeat payout | PENDING |
| T31 | Vault dust | Send unsolicited test tokens then accept/refund | Exactly reward transferred; surplus reported, no sweep | PENDING |
| T32 | Gap E2E | Missing field→fund→submit→reject wrong fixture→accept correct→deliver→activate | No auto-payout; source appears after activation; receipt verifies | PENDING |
| T33 | Budget | Attempt reward beyond remaining token/SOL cap; concurrent mutation, unknown commitment and second bounty | No creation/signing; durable serialized reservations and pending commitments enforced | PENDING |
| T34 | UI | Inspect responsive catalog/receipt/bounty pages, pending state, trust labels and links | No private bytes or false success; correct mode | PENDING |
| T35 | Real chain evidence | Run initial bundle and bounty on actual local validator or Devnet; decode accounts and deltas | Real signatures, two receipts, accepted bounty, separate refund; runtime labeled | PENDING |
| T36 | Runtime evidence | Check mode, program ID, actual fees/deposits, no secret; links only for Devnet | Local RPC evidence or actual Devnet Explorer; no fake signature | PENDING |
| T37 | Submission | Check video length, source visibility, AI disclosure and truthful deck | Official requirements met or named blocker | PENDING |
| T38 | Optional x402 | Run genuine reference client/facilitator with complete receipt tx | Standard verified only if full same tx works | PENDING |
| T39 | Tool facade | Discover typed tools and call search/quote; stdio MCP handshake only if implemented | Actual tool results; MCP connected/not connected accurate | PENDING |
| T40 | Trust validation | Import valid known fixture then malformed UTF-8, empty/oversized body, missing rights, future timestamp and invalid JSON | Known fixture valid, bad inputs not published; accuracy UNVERIFIED | PENDING |
| T41 | Trust migration and leakage | Migrate populated V1.3 SQLite copy; backfill known fixtures only; inspect metadata/errors/logs | Original bytes/PDAs/receipts unchanged; unknown rows blocked from quote; no raw body; source declaration not truth | PENDING |
| T42 | Prequote availability | Corrupt body/license, remove snapshot or mismatch chain terms before quote | 422/503; no quote/signing/payment; exact restore enables quote | PENDING |
| T43 | Post-payment recovery | Finalize purchase, deactivate listing, restart app, corrupt/delete primary bytes, restore exact backup and retry with fresh challenge | Exact original hashes, old entitlement remains; receipts and newer state retained; no new charge; unavailable if backup invalid | PENDING |
| T44 | Bounty review privacy | Inspect public v2 requirement/metadata, wrong and valid submissions, local review outputs and logs | Expected value/body not exposed; wrong fixture fails; correct report binds exact hashes and pass flags only; no payout on review | PENDING |
| T45 | Bounty binding/legacy | Attempt accept stale review or substituted submission; try legacy requirement migration; accept new reviewed v2 and retrieve | App rejects mismatched/stale review; existing hash unchanged; new receipt gates full bytes; signed accept only; no claim of oracle | PENDING |
| T46 | Tool contract | Call actual typed tools, invalid inputs, wrong buyer retrieval; if MCP installed test real client handshake | Same API, no secrets, denied private data, label MCP state accurately | PENDING |
| T47 | Run budget (P0) | Concurrent quotes/spends, unknown timeout, over token/SOL cap, second bounty, arbitrary recipient or instruction, prompt injection | Serialized durable reservations, pending counts, no generic signer/extra spend, no automatic replenishment | PENDING |
| T48 | External model (P1) | Use actual MCP-capable agent, sanitized tool trace and verify claimed tx/receipts | Genuine client/tool trace or explicitly skipped; no fabricated LLM behavior | PENDING |
| T49 | UI happy path | Run guided UI through all scenes | Actual trace and state, no uncaught errors; visible receipts, bounty and reuse | PENDING |
| T50 | UI privacy | Inspect before purchase/accept and logs | No paid body or bounty answer; source/accuracy labels accurate | PENDING |
| T51 | UI failure | Trigger failed quote or pending transaction, retry | No success animation; actionable state; no duplicate charge | PENDING |
| T52 | Reuse | Activate accepted asset and buy via separate wallet/order; verify receipt | Buyer -30000, provider +24000, treasury +6000; exact body delivered | PENDING |
| T53 | Reset | Run full demo twice with isolated IDs | Two coherent runs, no stale receipts or mutation of historic state | PENDING |
| T54 | Mode | Test simulation and actual chain separately | Explicit mode; simulation cannot be recorded as technical proof; no fake links | PENDING |
| T55 | Reproduction | Fresh sandbox run documented setup/start/test/reset | Commands run without manual DB edits; evidence manifest and errors visible | PENDING |
| T56 | Transport | Inspect direct Anchor/x402 state; if live x402 available test full bundle | No double charge; preview explicitly non-protocol, no false compatibility | PENDING |
