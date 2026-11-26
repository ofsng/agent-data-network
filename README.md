# Agent Data Network (ADN)

**Discover → Purchase → Verify → Commission → Reuse.**

**Live (read-only Devnet copy):** https://agent-data-network.vercel.app · Submission texts: [SUBMISSION.md](SUBMISSION.md) · Video script: [DEMO-SCRIPT.md](DEMO-SCRIPT.md)

 AI agents buy exactly the licensed data units they need. In **one atomic Solana transaction** they pay several independent providers. They prove what they bought with **immutable on-chain license receipts**. When data is missing, they finance it with an **on-chain bounty escrow**, and the new data can then be **resold** to the next agent.

> **Built for Dev3pack (27–29 Nov 2026).**
> - The program is **deployed on Solana Devnet**: [`3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8`](https://explorer.solana.com/address/3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8?cluster=devnet). The app runs on Devnet or a local validator, always with real transactions.
> - **Bring your own agent:** an MCP server lets Claude, Cursor or any MCP client search, buy (with its own wallet and a spending cap) and retrieve data.
> - Transparency: payments settle in **aUSD**, a 6-decimal SPL test stablecoin on Devnet; the provider catalog (Voltara products, NorthLab, SouthSupply) is sample data; the built-in research agent is a rule-based planner over typed tools. No mainnet, and no customer or revenue claims.

## Quick start

Prerequisites:
- Solana CLI 4.1.2 (Agave)
- Anchor CLI 1.2.2
- Rust 1.89 toolchain (program build)
- Node 22
- Optional: Google Chrome, for the browser smoke test

Install notes are in [evidence/h02-toolchain.md](evidence/h02-toolchain.md); `scripts/env.sh` puts the pinned tools on `PATH`.

One-time setup. It creates disposable keys in `~/.config/adn-demo/keys` (outside the repo), builds the program, starts a **fresh** local validator, and creates the aUSD mint and config:

```bash
npm run setup
```

Launch the validator (kept between restarts) and the web app:

```bash
npm start
```

Then open **http://127.0.0.1:8787**. Press **Run agent task** to run the built-in agent's task end to end, or **Next step** to follow the 16 steps one by one. **Pause/Resume** stops after the current step. **New session** starts an isolated session with fresh agent wallets; earlier sessions, receipts and all keys are kept.

Headless run of the same agent task (writes `evidence/runs/<runId>.json` and `evidence/run-manifest.json`):

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

The local validator keeps full history (`--limit-ledger-size 50000000`) so every recorded signature stays verifiable. The ledger grows by about 5 GB per hour while the validator runs; set a lower `ADN_LEDGER_SHREDS` (e.g. `2000000`, about 30 minutes of history) if disk is tight, and `npm run setup` wipes it.

### Devnet
| Command | What it does |
|---|---|
| `npm run devnet` | Deploys the program if absent, checks that the deployed bytes equal `target/deploy/adn.so`, bootstraps the aUSD mint and config, runs the full agent task with real Devnet transactions, and verifies it on chain. Each call adds a new run. |
| `npm run start:devnet` | Starts the same UI against Devnet. Every signature links to Solana Explorer. |
| `npm run verify:devnet` | Re-checks the last Devnet run (`evidence/devnet-run-manifest.json`). |

The deployer pays roughly 1.89 SOL of program rent, plus an equally sized temporary buffer during the deploy (refunded), and about 0.15 SOL per session. The public RPC rate-limits (HTTP 429); set `SOLANA_RPC_URL` to another Devnet endpoint if needed. Mainnet URLs are refused.

### Connect your own agent (MCP): the agent does the work
Open **Your agent** in the app, copy the one message there and paste it into Claude Code (or any agent with a terminal). From then on the agent does the setup itself and only asks you when a person must decide:

1. It runs `npm run connect` (add `SOLANA_CLUSTER=devnet` for Devnet). That creates a wallet on this machine (key file 0600, never leaves it), funds it where the marketplace operator's keys are present, sets a starting allowance of 0.5 aUSD with a 0.1 aUSD approval threshold, and registers the `adn` MCP server in Claude Code. Safe to re-run.
2. It asks you to reload MCP servers once (Claude Code: `/mcp`).
3. It calls `get_started`, which reports what is set up, the one next step and anything only you can do, and follows it until `READY`.
4. It works on your request: searches, buys within the allowance and cites receipts.

**What it asks you, and how.** Purchases above the threshold and any new allowance need your OK. Clients that support MCP elicitation (approval dialogs) show you a dialog; otherwise the request waits on the **Your agent** page with Approve / Decline buttons, and the agent polls `check_request`. The same page shows the agent's wallet, allowance, pending requests and every action it took, live. If this machine has no operator keys, the agent asks you to send it aUSD and SOL instead of funding itself.

**Allowances, not a growing cap.** Each allowance is a fixed budget that can't be expanded in place; more budget is a new allowance a human approved (in the dialog, on the page, or with `npm run cli -- allow 0.5`). Spend from earlier allowances stays counted. Change the defaults with `npm run connect -- --allowance 1 --approve-above 0.2`.

| Tool | Kind | What it does |
|---|---|---|
| `get_started` | setup | Status, the single next step, and what to ask the human. |
| `create_wallet`, `fund_wallet` | setup | Wallet on this machine; top-up where operator keys are present, otherwise a request to the human. |
| `request_budget`, `check_request` | setup | Ask the human for an allowance; follow a pending request. |
| `search_data`, `get_data_quote`, `verify_receipt`, `list_bounties`, `get_bounty_status`, `network_status` | open | Metadata search, exact quotes, on-chain receipt checks, bounties. Never returns paid bytes. |
| `wallet_status` | wallet | Balance, allowance, spent, remaining, approval threshold, purchases. |
| `purchase_data` | wallet | Buys 1–2 units in one transaction: quote + trust preflight, allowance check, human OK above the threshold, sign, finalize, verify receipts. |
| `retrieve_data` | wallet | Wallet-signed challenge, exact bytes, hash-checked against the receipt. |

The server also ships its usage rules as MCP instructions, and two prompts: `get_started` and `procurement_brief`. There is no generic signing tool. Approvals protect against agent mistakes; anyone with full access to the machine can still read the key file.

## Guided tour and Control page
- **Tour:** the first visit opens a short spotlight walkthrough (Turkish or English, switchable). Every other part of the screen is dimmed while one part is explained in plain words. Reopen it with the **?** button.
- **Control:** a compact console for the whole task: run controls, wallet balances, a market list, a read-only quote, on-chain receipt verification and bounty escrow status. The other pages keep the full detail.
- **Explainer video (Turkish):** `video/record.ts` records the tour and a live run; `video/build.py` speeds up the run segment, adds the narration clips listed in `video/narration.json` and burns in Turkish subtitles.

## The agent task (one session)
| # | Step | What happens on chain (all real, local validator) |
|---|---|---|
| 1 | Providers publish | 24 units from NorthLab (manufacturer datasheets) and SouthSupply (distributor stock, pricing, logistics): `register_data_asset` fixes price, version, content hash and license hash. The trust sidecar records source, rights and schema; accuracy is always UNVERIFIED. |
| 2–3 | Search + quote | Free metadata search; an exact quote passes the preflight: finalized active terms, stored bytes equal the chain hashes, a verified snapshot exists. |
| 4–5 | Atomic purchase | **One tx, 2 × `purchase_unit`** (784 bytes, ~56k CU). Buyer −0.06; each provider +0.024; treasury +0.012 aUSD; two receipt PDAs. |
| 6 | Verify + deliver | Receipt checked on-chain (owner, PDA, buyer, mint, version, hashes, amount). A wallet-signed one-time challenge returns the exact bytes, hash-verified. |
| 7–8 | Gap → bounty | No unit has `recycling`. The agent funds 2 aUSD into a **PDA-owned vault** with a public v2 requirement that does not contain the answer. |
| 9–10 | Submit + review | The provider submits 2 inactive candidates; no payout. A local validator returns **pass/fail only** (the wrong candidate fails `valueMatch`). |
| 11–12 | Accept + deliver | The requester re-runs the review, then signs. Vault −2 → provider +1.6, treasury +0.4. A bounty receipt is written, and the answer is released only now. |
| 13–14 | Activate + resale | The provider activates the unit. A **second agent** buys it for 0.03: the provider earns **again** (+0.024), treasury +0.006. |
| 15 | Refund | A separate requester's bounty expires. The early refund is rejected (`DeadlineNotReached`), then the full 2 aUSD comes back with no fee. |
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
| `src/mcp/server.ts` | MCP stdio server over the same service; opt-in agent wallet with a durable spending cap |
| `src/web/` | Product UI (vanilla JS, no build step); `tour.js` is the guided tour |
| `video/` | Turkish explainer: narration text, recorder and assembly script |
| `tests/anchor/`, `tests/app/`, `scripts/ui-smoke.ts` | Program, app/API/MCP and browser tests |

## Security and trust boundaries
- **Config:** initialization requires the program's upgrade authority. The mint is a fixed legacy 6-decimal mint, and canonical ATAs are required.
- **Purchase checks:** buyer, provider and treasury may not alias. Expected terms and expiry are checked on-chain. Receipts cannot be replayed (`init`).
- **Escrow:** only `reward` leaves the vault, and only once. Unsolicited tokens stay in the vault. A refund is possible only once the deadline has passed.
- **Paid bytes** are returned only through `/deliveries`. That requires a finalized receipt plus a fresh wallet signature on a one-time 60 s nonce. Search, catalog, bounties, health, evidence and logs never contain paid content or the bounty answer (tested).
- **Corrupted stored bytes** fail closed. The exact bytes are restored from a hash-verified snapshot, and the retry is free. Without a valid snapshot, delivery is reported as unresolved (tested).
- **Agent budget:** caps are enforced in SQLite reservations written before signing. Pending spends count against the cap. At most one bounty per run is allowed, and a run's policy cannot be expanded. The first agent's cap is 2.1 aUSD; the second agent and the refund requester have separate caps.
- **Demo routes** are loopback only, require same origin and a per-run token, and run one step at a time. They execute only predefined actions; they never accept keys, transactions or recipients.
- **Trust assumptions:**
  - The program is upgradeable by the demo deployer.
  - The bounty review is an off-chain trusted validator that the program cannot enforce.
  - Payment is atomic, but off-chain delivery is a separate, retryable step.
  - A receipt proves paid entitlement to exact bytes, version and license, not truth, ownership or consumption.

### Public read-only copy
`npm run export:public` writes `public/` from the last complete Devnet session: the same UI reading captured JSON, paid content redacted, every signing action disabled, checked for leaks before writing. Deploy it with `vercel deploy public --prod`.

## Known risks and roadmap
The same table is shown in the app under **Verification & evidence → Open risks**.

| Risk | Today | Next |
|---|---|---|
| A buyer copies data and resells it cheaper | Every listing's content hash is on chain. A later listing of the same bytes by another provider is marked as a copy, hidden from search and refused at quote time (`DUPLICATE_CONTENT`, test T56). The first listing's slot and the copier's own purchase receipt show who listed it first. The license hash in every receipt records the terms. | Per-buyer watermark in delivered bytes, so a leak points to its receipt. |
| A copy with small edits | New bytes get a new hash and pass the copy check. Fast-changing data (prices, stock, lead times) loses value quickly for a copier. | Watermarks; similarity checks at listing time. |
| Fake data submitted to a bounty | The vault pays only on the requester's signed acceptance and only the reward amount; a provider can never pay itself. The requester sees pass/fail only before paying, so the answer can't be taken for free. The review is an off-chain validator the requester must trust. | Dispute window before payout; provider stake lost on a proven fake; issuer-signed answers checked on chain. |
| Wrong or invented catalog data | A receipt proves which bytes were paid for, not that they are true. Source and accuracy are labeled as provider-declared. | Issuer signatures, zkTLS proofs that data came from a named website, provider reputation from dispute history. |
| Seller changes data after payment | Terms and hashes are fixed on chain; delivery fails closed on a mismatch and restores the exact bytes from a verified snapshot. | — |
| Cold start (no sellers without buyers, no buyers without sellers) | Demand comes first: a bounty turns a missing answer into locked, guaranteed payment, so data is produced only when it is already paid for. Accepted answers join the catalog and are resold. Any MCP agent can be a buyer with one config line. | Start in one vertical (equipment procurement data) and seed the first bounties. |

These are design answers, not proven traction: there are no customers yet.

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
