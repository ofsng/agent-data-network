# Demo video script (English, target 2:45, hard limit under 3:00)

Contest rule (official FAQ): under 3 minutes, strict; a real product demo, not a pitch deck; any public link (YouTube, Loom).

## Before recording
1. Preferred: record on **Devnet** so every signature opens in Solana Explorer.
   - Start the UI: `npm run start:devnet`.
   - The public Devnet RPC rate-limits (HTTP 429). If that happens, set `SOLANA_RPC_URL` to a free Devnet RPC endpoint from any provider.
   - Fallback: `npm start` (local validator). Then say "local validator" instead of "Devnet" in every line below.
2. Open http://127.0.0.1:8787 at 1440×900 and press **Reset demo** for a fresh run.
3. Press **Run full demo** once before recording to warm up, then **Reset demo** again.
4. A full run takes about 3–4 minutes in real time, mostly waiting about 13 s for finality per transaction. Record it once in full, then cut the waits in editing. Show a small on-screen caption, "finality waits shortened". Never cut a result.

## Shot list
| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Overview with badges (DEVNET, SYNTHETIC DATA, TEST TOKEN) | "AI agents need small pieces of licensed data from many owners. Today they either scrape it or buy whole datasets. Agent Data Network lets an agent buy exactly the units it needs, pay every owner in one Solana transaction, and prove what it bought." |
| 0:15–0:35 | Next step ×3: publish, search, quote | "Two providers publish data units. The program fixes each unit's price, version, content hash and license hash. The agent searches free metadata and gets an exact quote. Before quoting, the server checks the stored bytes still match the on-chain hashes." |
| 0:35–1:00 | Sign + paid; point at Live balances | "One transaction, two purchase instructions. Both providers and the platform are paid at once, 80/20, or nothing happens. Two receipts are written on chain." Click a signature to open it in Explorer. |
| 1:00–1:15 | Verify step; Transactions & receipts | "The agent checks its receipts on chain, signs a one-time challenge, and gets the exact bytes, hash-checked against the receipt. No receipt, no data." |
| 1:15–1:50 | Gap → bounty → submit → review; Data bounties tab | "The recycling certificate doesn't exist anywhere. Instead of making it up, the agent funds a 2 TEST bounty, held in a vault owned by the program. The provider submits two candidates. The review shows only pass or fail, never the answer, so nobody can take the data without paying." |
| 1:50–2:15 | Accept → deliver → activate → resale; Provider earnings | "The requester accepts. The vault pays 1.6 to the provider and 0.4 to the platform, and only then is the answer released. The provider lists it, a second agent buys it, and the provider is paid again for the same work. Missing data becomes an asset." |
| 2:15–2:30 | Refund step | "If nobody answers, the program blocks an early refund and returns the full reward after the deadline, with no fee." |
| 2:30–2:45 | Verification & evidence; Explorer tab | "Every number here comes from finalized transactions of one Anchor program. Tests cover rollback, replay, wrong accounts, leaks, budget caps and corrupted-data recovery. Agent Data Network: buy knowledge, prove it, fund what's missing." |

## Do not claim
- Mainnet, real money, customers or revenue.
- An LLM agent. The agent is deterministic and rule-based.
- x402 payments.
- That the data is true. Receipts prove paid entitlement to exact bytes, not truth.
- Devnet, if you recorded on the local validator.
