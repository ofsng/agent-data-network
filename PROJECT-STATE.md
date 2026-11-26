# PROJECT-STATE — Agent Data Network (final hackathon release)

Last update: 2026-11-26 (evening). Base scope V1.5 (`STARTUP-PACKAGE/`, archive excluded). Added after the V1.5 release, on the founder's request: guided tour, Control page, copy guard and open-risks table, aUSD naming with real-network framing, agent-first MCP setup with human approvals, and a public read-only copy on Vercel.

**Live (read-only Devnet copy):** https://agent-data-network.vercel.app · **Repo (public):** https://github.com/ofsng/agent-data-network

## Gates
| Gate | Status | Evidence |
|---|---|---|
| Devnet deployment | **MET**: program `3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8`, upgrade authority = demo deployer; deployed bytes sha256 `94bb22a4…bbe687` equal `target/deploy/adn.so` | evidence/devnet-deploy.json, devnet-program-show.txt, devnet-deploy-output.txt |
| Technical (Devnet) | **MET**: latest full 16-step session `run-20261126160622-324f29` with real Devnet transactions; 10 economic/registry txs and 4 receipts re-verified on chain (first one: `run-20261125222532-6b1667`) | evidence/devnet-run-manifest.json, devnet-demo-output.txt, devnet-verify-output.txt |
| Technical (local validator) | **MET**: the same run on a fresh local validator | evidence/run-manifest.json |
| UX (guided browser demo) | **MET**: full run through the UI, step-by-step and auto, failure + retry, mobile | evidence/ui-smoke.json, evidence/screenshots/ |
| Repository hygiene | **MET**: no keys, wallets, API keys or secrets in the tree or the git history; dev tooling untracked | see "Release checks" |
| Tests | **MET**: 37/37 (Rust 2, Anchor program 17, App/API/MCP 17, browser smoke 1) | evidence/test-summary.json |
| Public copy | **MET**: read-only snapshot of the latest Devnet session on Vercel; paid content redacted, signing disabled, leak-checked on export | `npm run export:public`, public/ (generated) |
| Contest submission | PENDING (founder): video < 3 min, portal form (repo is public) | SUBMISSION.md, DEMO-SCRIPT.md, evidence/rules.md |

## Devnet evidence (real, Explorer-verifiable)
- **Program:** `3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8`. Deploy signature `2GXRCR1iGKVXnb75RZwRDmW8mK7PBbKgD4CVFMPMoWnqWLv3CV15eoJXumDLz6h5whT3jBLuyKVhKyjsuwgs2QRm`, slot 526297989. ProgramData `FQY21Vtkzy2LNntNoKBTYZrtdwrPiwmNpmoFEmAcPaw1`, rent 1.88535564 SOL.
- **aUSD mint:** `DKFLsvxjFa2KJetFquiUH3cr4hp5QRuuiGVGBPjwPMDN` (6 decimals; Devnet test token, no real-money backing; called TEST in the first session).
- **Latest session `run-20261126160622-324f29`:**
  - atomic 2-provider purchase: `5oEj3wfizEPwPiyxswq7zHBwCLzxHNr1QvqyNd3BxNZfSTSDHGbawnmvp7UKmoy4CAE7sFsyu9J1oFnRvHfnMRsW` (agent −0.06, NorthLab +0.024, SouthSupply +0.024, treasury +0.012 aUSD);
  - bounty funded: `3FtymqJ17KZWzsuSNWBgDC2KTgCcvJqv3bufA8fUytXcHNzTzrbankLDWJkqJPsJiN1w4PfviU1jejcTovHeVrYk` (bounty `C6fHzFki3qtPtbKbWiEbw25jE1XRUiMt93c6uXc9eUS1`);
  - accepted: `2NGCd5nZTRkJk6BUXgcYVuCAtoxowe4d3f4fd2Ght5vS2azJZr1ojtUo9jPRLWPZMq1Lx13rsQvJDK8GcwfkXb61` (vault −2, NorthLab +1.6, treasury +0.4);
  - resale: `5FPkLAZJvSFyVyD7NQGzuWnKHhfiQYzXguoT3A6rs3SLgXHLnbbPM1yLBV5iGKXEuekySy9NB3pBPGFgjAvtTNGN` (second agent −0.03, NorthLab +0.024, treasury +0.006);
  - refund: `nZYdksco2ZUivUFQsa5eg3ew7J8ZTUTdBPVWKwBhdKSL43VMHbtvRYQw2TgYnDzdtQKH3BAzgT6rLnwtutxKGQH` after an early refund was rejected (`DeadlineNotReached`); bounty `Gy8VqijguDShTDxZaUCuT49q3ucxuCUFUYRDrQw93wRH`;
  - receipts: `2AxrTtdCha8tgo7VwjjGh4XPubJXDrRmPRRydFLXMhr4`, `DHKhKcb4qHH8BmaEAxXZHtgnnbsmsGqWRJLqFmmzwoYr` (purchase), `6asEahJBuAnwXBGm2eUYPREtbr6rFKAPvDF3zY2HDwAQ` (bounty), `E4NeK6VLczBNrS7FUZVyEpQorKomyLZkgtW7XxW9M1m7` (resale).
- Every signature with an Explorer link is in `evidence/devnet-run-manifest.json`; `npm run verify:devnet` re-checks them.
- **Devnet SOL** (founder-funded, 5 SOL): deploy ≈ 1.89 SOL rent + fees; about 0.15 SOL per session. The deployer had 2.13 SOL left after the latest session. The first deploy attempt with `--use-rpc` stalled on public RPC rate limits; its buffer was closed and the 1.885 SOL refunded.

