# Validation, risks and gates
G0 official eligibility, allowed coding window and AI disclosure checked before implementation. G1 Anchor build/local tests, real mint/Devnet setup. G2 atomic two-provider transaction plus two finalized receipts and verified deliveries. G3 bounty funded/accepted and independent refund, failure/race tests. G4 evidence, no secrets, demo ready, accurate pitch. G5 commercial NO-GO until real demand/rights/legality/unit economics tested. No customer interview blocks G0–G4. x402 optional compatibility experiment only.

| Risk | Likelihood/impact | Mitigation / signal / action |
|---|---|---|
| SDK or x402 incompatibility | High/high | Pin toolchain, 45-min x402 spike; direct Anchor fallback |
| 1232-byte limit | Medium/high | Precreate ATAs, two compact instructions; measure; v0 ALT only if tested; no atomic claim if split |
| Double payout / wrong wallet | Medium/critical | PDA init, constraints, terminal status, negative tests; stop demo on mismatch |
| Devnet funding/RPC | High/high | Early faucet, local validator, preserve actual evidence; disclose if Devnet fails |
| Content unavailable/modified | Medium/high | Immutable bytes, hash check, retry; no false success |
| False bounty solution | Medium/high | Requester-signed deterministic review; no automatic upload payout |
| Time overrun | High/high | CLI first, cut optional features, freeze scope, truthful partial demo |
| Storage deposits overwhelm price | High/high | Measure rent per receipt; buyer cost separate; future batching/compression |
| Competitor duplicates | High/medium | No global-first claims; benchmark value, unique supply later |
| Legal/IP/privacy | Medium/high | Synthetic only; no real launch; human legal review later |

Hypotheses: correctness tested with fixtures; willingness to pay unknown. Online research can refine market, never substitute paid demand. Post-event self-service opt-in beta after security, commercial gates: independent buyers, repeat use, positive contribution, verified rights and compliant rails. No fabricated traction. Pre-mortem: impressive UI but no functioning Solana transaction, or real payout but no valid receipt; prioritize verified chain state over UI.
