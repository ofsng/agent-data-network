# Agent Data Network (ADN): Solana-native data commerce demo

AI agents buy exactly the units of licensed data they need. They pay every contributor in **one atomic Solana transaction**, prove paid entitlement with **immutable receipt PDAs**, and fund missing data through an **on-chain bounty escrow**.

> **Status:** this is a hackathon build (Dev3pack, 27–29 Nov 2026). All data is **synthetic**. Payments use a custom **TEST** SPL mint (6 decimals) with **no monetary value**, not USDC or dollars. Everything verified so far ran on a **local validator only**. Devnet deployment is **blocked on Devnet SOL funding** (see [PROJECT-STATE.md](PROJECT-STATE.md)). The project is not commercially launched, has no customers, and makes no traction claims.

## What it does
1. **Atomic two-provider purchase.** The agent searches metadata, takes an exact quote and checks a per-run budget. It then signs one transaction containing two `purchase_unit` instructions, one for each provider. Each instruction:
   - pays the provider 80% and the treasury 20% via `TransferChecked` CPI;
   - writes its own immutable 254-byte `PurchaseReceipt` PDA.

   If either instruction fails, both revert.
2. **Receipt-gated delivery.** The API returns the exact stored bytes only after three checks:
   - a finalized receipt, matched by owner, PDA recomputation, mint, buyer, version, hashes and amount;
   - a one-time wallet-signed challenge (60 s, nonce consumed atomically);
   - the SHA-256 of the stored body and license matching the receipt.
3. **Bounty for missing data.**
   - The requester locks the reward in a vault (ATA) owned by the Bounty PDA.
   - The provider registers an **inactive** asset and submits it. Nothing is paid on upload.
   - The requester reviews the submission against a deterministic fixture and signs acceptance. The vault pays 1.6 TEST to the provider and 0.4 TEST to the treasury, and the program writes a bounty receipt. The provider then activates the asset.
   - After the deadline, the requester can refund the full reward with no fee.

A receipt proves paid entitlement to a specific hash, version and license. It does **not** prove that the data is true, that anyone owns it, or that it was delivered or consumed.

## Layout
| Path | Contents |
|---|---|
| `programs/adn/src/lib.rs` | Anchor program: 8 instructions (config, register/toggle asset, purchase_unit, bounty create/submit/accept/refund) |
| `idl/` | Generated IDL and TS types (copied from `target/` by the build) |
| `src/chain/` | PDA derivation, exact bundle builder, finalized receipt verifier, operator ops, reconciliation |
| `src/data/` | SQLite schema, canonical bytes (NFC + LF), fixture import, metadata-only search |
| `src/api/` | `/api/v1` read and delivery API, plus the read-only evidence dashboard (`/`) |
| `src/agent/` | Deterministic agent: purchase, gap bounty and refund flows, per-run budget |
| `tests/anchor/` | Local-validator program tests (T04–T06, T09–T17, T24–T31) |
| `tests/app/` | API security and recovery tests (T18–T22, T33) |
| `evidence/` | Sanitized outputs: rules, toolchain, test runs, demo evidence JSON |
| `STARTUP-PACKAGE/` | V1.3 planning package (specification; `ARCHIVE/` excluded) |

## Reproduce (local validator)
Pinned toolchain: Solana CLI 4.1.2 (Agave), Anchor CLI 1.2.2, anchor-lang/anchor-spl 1.2.2, Rust 1.89 (program), Node 22. Install details are in [evidence/h02-toolchain.md](evidence/h02-toolchain.md).

```bash
npm ci
```

Create disposable keys **outside the repo**. Each command writes one key file:

```bash
mkdir -p ~/.config/adn-demo/keys && chmod 700 ~/.config/adn-demo/keys
```

```bash
for n in deployer buyer providerA providerB requester treasury; do solana-keygen new --no-bip39-passphrase -s -o ~/.config/adn-demo/keys/$n.json; done
```

Build, run all tests, then run the three demos and the leak scan:

```bash
./scripts/local-e2e.sh
```

