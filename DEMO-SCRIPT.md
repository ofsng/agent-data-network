# Demo video script (under 3:00, real product, English)

Setup before recording:
1. Run `npm run setup`, then `npm start`.
2. Open http://127.0.0.1:8787.
3. Press **Reset demo** to get a fresh run.
4. Record at 1440×900.

The run takes about 2.5 minutes in real time, mostly waiting for local finality (about 13 s per transaction). Either use **Next step** and cut the waits, or speed up the waiting segments in editing, and say so on screen ("finality waits shortened").

| Time | Screen | Say |
|---|---|---|
| 0:00–0:20 | Overview, badges visible | "AI agents need licensed, fragmented data. Paying is easy; proving *what* was licensed, paying every contributor fairly, and filling gaps is not. This is Agent Data Network, a real Anchor program running on a local Solana validator with synthetic data and a TEST token." |
| 0:20–0:50 | Next step ×5 (publish → search → quote → sign → paid) | "Two providers publish metadata; the content stays private. The agent picks efficiency data from NorthLab and lead time from SouthSupply, gets an exact quote within its budget, and signs **one transaction with two purchase instructions**. Both providers and the platform are paid at once (80/20), or nothing happens." Point at the live balances: −0.06 / +0.024 / +0.024 / +0.012. |
| 0:50–1:10 | Verify step; Transactions & receipts tab | "Each purchase wrote an immutable license receipt. The agent proves wallet ownership and gets the exact bytes, hash-checked against the receipt." |
| 1:10–1:50 | Gap → bounty → submit → review | "The recycling certificate doesn't exist. Instead of hallucinating, the agent funds a 2 TEST bounty, locked in a vault owned by the program. NorthLab submits two candidates; the review shows pass/fail only, never the answer, so the requester can't take it without paying." Show the Bounties tab: one candidate FAIL, one PASS. |
| 1:50–2:15 | Accept → deliver → activate → resale | "The requester signs: 1.6 to NorthLab, 0.4 to the platform, and only now is the answer released. NorthLab lists it, and a second agent buys it. Same work, **paid again**." Show the Provider earnings tab. |
| 2:15–2:35 | Refund step | "If nobody answers, the program rejects early refunds and returns the full reward after the deadline, with no fee." |
| 2:35–2:55 | Brief + Verification tab | "The final brief cites every fact's unit and receipt. Everything shown is a real local-chain transaction; tests cover rollback, replay, wrong accounts, leaks, budget caps and recovery." |
| 2:55–3:00 | Logo | "Buy knowledge. Verify purchases. Fund what's missing." |

Do not claim: Devnet/mainnet transactions (unless `scripts/devnet.sh` has actually been run), real revenue or customers, an LLM agent, x402 compatibility, or the truth of any data.
