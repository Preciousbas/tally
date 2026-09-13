# Idea submission — paste into Rise In / Turn form

Use this block when the form asks for more detail on the project, problem, audience, and architecture.

---

**Tally** is private trade credit on Midnight Network.

**Problem.** Suppliers who extend bilateral credit cannot prove “I have repaid before” to a new counterparty without either revealing amounts and counterparties or trusting a centralized score. Public ledgers make loan books unacceptable; private channels alone give the new lender no verifiable signal.

**Audience.** Small merchants and trade-credit counterparties who need a privacy-preserving standing check, plus Midnight builders demonstrating Private Allowlist Access.

**Product.** A loan desk where amount and due date stay in witnesses. The public ledger stores only status, pseudonymous identities, a payment commitment, a Merkle allowlist root, and nullifiers. When a loan settles, it inserts a relationship leaf. Later, `proveStanding` lets you prove prior repaid standing to someone new without revealing amount, counterparty, or which loan it was.

**Architecture.** Compact contract (`tally.compact`) with six circuits (`offerLoan`, `acceptLoan`, `disburse`, `repay`, `settle`, `proveStanding`); dual ledger (public `LoanPublic` vs private witnesses); React desk (`leaderboard-ui`) with Lender / Borrower / Verifier roles; API package for witnesses and circuit calls; local proof server for Lace proving.

**Links**

- GitHub: https://github.com/Preciousbas/tally
- Proposal: `PROPOSAL.md` in repo root
- Preprod contract: `f8287add7fd6628c414dc876cb29a619694ecccb859bae5f0036c5dfb821b59e`
- Live demo: https://tally-jet-mu.vercel.app
- Demo video: paste your public video URL from README `## Demo`
- Screenshots: `docs/screenshots/` in the repo (also embedded in README)

**One-liner (if the form has a short field)**

Private trade credit on Midnight. Amounts stay off-ledger; settled loans mint a Merkle allowlist leaf so you can prove repaid standing without revealing amount, counterparty, or which loan it was.

---

## Checklist before submit

- [ ] Paste the long block above into the revisions form
- [ ] Confirm `PROPOSAL.md` is on `main` at repo root
- [ ] Confirm README has `## Contract Address`, `## Demo`, `## UI Screenshots`
- [ ] Upload / link the demo video (wallet connect + successful circuit call)
- [ ] Screenshots committed under `docs/screenshots/`
- [ ] Live Vercel URL filled in README
