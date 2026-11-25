# Agent Data Network (ADN)

**Discover → Purchase → Verify → Commission → Reuse.**

Submission texts: [SUBMISSION.md](SUBMISSION.md) · Video script: [DEMO-SCRIPT.md](DEMO-SCRIPT.md)

 AI agents buy exactly the licensed data units they need. In **one atomic Solana transaction** they pay several independent providers. They prove what they bought with **immutable on-chain license receipts**. When data is missing, they finance it with an **on-chain bounty escrow**, and the new data can then be **resold** to the next agent.

> **Hackathon prototype (Dev3pack, 27–29 Nov 2026).**
> - The program is **deployed on Solana Devnet**: [`3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8`](https://explorer.solana.com/address/3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8?cluster=devnet). The same guided demo runs on Devnet or on a local validator, always with real transactions.
> - All data is **synthetic**. Payments use a custom **TEST** SPL mint (6 decimals) with **no monetary value**. No mainnet.
> - The agent is a **deterministic, rule-based driver** using typed tools. It is **not an LLM**.
> - A **read-only MCP stdio server** lets external agents search, quote, verify receipts and read bounties. x402 is not used.
> - There are no customers, revenue or traction claims.

## Quick start

Prerequisites:
- Solana CLI 4.1.2 (Agave)
- Anchor CLI 1.2.2
- Rust 1.89 toolchain (program build)
- Node 22
- Optional: Google Chrome, for the browser smoke test

Install notes are in [evidence/h02-toolchain.md](evidence/h02-toolchain.md); `scripts/env.sh` puts the pinned tools on `PATH`.

One-time setup. It creates disposable keys in `~/.config/adn-demo/keys` (outside the repo), builds the program, starts a **fresh** local validator, and creates the TEST mint and config:

```bash
npm run setup
```

Launch the validator (kept between restarts) and the web app:

```bash
npm start
```

Then open **http://127.0.0.1:8787**. Press **Run full demo** to run end to end, or **Next step** to go through the 16 steps one by one. **Pause/Resume** stops after the current step. **Reset demo** starts a new isolated run with fresh agent wallets; earlier runs, receipts and all keys are kept.

Headless run of the same guided demo (writes `evidence/runs/<runId>.json` and `evidence/run-manifest.json`):

```bash
npm run demo
```

Full regression, with the app running. It runs the Rust unit tests, the program tests on an **isolated** validator, the app/API tests and a browser smoke test that drives the whole UI. Results go to `evidence/test-summary.json`:

```bash
npm test
```

Re-verify every transaction and receipt in `evidence/run-manifest.json` against the chain:

```bash
npm run verify
```

`npm run setup` is also the full reset. It wipes only the local ledger, the local SQLite cache, the local snapshots and local run evidence; it never touches the keys or Devnet evidence.

The local validator keeps about 30 minutes of history (`--limit-ledger-size 2000000`, roughly 2–3 GB), so run `npm run verify` soon after a run. Larger values grow by about 5 GB per hour; override with `ADN_LEDGER_SHREDS` if you have the disk.

### Devnet
| Command | What it does |
|---|---|
| `npm run devnet` | Deploys the program if absent, checks that the deployed bytes equal `target/deploy/adn.so`, bootstraps the TEST mint and config, runs the full guided demo with real Devnet transactions, and verifies it on chain. Each call adds a new run. |
| `npm run start:devnet` | Starts the same UI against Devnet. Every signature links to Solana Explorer. |
| `npm run verify:devnet` | Re-checks the last Devnet run (`evidence/devnet-run-manifest.json`). |

The deployer pays roughly 1.89 SOL of program rent, plus an equally sized temporary buffer during the deploy (refunded), and about 0.15 SOL per demo run. The public RPC rate-limits (HTTP 429); set `SOLANA_RPC_URL` to another Devnet endpoint if needed. Mainnet URLs are refused.

### MCP (external agents, read-only)
```bash
npm run mcp
```
This is a stdio MCP server with six tools: `network_status`, `search_data`, `get_data_quote`, `verify_receipt`, `list_bounties` and `get_bounty_status`. It holds no keys, signs nothing and never returns paid bytes. Purchases stay with the demo's budgeted agent wallets. To use it from an MCP client, configure the command `npx tsx src/mcp/server.ts` with this repository as the working directory, and add `SOLANA_CLUSTER=devnet` to read Devnet.

## The demo story (one browser session)
| # | Step | What happens on chain (all real, local validator) |
|---|---|---|
| 1 | Providers publish | 12 synthetic units from NorthLab and SouthSupply: `register_data_asset` fixes price, version, content hash and license hash. The trust sidecar records source, rights and schema; accuracy is always UNVERIFIED. |
| 2–3 | Search + quote | Free metadata search; an exact quote passes the preflight: finalized active terms, stored bytes equal the chain hashes, a verified snapshot exists. |
| 4–5 | Atomic purchase | **One tx, 2 × `purchase_unit`** (784 bytes, ~56k CU). Buyer −0.06; each provider +0.024; treasury +0.012 TEST; two receipt PDAs. |
| 6 | Verify + deliver | Receipt checked on-chain (owner, PDA, buyer, mint, version, hashes, amount). A wallet-signed one-time challenge returns the exact bytes, hash-verified. |
| 7–8 | Gap → bounty | No unit has `recycling`. The agent funds 2 TEST into a **PDA-owned vault** with a public v2 requirement that does not contain the answer. |
| 9–10 | Submit + review | The provider submits 2 inactive candidates; no payout. A local validator returns **pass/fail only** (the wrong candidate fails `fixtureMatch`). |
| 11–12 | Accept + deliver | The requester re-runs the review, then signs. Vault −2 → provider +1.6, treasury +0.4. A bounty receipt is written, and the answer is released only now. |
| 13–14 | Activate + resale | The provider activates the unit. A **second agent** buys it for 0.03: the provider earns **again** (+0.024), treasury +0.006. |
| 15 | Refund | A separate requester's bounty expires. The early refund is rejected (`DeadlineNotReached`), then the full 2 TEST comes back with no fee. |
| 16 | Brief | A research brief citing each fact's unit and receipt; earnings come from measured balance changes. |

The UI has eight sections:
- **Overview** (guided story, budget, tool trace, live balances, escrow, receipts)
- **Agent workspace**
- **Data marketplace**
- **Provider workspace**
- **Data bounties**
- **Transactions & receipts**
- **Provider earnings**
- **Verification & evidence**

Every number shown comes from the run's actual state.

## Architecture
| Path | Role |
|---|---|
| `programs/adn/src/lib.rs` | Anchor program: 8 instructions. The ABI is unchanged since V1.3. |
| `src/chain/` | PDA derivation, exact bundle builder, finalized receipt verifier, operator ops, receipt-first reconciliation |
| `src/data/store.ts`, `trust.ts`, `migrations/` | SQLite store, canonical bytes, metadata search; trust sidecar, input validation, per-asset verified snapshots (0600, outside repo), exact-byte recovery |
| `src/api/service.ts`, `server.ts` | Shared service (quote preflight, wallet-bound delivery, bounty views); loopback HTTP API + guarded `/api/demo` routes + static UI |
| `src/agent/tools.ts`, `budget.ts` | Typed tools (search_data, get_data_quote, purchase_data, settle_purchase, verify_receipt, retrieve_data, create_bounty, get_bounty_status); durable spend reservations. There is **no generic signing tool**. |
| `src/demo/` | Guided state machine (READY → … → COMPLETE), bounded bounty review, scene narration |
| `src/mcp/server.ts` | Read-only MCP stdio server over the same service |
| `src/web/` | Product UI (vanilla JS, no build step) |
| `tests/anchor/`, `tests/app/`, `scripts/ui-smoke.ts` | Program, app/API/MCP and browser tests |

## Security and trust boundaries
- **Config:** initialization requires the program's upgrade authority. The mint is a fixed legacy 6-decimal mint, and canonical ATAs are required.
- **Purchase checks:** buyer, provider and treasury may not alias. Expected terms and expiry are checked on-chain. Receipts cannot be replayed (`init`).
- **Escrow:** only `reward` leaves the vault, and only once. Unsolicited tokens stay in the vault. A refund is possible only once the deadline has passed.
- **Paid bytes** are returned only through `/deliveries`. That requires a finalized receipt plus a fresh wallet signature on a one-time 60 s nonce. Search, catalog, bounties, health, evidence and logs never contain paid content or the bounty answer (tested).
- **Corrupted stored bytes** fail closed. The exact bytes are restored from a hash-verified snapshot, and the retry is free. Without a valid snapshot, delivery is reported as unresolved (tested).
- **Agent budget:** caps are enforced in SQLite reservations written before signing. Pending spends count against the cap. At most one bounty per run is allowed, and a run's policy cannot be expanded. The first agent's cap is 2.1 TEST; the second agent and the refund requester have separate caps.
- **Demo routes** are loopback only, require same origin and a per-run token, and run one step at a time. They execute only predefined actions; they never accept keys, transactions or recipients.
- **Trust assumptions:**
  - The program is upgradeable by the demo deployer.
  - The bounty review is an off-chain trusted validator that the program cannot enforce.
  - Payment is atomic, but off-chain delivery is a separate, retryable step.
  - A receipt proves paid entitlement to exact bytes, version and license, not truth, ownership or consumption.

## Evidence
- `evidence/run-manifest.json` is the last complete run. It contains real local signatures, slots, fees, decoded receipts, balance deltas, hash checks, the review reports, budgets, gates and limitations. `evidence/runs/` holds every run.
- `evidence/test-summary.json`, `local-anchor-tests.txt`, `local-api-tests.txt` and `ui-smoke.json` are the test results. `evidence/screenshots/` holds the UI screenshots from the smoke run.
- `evidence/rules.md` records the contest rules, and `evidence/h02-toolchain.md` the toolchain and the x402 decision.
- Local signatures exist only on the local ledger. They have no Explorer link; verify them all with `npm run verify` (uses `getTransaction` + decoded receipt accounts; the validator keeps full history via `--limit-ledger-size`).

- Devnet: `evidence/devnet-deploy.json` (program, deployed-bytes hash match, Explorer link), `evidence/devnet-run-manifest.json` (every signature with an Explorer link), `evidence/devnet-demo-output.txt` and `evidence/devnet-verify-output.txt`.

## Hackathon disclosure
- **Built before vs. during:** planning documents (`STARTUP-PACKAGE/`, V1.3 to V1.5) predate the code. All code was written from 2026-11-25 onward; git history shows the timeline. The event FAQ allows prior work on your own Solana project if it is disclosed.
- **AI assistance:** implemented with Claude Code (Anthropic) under the founder's direction. The event allows AI tools.
- License: MIT for code. The fixtures are fictional (`fixtures/LICENSE.txt`).