The script runs `anchor build`, Rust unit tests and the program tests on a fresh validator. On a second fresh validator it then runs bootstrap, seed, the API, `demo` (purchase plus gap bounty), `demo-refund`, the API tests and a paid-content leak scan. After it finishes, the dashboard is at http://127.0.0.1:8787/.

Individual commands: `npm run cli -- bootstrap | seed | search <q> [--tag t] | demo | demo-purchase | demo-bounty | demo-refund [secs]` and `npm run server`.

### Devnet
Fund the deployer (`solana-keygen pubkey ~/.config/adn-demo/keys/deployer.json`) with about 4.5 Devnet SOL, then run:

```bash
./scripts/devnet.sh
```

The script checks the Devnet genesis hash and deploys with the deployer as upgrade authority. It then funds the role wallets with 0.1 SOL each, runs bootstrap, seed, the demo and the refund, and writes `evidence/devnet-*.json`. If the deployer is underfunded, it stops with `BLOCKED`.

## Measured results (local validator 4.1.2, not Devnet)
| Metric | Value |
|---|---|
| Bundle | 2 × `purchase_unit`, 1 signer/fee payer, legacy tx, **784 bytes** (limit 1232) |
| Compute | 54,832–63,832 CU across runs (no CU limit instruction) |
| Network fee | 5,000 lamports (also charged when a landed tx fails, T13) |
| Receipt rent | 2,658,720 lamports each on local 4.1.2; Devnet `solana rent 254` = 1,940,560 lamports |
| Purchase deltas | buyer −60,000; provider A +24,000; provider B +24,000; treasury +12,000 (TEST base units) |
| Bounty | requester −2,000,000 → vault +2,000,000; accept: vault −2,000,000, provider +1,600,000, treasury +400,000 |
| Refund | early refund → `DeadlineNotReached`; after deadline requester +2,000,000, treasury 0 |
| Tests | 2 Rust unit + 17 program + 6 API: all passing ([evidence/local-anchor-tests.txt](evidence/local-anchor-tests.txt), [evidence/local-api-tests.txt](evidence/local-api-tests.txt)) |

Local signatures in `evidence/localnet-*.json` exist only on a throwaway local ledger. They are **not** Devnet evidence.

## Security notes
- Config initialization requires the program's **upgrade authority** (checked via ProgramData). A repeat initialization fails.
- Fixed legacy SPL mint with 6 decimals. Canonical ATAs are enforced for every token account. Buyer, provider and treasury may not alias. Duplicate mutable accounts are rejected by Anchor.
- Expected price and hashes, plus the quote expiry, are signed by the buyer and checked on-chain. Receipts use `init` (replay → "already in use"). There is no close or reinitialization.
- The bounty vault is the Bounty PDA's ATA. Exactly `reward` is moved. Unsolicited surplus stays in the vault and is never swept. Terminal states are final.
- The API never signs and never accepts keys. Paid bytes are returned only from `/deliveries` after proof. Evidence and logs keep hashes, not bodies.
- Trust assumption for the demo: the program is **upgradeable** by the deployer key. A production version would need review, an audit and an authority policy.

## Decisions and divergences
- **x402 not used.** The standard exact-SVM facilitator spec rejects custom program instructions (Path 1) and requires a sponsor as fee payer. A bundle of two `purchase_unit` instructions with receipt PDAs cannot be verified by it ([evidence/h02-toolchain.md](evidence/h02-toolchain.md)). Payment is a direct buyer-signed Anchor transaction, and nothing in this repo is labeled x402.
- The initializer is pinned through the upgrade authority, not a compile-time key.
- Bounty requirement fixture: the public requirement contains the required value (`FICT-RECYCLE-2026`), so in this synthetic demo the "answer" is guessable. The point being demonstrated is escrow, review and settlement, not secrecy.
- Search tie-break is by asset ID (deterministic), not by fixture label.

## Hackathon disclosure
- **Built before vs. during:** the V1.3 planning package (`STARTUP-PACKAGE/`, documents only) existed before coding. All code was written from 2026-11-25 onward. The event FAQ allows prior Solana work if it is disclosed.
- **AI assistance:** implemented with Claude Code (Anthropic) under the founder's direction. The event FAQ allows AI tools.
- License: MIT for code. Fixture data is fictional (`fixtures/LICENSE.txt`).
