# PROJECT-STATE — Agent Data Network (final hackathon release)

Last update: 2026-11-26. Scope frozen at V1.5 (`STARTUP-PACKAGE/`, archive excluded). No new features after this release; only fixes found during release verification.

## Gates
| Gate | Status | Evidence |
|---|---|---|
| Devnet deployment | **MET**: program `3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8`, upgrade authority = demo deployer; deployed bytes sha256 `94bb22a4…bbe687` equal `target/deploy/adn.so` | evidence/devnet-deploy.json, devnet-program-show.txt, devnet-deploy-output.txt |
| Technical (Devnet) | **MET**: full 16-step guided run `run-20261125222532-6b1667` with real Devnet transactions; 9 economic/registry txs and 4 receipts re-verified on chain | evidence/devnet-run-manifest.json, devnet-demo-output.txt, devnet-verify-output.txt |
| Technical (local validator) | **MET**: the same run on a fresh local validator | evidence/run-manifest.json |
| UX (guided browser demo) | **MET**: full run through the UI, step-by-step and auto, failure + retry, mobile | evidence/ui-smoke.json, evidence/screenshots/ |
| Repository hygiene | **MET**: no keys, wallets, API keys or secrets in the tree or the git history; dev tooling untracked | see "Release checks" |
| Contest submission | PENDING (founder): video < 3 min, public repo, portal form | SUBMISSION.md, DEMO-SCRIPT.md, evidence/rules.md |

## Devnet evidence (real, Explorer-verifiable)
- **Deploy:** signature `2GXRCR1iGKVXnb75RZwRDmW8mK7PBbKgD4CVFMPMoWnqWLv3CV15eoJXumDLz6h5whT3jBLuyKVhKyjsuwgs2QRm`, slot 526297989. ProgramData `FQY21Vtkzy2LNntNoKBTYZrtdwrPiwmNpmoFEmAcPaw1`, rent 1.88535564 SOL.
- **TEST mint:** `DKFLsvxjFa2KJetFquiUH3cr4hp5QRuuiGVGBPjwPMDN` (6 decimals, no value).
- **Atomic 2-provider purchase:** `5mMZitFvrdNoPvFbUt2VaCqLGB9wP94tKr9nyB3RJknyiw57Z9pGUAHxFMQLvozP5qcBN1GXNT9zkMSH2H4S1dJn`.
  - Agent −60000, NorthLab +24000, SouthSupply +24000, treasury +12000 base units.
- **Bounty:**
  - funded: `3fcNBE7q1odMESajkuvDG5F9v8mqHFNFXwK9HRAnSEVc6pY4jSTv4jJ98Zv4PebCg2LpJjHBnvvTx4fv7NZG1YLn`. Bounty `7fYFhB7RPPEEbZVrjTAyfiTJtasCfTAPTWijhUHNjckf`.
  - two candidates submitted: `4tyoWTk1…`, `5GMsCA3T…`.
  - accepted: `2JX1Ew6C7fcJBREs8HuSZy8hNABevty4CiLBuUfGZi1qyRFYGsURWhAAYh26AN5tvFsgxJRBowZHPDympqYFhcqv`. Vault −2000000, NorthLab +1600000, treasury +400000.
- **Activation:** `3K3rfgombEDFMwL1…`.
- **Resale:** `4iNcJoBrQtkbQt8UCaRMSP8Ha7nbxVVn4ENv13fggxkeVDiBWdgJVT7kLZkVstEejV8imfaGJts4tSVmo62hYiEV`. Second agent −30000, NorthLab +24000, treasury +6000.
- **Refund:**
  - funded: `4QpGbmuzMgfsZudR…`. Bounty `DttBnfLK1DgqbzXJkE6dgVDB76YwHdtbUqVgre79SY9j`.
  - early refund rejected (`DeadlineNotReached`).
  - refunded: `59dRrDWv32U1H281d2NiCsvKQb6RFQ4J6dP7oEi94DpgdPz6aJkSvDQiaDhL65fsfmEUHUhW68ccBM8vZqeeVyBG`. Requester +2000000, treasury 0.