## Task status
| Task | Status | Notes |
|---|---|---|
| Rules re-check | DONE | Official FAQ re-read 2026-11-26, unchanged:<br>• Devnet accepted<br>• open source mandatory<br>• prior own Solana code allowed if disclosed in README<br>• AI allowed<br>• video under 3 min, strict<br>• 5-step submission form<br>• deadline 29 Nov, UTC hour in the dashboard (evidence/rules.md) |
| Devnet deploy + full loop | DONE | `npm run devnet` (idempotent), `npm run start:devnet`, `npm run verify:devnet` |
| UI final review | DONE | Fixes:<br>• Devnet status is read from evidence instead of the hard-coded "faucet blocked"<br>• deadlines in UTC everywhere<br>• JSON wrapping<br>• market card footer wrap<br>• logo size<br>All buttons are wired and covered by the browser smoke test. |
| MCP, agent-first | DONE | One message pasted into Claude Code: the agent runs `npm run connect`, then `get_started` → `create_wallet` → `fund_wallet` → `request_budget`, and works on the task. Purchases above the threshold (default 0.1 aUSD) and new allowances need the human: MCP elicitation dialog, or Approve/Decline on the **Your agent** page, which also shows the agent's wallet, allowance and activity live. Allowances are fixed RunBudgets (never expanded in place). Usage rules ship as MCP instructions; prompts `get_started`, `procurement_brief`. T54/T55 drive it with real MCP clients. |
| External LLM agent | DONE via MCP | Any MCP client (Claude Code, Claude Desktop, Cursor) is the LLM agent. The built-in agent that runs the 16-step story stays rule-based. |
| Guided tour + Control page | DONE | Spotlight tour (TR/EN, auto on first visit, `?` button); compact exchange-style Control page (run controls, wallets, market, quote, receipt check, bounty status). |
| Copy guard + open risks | DONE | Same bytes relisted later by another provider: flagged, hidden from search, refused at quote (`DUPLICATE_CONTENT`, T56). Open-risks table in the app (Verification & evidence) and README; jury Q&A in SUBMISSION.md. |
| Public read-only copy | DONE | https://agent-data-network.vercel.app: `npm run export:public` then `vercel deploy public --prod`. Rebuild after each new Devnet session. |
| Turkish explainer video | DONE (for the founder, outdated UI) | `video/` tooling; the MP4 is not in git. Recorded before the aUSD naming and the Your agent page. |
| Secret / history scan | DONE | See "Release checks". |
| Demo script / submission texts | DONE | DEMO-SCRIPT.md (target 2:45), SUBMISSION.md |

## Release checks
- **Git history:**
  - no 64-byte keypair arrays in any revision;
  - no API keys, bearer tokens or private-key blocks;
  - author is the founder's own git identity.
- **Untracked from now on:** `.agents/`, `.claude/`, `skills-lock.json` (third-party developer skill docs). They remain in older commits; they contain no secrets.
- **Keys:** operator and provider keys live in `~/.config/adn-demo/`, MCP agent wallets in `~/.config/adn-agent/<cluster>/` (0600, outside the repo). The program keypair is in the ignored `target/`. The public copy contains no keys, no paid content and no local paths (checked on export).
- **Dependency audit:** `npm audit --omit=dev` reports known advisories in transitive dependencies of the Solana JS stack:
  - `bigint-buffer` via spl-token;
  - `toml` via @anchor-lang/core;
  - `stream-json` via web3.js/jayson.

  No non-breaking fix exists. Exposure is limited: the app is loopback-only and parses only local, trusted inputs.

## Fixes found during release verification
- **Ledger size:** the local validator keeps full history (`--limit-ledger-size 50000000`) and grows about 5 GB/hour while running. `ADN_LEDGER_SHREDS` lowers the limit when disk is tight; `npm run setup` wipes the ledger.
- **Public Devnet RPC rate limits (429):** one shared paced fetch with backoff for every Devnet connection. The deploy now uses TPU writes, not `--use-rpc`.
- **Bootstrap after an interrupted first run:** it now reuses the mint recorded in the on-chain config instead of creating a second mint.
- **Evidence per cluster:** `evidence/run-manifest.json` (local) and `evidence/devnet-run-manifest.json`. `npm run setup` no longer deletes Devnet runs.

## Earlier fixes (V1.5)
- Confirmed read-back for new ATAs.
- SOL-spent value now passed explicitly between steps.
- Separate funding and refund deltas.
- Receipt-first reconciliation.
- Isolated test-validator ports.
- UI polish.

## Divergences from spec
- Single Node HTTP server and a vanilla-JS UI instead of Next.js.
- No simulation mode: the UI never shows simulated data.
- Reset starts a new isolated run on the same ledger. `npm run setup` is the full local reset.
- Agent run wallets are generated per run under `~/.config/adn-demo/runs/<cluster>/` (0600) and funded with exactly their caps.

## Founder actions remaining
1. Record the video (< 3:00, English) per DEMO-SCRIPT.md; for the MCP shot, connect Claude Code once beforehand with the message on the **Your agent** page.
2. Fill in the Dev3pack form using SUBMISSION.md before the 29 Nov deadline (check the UTC hour in the dashboard).

## After the hackathon (roadmap, not built)
- Hosted marketplace service (Postgres, always-on server) and the MCP client as an npm package (`npx agent-data-network-mcp`), so only the wallet runs next to each agent.
- A real stablecoin (USDC) instead of the operator-minted aUSD.
- Per-buyer watermarks, bounty dispute window and provider stake, issuer-signed data.
