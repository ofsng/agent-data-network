// Guided demo steps and their plain-language narration. Narration explains the
// action; every number shown next to it comes from the actual run state.
export const STEPS = [
  "READY", "PUBLISHED", "SEARCHED", "QUOTED", "PAYMENT_PENDING", "PURCHASED", "VERIFIED", "GAP", "BOUNTY_FUNDED",
  "SUBMITTED", "REVIEWED", "ACCEPTED", "DELIVERED", "ACTIVATED", "RESOLD", "REFUND_DEMONSTRATED", "COMPLETE",
] as const;
export type Step = (typeof STEPS)[number];

export type Stage = "Discover" | "Purchase" | "Verify" | "Commission" | "Reuse";

export interface Scene {
  title: string;
  stage: Stage;
  what: string;
  why: string;
  money: string;
  onchain: string;
  problem: string;
}

export const SCENES: Record<Step, Scene> = {
  READY: {
    title: "Ready", stage: "Discover",
    what: "A fresh, isolated run with new agent wallets funded with exactly their spending caps.",
    why: "Each run is independent, so results are never borrowed from an earlier run.",
    money: "Research agent cap 2.1 TEST · second agent 0.1 TEST · refund requester 2 TEST.",
    onchain: "Setup mints TEST tokens (no monetary value) to the run's wallets.",
    problem: "Agents need a spending limit they cannot exceed.",
  },
  PUBLISHED: {
    title: "Providers publish data", stage: "Discover",
    what: "NorthLab and SouthSupply list 12 synthetic data units, with source, rights, schema and price.",
    why: "Only metadata is public; each unit's exact bytes are hashed and kept private until purchased.",
    money: "No payment. Listing costs the provider a small SOL rent deposit.",
    onchain: "register_data_asset stores price + content hash + license hash per unit (immutable).",
    problem: "Buyers need to know exactly what version and license they are paying for.",
  },
  SEARCHED: {
    title: "Agent searches the pool", stage: "Discover",
    what: "The agent searches free metadata for X100 efficiency and lead time and picks the best unit from each of two providers.",
    why: "No single provider has everything; the agent assembles knowledge from several sources.",
    money: "Searching is free.",
    onchain: "Reads only — nothing is written to the chain.",
    problem: "Knowledge is fragmented across independent contributors.",
  },
  QUOTED: {
    title: "Exact quote + trust preflight", stage: "Purchase",
    what: "The agent requests a binding quote and checks it against its remaining budget.",
    why: "Before any signing, the service confirms the listing is active, bytes match on-chain hashes and a recovery snapshot exists.",
    money: "0.06 TEST total: each provider gets 80%, the platform 20%.",
    onchain: "Quote binds exact price and hashes; the buyer will sign these expected terms.",
    problem: "Never pay for data that cannot be delivered or has changed.",
  },
  PAYMENT_PENDING: {
    title: "Agent signs one transaction", stage: "Purchase",
    what: "The agent signs a single Solana transaction that contains two purchase instructions, one per provider.",
    why: "Both purchases succeed together or both fail — no partial payment.",
    money: "Spend is reserved in the agent's budget before signing.",
    onchain: "2 × purchase_unit in one transaction; one signer, one fee.",
    problem: "Multi-party payments usually need custody or reconciliation.",
  },
  PURCHASED: {
    title: "Providers paid atomically", stage: "Purchase",
    what: "The transaction finalizes: both providers and the treasury are paid in the same instant.",
    why: "Settlement is direct to wallets — no platform balance or payout run.",
    money: "Each provider +0.024 TEST · treasury +0.012 TEST.",
    onchain: "Two immutable license receipt PDAs record buyer, version, hashes and split.",
    problem: "Contributors get paid instantly and verifiably.",
  },
  VERIFIED: {
    title: "Receipts verified, data delivered", stage: "Verify",
    what: "The agent proves wallet ownership, and the service releases the exact bytes only for a valid receipt.",
    why: "Anyone can check the receipt on-chain; the delivered bytes must hash to what was paid for.",
    money: "No extra charge; retries are free.",
    onchain: "Receipt owner, PDA, buyer, mint, version and hashes are checked against chain state.",
    problem: "Proof of exactly what was licensed — not just that money moved.",
  },
  GAP: {
    title: "Agent detects a gap", stage: "Commission",
    what: "No listed unit contains the X100 recycling certificate.",
    why: "The agent reports the gap instead of inventing an answer.",
    money: "Remaining budget is checked for a bounty.",
    onchain: "Reads only.",
    problem: "Agents hallucinate when data is missing; here the gap becomes demand.",
  },
  BOUNTY_FUNDED: {
    title: "Funded bounty created", stage: "Commission",
    what: "The agent posts a public requirement and locks a 2 TEST reward.",
    why: "Providers see real, funded demand before they produce new data.",
    money: "2 TEST moves from the agent into an escrow vault controlled by the program.",
    onchain: "create_bounty: Bounty PDA + vault owned by the PDA; only the program can release it.",
    problem: "Missing knowledge gets financed, not just requested.",
  },
  SUBMITTED: {
    title: "Provider submits candidates", stage: "Commission",
    what: "NorthLab registers two candidate units (inactive, unsellable) and submits them to the bounty.",
    why: "Submitting does not pay anything; the requester must review first.",
    money: "Vault unchanged.",
    onchain: "submit_bounty_solution links bounty ↔ asset; no tokens move.",
    problem: "No payout for uploading something unverified.",
  },
  REVIEWED: {
    title: "Bounded review", stage: "Commission",
    what: "A local validator checks schema, required field, expected fixture, provenance, integrity and license.",
    why: "The requester learns pass/fail — not the answer — so it cannot take the data without paying.",
    money: "No payment yet.",
    onchain: "Review binds to the exact submission PDA and on-chain hashes.",
    problem: "Fair review without leaking the solution.",
  },
  ACCEPTED: {
    title: "Bounty accepted and paid", stage: "Commission",
    what: "The requester signs acceptance of the passing candidate.",
    why: "Payout requires the requester's signature and the exact expected hashes.",
    money: "Vault −2 TEST → NorthLab +1.6 TEST, treasury +0.4 TEST.",
    onchain: "accept_bounty_solution pays from the PDA vault and writes a bounty receipt.",
    problem: "Escrow without a trusted middleman.",
  },
  DELIVERED: {
    title: "Commissioned data delivered", stage: "Commission",
    what: "The full certificate is released to the requester through the bounty receipt.",
    why: "Only now, after payment, does the answer leave the provider's private store.",
    money: "No extra charge.",
    onchain: "Bounty receipt verified (kind = bounty).",
    problem: "Producer is paid before the answer is revealed.",
  },
  ACTIVATED: {
    title: "New data joins the pool", stage: "Reuse",
    what: "NorthLab activates the commissioned unit for sale at 0.03 TEST.",
    why: "Data funded once can be sold again — the shared pool grows.",
    money: "No payment.",
    onchain: "set_asset_active(true) — price, hashes and license stay immutable.",
    problem: "Commissioned knowledge should not be a one-off.",
  },
  RESOLD: {
    title: "Second agent buys it", stage: "Reuse",
    what: "A different agent with its own budget finds and buys the new unit.",
    why: "The provider earns again from the same work.",
    money: "Second agent −0.03 TEST → NorthLab +0.024, treasury +0.006.",
    onchain: "purchase_unit creates a new receipt for the new buyer.",
    problem: "Recurring revenue for contributors.",
  },
  REFUND_DEMONSTRATED: {
    title: "Unanswered bounty refunded", stage: "Reuse",
    what: "A separate requester posts a short bounty nobody answers, then reclaims it after the deadline.",
    why: "Funds are never stuck; early refunds are rejected by the program.",
    money: "Full 2 TEST returned, no platform fee.",
    onchain: "refund_expired_bounty only succeeds once the on-chain clock passes the deadline.",
    problem: "Requesters are protected if no one delivers.",
  },
  COMPLETE: {
    title: "Research brief with sources", stage: "Reuse",
    what: "The agent assembles its brief, citing each fact's unit and receipt.",
    why: "Every claim is traceable to a paid, hash-verified source.",
    money: "Earnings per party are summed from the measured balance changes.",
    onchain: "All receipts remain on-chain and independently verifiable.",
    problem: "Trustworthy, attributable agent research.",
  },
};
