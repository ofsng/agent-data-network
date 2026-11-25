# H02 — Toolchain, skill/MCP, mint, x402 (T02, T03)

## Pinned versions (actually installed and used, 2026-11-25)
| Component | Version | How installed / source |
|---|---|---|
| Solana CLI (Agave) | 4.1.2 (src:182084b8) | GitHub release tarball `anza-xyz/agave` v4.1.2 `solana-release-x86_64-unknown-linux-gnu.tar.bz2` (218,318,551 bytes, size matches release asset) extracted to `~/.local/share/solana-releases/v4.1.2` |
| Anchor CLI | 1.2.2 | GitHub release binary `otter-sec/anchor` v1.2.2 (`anchor-1.2.2-x86_64-unknown-linux-gnu`, 22,886,016 bytes) |
| anchor-lang / anchor-spl | =1.2.2 (default `solana-v3` cohort) | Cargo.lock |
| Program Rust toolchain | 1.89.0 (rust-toolchain.toml) ; host rustc 1.100.0 | rustup |
| platform-tools | v1.57 | fetched by cargo-build-sbf |
| Node | 22.23.2 | host |
| @anchor-lang/core | 1.2.2 ; @solana/web3.js 1.99.0 ; @solana/spl-token 0.4.15 | package-lock.json |

Pairing rationale: official Solana dev skill `references/compatibility-matrix.md` lists Anchor 1.2.x ↔ Solana CLI 4.1.x (CI-tested 4.1.2), MSRV 1.89, GLIBC ≥2.39 (host 2.39).

## Official skill + MCP
- `npx skills add https://github.com/solana-foundation/solana-dev-skill` → installed `.agents/skills/solana-dev` (symlinked for Claude Code). Source inspected before install: markdown + validation scripts only. Revision `c9da2624cc6baca5c8c2123ea50d92ef19f1c917` (2026-11-04).
- `claude mcp add --transport http solana-mcp https://mcp.solana.com/mcp` → `claude mcp list`: `solana-mcp: https://mcp.solana.com/mcp (HTTP) - ✔ Connected`.

## Build / local validator
- Template hello build OK, then `anchor build` of `programs/adn` OK: `target/deploy/adn.so` 370,960 bytes, IDL `idl/adn.json` (8 instructions, 19 custom errors).
- `solana-test-validator` 4.1.2 started; local airdrop works.
- Devnet: `solana -u devnet cluster-version` → 4.5.0-beta.0; genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.

## Funding — BLOCKER (Devnet)
`solana -u devnet airdrop 2 <wallet>` ×4 → `Error: airdrop request failed. This can happen when the rate limit is reached.` All demo wallets 0 SOL on Devnet. Need ≈3 SOL (program deploy rent for ~371 KB + fees) on the deployer `Cu7ctAUxW25GsGGPVvNupujU81A9jvEZUGjo2sUdgVZ7` and ≈0.5 SOL each for buyer/requester/providers. Founder action: fund via https://faucet.solana.com (GitHub sign-in) or another Devnet source.

## Mint
No verified Devnet USDC used. Plan: a custom 6-decimal legacy SPL mint labelled **TEST (DEMO)**, mint authority = deployer. Never presented as dollars. Local tests create a fresh 6-decimal legacy mint per run (decimals check enforced on-chain; a 9-decimal mint is rejected, T04).

## x402 spike (≤45 min) — RESULT: not compatible, not used
Read x402 `specs/schemes/exact/scheme_exact_svm.md` (x402Version 2). Findings:
- Path 1 verifier only allows ComputeBudget, TransferChecked, optional Memo (+ Lighthouse); "Any other program, anywhere in the sequence, MUST be rejected".
- Path 2 (smart-wallet) admits wrapping programs only from an operator allowlist (Squads, Swig, …); a custom Anchor program is not on it by default.
- Sponsor is fee payer and must not appear in instruction accounts; client-funded rent for arbitrary PDAs is undefined; exactly one matching transfer per payee.
Conclusion: a single tx with two `purchase_unit` instructions (CPI transfers + receipt PDA init, buyer as fee payer) cannot be verified/settled by a standard exact-SVM facilitator. **Decision D30 resolved: direct buyer-signed Anchor transaction is P0. No x402 headers/labels are advertised. H15 skipped.** solana.com facilitator page returned HTTP 429 (not read).
