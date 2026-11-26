# SSS 09 · İngilizce kısa cevaplar (jüriye birebir söylenebilir)

**284. What is it?**
"Agent Data Network lets AI agents buy exactly the licensed data units they need, pay every provider in one Solana transaction, prove it with on-chain receipts, and fund missing data with escrowed bounties."

**285. Why Solana?**
"Atomic multi-instruction transactions, cheap fees for micro-purchases, and PDA-owned escrow. Without the chain there's no atomic split, no immutable receipt and no escrow the platform can't touch."

**286. Is it on Devnet?**
"Yes. Program 3vZNsmhk…rLQEA8 is deployed on Devnet, the deployed bytes match our build, and the full 16-step loop ran with real transactions and was re-verified on chain."

**287. Is this real money?**
"No. Payments settle in aUSD, a 6-decimal test stablecoin on Devnet. In production it would be USDC."

**288. Is the data real?**
"It's a realistic sample catalog. The companies are fictional; the transactions are real."

**289. Is the agent an LLM?**
"The built-in agent is a rule-based planner, so the demo is deterministic. A real LLM, Claude, plugs in over MCP and uses the same tools with its own wallet and a human-approved allowance."

**290. Chicken and egg?**
"We flip the order: demand comes first. When an agent can't find data, it locks a reward in an on-chain escrow, so a provider only produces data that is already paid for. Accepted answers join the catalog and are resold, so every bounty adds inventory. Any MCP agent becomes a buyer with one config line. We'd start in one vertical, equipment procurement data, and seed the first bounties ourselves. It's a hypothesis, not traction."

**291. Someone buys and resells cheaper?**
"Every listing's content hash is on chain. A later listing of the same bytes by another provider is flagged as a copy, hidden from search and refused at quote time. Edited copies are the open case; per-buyer watermarks are next."

**292. Fake data to win a bounty?**
"The program pays only on the requester's signed acceptance, and the requester sees pass/fail before paying. The review itself is an off-chain trust assumption today. Next: a dispute window, a provider stake lost on proven fakes, and issuer-signed answers."

**293. Is the data true?**
"A receipt proves what was paid for, not that it's true. Accuracy is labeled provider-declared; truth is handled economically, with disputes, stakes and reputation, and by source signatures."

**294. Why not x402?**
"The standard x402 SVM facilitator only allows compute-budget, transfer and memo instructions, so it can't settle our two purchase instructions with receipt accounts. We use a direct buyer-signed Anchor transaction and don't claim x402."

**295. Marketplaces are hard. Why you?**
"We don't sell a better marketplace; we sell proof. Buyers are agents, so there's no off-platform relationship, and skipping us means losing the license receipt. Multi-owner atomic purchase is something no single provider API can offer. Take-rate pressure is a real open risk."

**296. Does everyone run it locally?**
"Today the whole stack runs on one machine for the demo. In production the marketplace is one hosted service plus the Solana program, and only the small MCP wallet client runs next to each user's agent, so keys never leave the user."

**297. How does an agent get money?**
"In the demo the operator mints test aUSD. In production the user funds the agent wallet with USDC or grants an on-chain spending allowance with SPL approve, so the cap is enforced by Solana itself."

**298. What's tested?**
"37 automated tests: rollback, replay, wrong mint and accounts, aliasing, expiry, escrow abuse, refund timing, data leaks, delivery auth, corrupted-data recovery, budget caps, resale, copy guard, the MCP agent flow, and a browser test with failure injection."

**299. What would you build next?**
"Hosted marketplace and an npx MCP package, USDC with on-chain allowances, a dispute window and provider stake for bounties, compressed receipts to cut rent, and an audit before mainnet."

**300. Closing line**
"Agent Data Network: buy knowledge, prove it, fund what's missing."
