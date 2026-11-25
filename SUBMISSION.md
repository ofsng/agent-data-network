# Dev3pack submission: ready-to-paste texts

Each section matches a step of the official submission form (FAQ, "What do I need to submit?").

## Step 1: Project

**Name:** Agent Data Network

**One-liner:** AI agents buy exactly the licensed data units they need, pay every provider in one Solana transaction, prove it with on-chain receipts, and fund missing data with escrowed bounties.

**Category (optional):** AI / Agents · Data infrastructure

**Contract address (Devnet):** `3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8`. Explorer: https://explorer.solana.com/address/3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8?cluster=devnet

**Hub:** _choose your local hub in the form (e.g. Türkiye)_

**Description:**

> AI agents increasingly need small, specific pieces of licensed data from many owners: a spec sheet from one supplier, a lead time from another, a certificate nobody has published yet. Today they scrape, guess, or buy whole datasets. Nobody can prove what was licensed, contributors are not paid per use, and missing data stays missing.
>
> Agent Data Network is an Anchor program plus a small service and UI that turn data units into on-chain-priced, verifiable purchases:
>
> - **Atomic multi-provider purchase.** One transaction with several `purchase_unit` instructions pays every provider (80%) and the platform (20%) at once, or nothing happens.
> - **License receipts.** Each purchase writes an immutable receipt PDA binding buyer, unit version, content hash, license hash and amount. Paid bytes are delivered only against a verified receipt plus a fresh wallet signature, and are hash-checked.
> - **Data trust layer.** Before quoting, the server proves the stored bytes still equal the on-chain hashes. If data is corrupted after payment, it restores the exact bytes from a verified snapshot and the buyer retries for free.
> - **Bounty escrow for missing data.** When no unit exists, the agent locks a reward in a PDA-owned vault. A provider submits candidates. A bounded review shows pass/fail only, never the answer. On acceptance the vault pays 80/20 and the answer is released. Unanswered bounties are refunded in full after the deadline (early refunds are rejected by the program).
> - **Reuse.** The commissioned data joins the shared catalog, and a second agent buys it, so the provider earns again for the same work.
> - **Agent guardrails.** The agent works only through typed tools, with no generic signing tool. Every spend is reserved against a durable budget cap before signing.
>
> The whole 16-step economic loop runs as real transactions in one guided browser demo, on Devnet or a local validator. All data is synthetic, and payments use a TEST token with no monetary value.

## Step 2: Images
Use the screenshots in `evidence/screenshots/`:
- `01-overview-desktop.png`: guided story and live balances.
- `05-bounties-desktop.png`: escrow and pass/fail review.
- `07-earnings-desktop.png`: provider earnings, including resale.
- `08-evidence-desktop.png`: verification.

## Step 3: Links & video
- **Demo video:** _your YouTube/Loom link, under 3:00, recorded per DEMO-SCRIPT.md_
- **Repo:** _https://github.com/ofsng/<repo> after you make it public_
- **Live link:** the Devnet program in Explorer (above). The app itself is a loopback-only demo (it holds local demo keys), so it is not hosted publicly. Anyone can run it with `npm run setup && npm start`.

## Technical description (for the description field or the README)
- **On-chain:** one Anchor 1.2.2 program, 8 instructions:
  - `initialize_config` (gated by upgrade authority);
  - `register_data_asset`;
  - `set_asset_active`;
  - `purchase_unit`;
  - `create_bounty`;
  - `submit_bounty_solution`;
  - `accept_bounty_solution`;
  - `refund_expired_bounty`.
- **Accounts:** PDAs for config, assets, purchase receipts, bounties, vaults, submissions and bounty receipts. Payment uses a fixed 6-decimal SPL mint and canonical ATAs.
- **Purchase checks:** expected price/version/hash terms and expiry are checked on chain. Buyer, provider and treasury may not alias. Receipts cannot be replayed (`init`).
- **Escrow:** the vault is owned by the bounty PDA. Only `reward` leaves it, and only once. A refund is possible only after the deadline.
- **Measured:** a 2-unit atomic purchase is 784 bytes and about 56k CU, fee 5,000 lamports. A receipt account is 254 bytes.
- **Off-chain:**
  - TypeScript service: SQLite store, canonical bytes, trust sidecar and snapshots, wallet-signed delivery challenges.
  - Guided-demo state machine and vanilla-JS UI.
  - Deterministic agent on typed tools.
  - Read-only MCP stdio server (`npm run mcp`) so external agents can search, quote, verify receipts and read bounties.
- **Tests:**
  - 17 program tests on an isolated validator (rollback, replay, wrong mint/ATA, aliasing, expiry, escrow abuse, refund timing);
  - 2 Rust unit tests;
  - 15 app/API/MCP tests (leaks, auth, preflight, recovery, budgets, resale);
  - a browser smoke test with failure injection and a mobile check.
- `npm run verify` re-checks every recorded signature and receipt on chain.

## Technologies
Solana (Devnet + local validator, Agave 4.1.2), Anchor 1.2.2 (Rust), SPL Token, @solana/web3.js, @anchor-lang/core, TypeScript/Node 22, SQLite (better-sqlite3), tweetnacl (wallet-signed delivery), Model Context Protocol SDK, Playwright (UI smoke), Claude Code (AI-assisted development, disclosed).

## What makes it different
1. **Many providers, one atomic purchase.** Per-unit licensing is split across independent owners in a single transaction, not a subscription to one dataset.
2. **Receipts as license proof.** Agents can show exactly which bytes, version and license they paid for, and delivery is gated by that proof.
3. **Missing data becomes funded demand.** The escrowed bounty, review without revealing the answer, and refund are enforced by the program, not by a platform's promise.
4. **Reuse.** Commissioned data becomes inventory that earns its provider repeat revenue.
5. **Honest trust boundaries.** Receipts prove paid entitlement, not truth. Accuracy is labelled "unverified". The off-chain review and delivery steps are named as trust assumptions.

Remove AI/Solana and it breaks: without the chain there is no atomic split, no receipt and no escrow. Without the agent, nobody buys per unit.

## Team
Solo: Ömer Faruk Şengül (GitHub `ofsng`).

## Disclosure (also in README)
- Planning documents predate the code. All code was written from 2026-11-25 onward; the git history shows the timeline. Prior work on your own Solana project is allowed if disclosed.
- AI-assisted development with Claude Code. The event allows AI tools.
- Synthetic data, TEST token, Devnet only. No mainnet, no real funds, no customers.
