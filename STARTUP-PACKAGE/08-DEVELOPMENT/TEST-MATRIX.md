# Test execution matrix
All tests PENDING; no runtime program tested yet. Use local validator for adversarial scenarios, Devnet for success/refund evidence. Inputs: synthetic fixtures, fresh disposable wallets, configured mint, real program ID. Automated where practical; retain tx logs, balance snapshots and assertions. Every failed P0 test blocks corresponding completion, never mark passed from simulation alone for Devnet success.

| ID | Area | Steps | Expected result / acceptance | Status |
|---|---|---|---|---|
| T01 | Rules | Record official allowed window, deadline, AI rules and submission; mark missing fields unknown | No coding outside permitted period | PENDING |
| T02 | Toolchain | Run actual anchor build/test and record versions; verify official skill/MCP installation | Toolchain works or documented blocker | PENDING |
| T03 | Mint/x402 | Check mint owner/decimals/funding and facilitator support; try full custom bundle if feasible | Correct mint; direct fallback when unverified | PENDING |
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
| T33 | Budget | Attempt reward beyond remaining per-run cap | No creation/signing | PENDING |
| T34 | UI | Inspect responsive catalog/receipt/bounty pages, pending state and links | No private bytes or false success; real explorer cluster | PENDING |
| T35 | Devnet evidence | Deploy and read actual finalized tx and program accounts; record rent/CU/size/deltas | Both core demos and refund verified on Devnet or explicitly blocked | PENDING |
| T36 | Secret/repro scan | Check git diff, env files, logs and restart app; rerun local smoke | No secrets; reproducible persistent cache and documented commands | PENDING |
| T37 | Submission | Check video length, source visibility, AI disclosure and truthful deck | Official requirements met or named blocker | PENDING |
| T38 | Optional x402 | Run genuine reference client/facilitator with complete receipt tx | Standard verified only if full same tx works | PENDING |
| T39 | Optional extension | Test MCP authentication or 3-unit atomic tx | Verified optional output; otherwise omitted | PENDING |