- **Receipts:**
  - `8XxSMdacfG3UQTm1df76bL4hF6iyJJi88w91XKm7AwFK` (purchase)
  - `AHDcfSJQGJp1n6t2FAp1n8ZVggfaWUcaYf9kzvZQfZHa` (purchase)
  - `E145sspVaRUrYdWJsdLKvjcYyP4MDFPgxbNuryAxcvdb` (bounty)
  - `G4TyaY8LVVWbTKjpoqEvZbPGgWQd13Yq6NfHeGWX3pLv` (resale)
- **Earned this run:** NorthLab 1.648, SouthSupply 0.024, treasury 0.418 TEST.
- **Devnet SOL** (founder-funded, 5 SOL): deploy ≈ 1.89 SOL rent + fees. Providers' rent and three run wallets came to about 0.15 SOL per run. The deployer had 2.75 SOL left after the run. The first deploy attempt with `--use-rpc` stalled on public RPC rate limits; its buffer was closed and the 1.885 SOL refunded.

## Task status
| Task | Status | Notes |
|---|---|---|
| Rules re-check | DONE | Official FAQ re-read 2026-11-26, unchanged:<br>• Devnet accepted<br>• open source mandatory<br>• prior own Solana code allowed if disclosed in README<br>• AI allowed<br>• video under 3 min, strict<br>• 5-step submission form<br>• deadline 29 Nov, UTC hour in the dashboard (evidence/rules.md) |
| Devnet deploy + full loop | DONE | `npm run devnet` (idempotent), `npm run start:devnet`, `npm run verify:devnet` |
| UI final review | DONE | Fixes:<br>• Devnet status is read from evidence instead of the hard-coded "faucet blocked"<br>• deadlines in UTC everywhere<br>• JSON wrapping<br>• market card footer wrap<br>• logo size<br>All buttons are wired and covered by the browser smoke test. |
| MCP | DONE (minimal, read-only) | `npm run mcp`: six read-only tools over the shared service. No keys, no signing, no paid bytes. T54 drives it with a real MCP client. The guided demo agent is unchanged. |
| External LLM agent | NOT DONE (by decision) | Would add an API key and non-determinism to the main demo. The deterministic agent stays. |
| Secret / history scan | DONE | See "Release checks". |
| Demo script / submission texts | DONE | DEMO-SCRIPT.md (target 2:45), SUBMISSION.md |

## Release checks
- **Git history:**
  - no 64-byte keypair arrays in any revision;
  - no API keys, bearer tokens or private-key blocks;
  - author is the founder's own git identity.
- **Untracked from now on:** `.agents/`, `.claude/`, `skills-lock.json` (third-party developer skill docs). They remain in older commits; they contain no secrets.
- **Keys:** all keys live in `~/.config/adn-demo/` (0600, outside the repo). The program keypair is in the ignored `target/`.
- **Dependency audit:** `npm audit --omit=dev` reports known advisories in transitive dependencies of the Solana JS stack:
  - `bigint-buffer` via spl-token;
  - `toml` via @anchor-lang/core;
  - `stream-json` via web3.js/jayson.

  No non-breaking fix exists. Exposure is limited: the app is loopback-only and parses only local, trusted inputs.

## Fixes found during release verification
- **Disk exhaustion:** the local validator ledger grew about 5 GB/hour with `--limit-ledger-size 50000000` and filled the disk. The default is now 2M shreds (~30 min history), overridable with `ADN_LEDGER_SHREDS`.
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
1. Record the video (< 3:00) per DEMO-SCRIPT.md.
2. Publish the repository on GitHub (public).
3. Fill in the Dev3pack form using SUBMISSION.md before the 29 Nov deadline (check the UTC hour in the dashboard).
