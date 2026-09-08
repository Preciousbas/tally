# Tally — Private Allowlist Access for trade-credit standing

Paste this into the Rise In Idea Submission (The Turn) form. Product name stays **Tally**. The Turn is the program gate only.

## Idea list item

**Private Allowlist Access** — prove membership without revealing identity

## One-liner

Settled private loans insert relationship leaves into a Merkle allowlist. A third party verifies standing (membership) without learning which loan, which counterparty, or any amount.

## Problem

Trade credit and bilateral lending need a way to prove *prior repaid standing* to a new counterparty without running a credit bureau and without publishing loan books on-chain.

Today, proving “I have successfully repaid before” usually means:

- revealing the full history (amounts, counterparties, dates), or
- trusting a centralized score issuer.

On a public ledger, raw loan data is unacceptable. On a private channel alone, the new lender has no verifiable signal. Builders need a selective disclosure path: prove membership in a set of settled relationships, disclose nothing else.

Tally addresses that gap on Midnight: the loan lifecycle stays private where it matters; settlement mints an allowlist leaf; later proofs answer only yes/no membership.

## Product

**Tally** is a Midnight desk for private bilateral loan origination that ends in an allowlist entry.

1. **Originate** — Lender offers; borrower accepts; amount and due stay in witnesses.
2. **Fund** — Lender binds a Preprod payment grain (commitment), not a disclosed amount.
3. **Repay → Settle** — Settlement inserts a relationship leaf into `relationships` (HistoricMerkleTree) and a nullifier so the same settlement cannot be replayed.
4. **Allowlist access (L3)** — A party with a settled leaf proves membership to a third wallet/app. The verifier learns membership only.

Repo: https://github.com/Preciousbas/tally  
Preprod contract (L1): `f8287add7fd6628c414dc876cb29a619694ecccb859bae5f0036c5dfb821b59e`

## Privacy model

What an **observer** (explorer, indexer, unrelated wallet) **can** learn:

- That a loan id exists and its **status** (Offered → Accepted → Funded → Repaid → Settled)
- Pseudonymous identity grains (`lenderPk`, `borrowerPk`) — not Lace display names or legal identity
- That a **payment commitment** was bound at disbursement (grain / tx commitment hash)
- The **Merkle root** (and history) of the relationships allowlist
- That a **nullifier** was consumed at settle (prevents double-settle)

What an observer **cannot** learn:

- Loan **amount**
- **Due** date / slot
- User **secret** and **PIN** (identity derivation inputs)
- Which **leaf** corresponds to which real-world relationship when only a membership proof is presented
- The economic terms of any prior loan used for standing

What a **membership verifier** learns:

- Boolean: the prover is in the settled-relationship allowlist for this contract (at a stated root)
- Nothing about amount, due, or which leaf/index/counterparty pair was used

Grounded in Compact (`contract/tally.compact`): public `LoanPublic` vs witnesses `getUserSecret`, `getPin`, `getLoanAmount`, `getDueSlot`; settle writes `relationshipLeaf` + `settleNullifier`.

## MVP scope

**In scope**

- Keep existing five circuits: `offerLoan`, `acceptLoan`, `disburse`, `repay`, `settle`
- Keep desk UI: Local + Preprod Connect / Join / Deploy / full lifecycle
- Add Compact circuit for allowlist membership (working name: `proveStanding`) against `relationships`, without disclosing leaf, index, amount, or counterparty pairing beyond what the proof requires
- Add desk action for a third profile: Prove standing / Verify access → clear pass/fail
- Add simulator + Vitest coverage for membership happy path and reject (wrong root / non-member)
- README Privacy model section
- CI green on GitHub Actions; public repo; live demo URL; ≥10 meaningful commits; 1-minute demo video covering loan settle → standing proof

**Demo path (judges)**

1. Lender/Borrower complete Offer → Accept → Disburse → Repay → Settle on Preprod (or Local desk if chain is slow)
2. Third wallet opens Verify standing
3. Prover generates membership proof; verifier sees success without amount or counterparty detail

## Non-goals

- Credit bureau / third-party score issuance
- Web2 attestors (KYC, bank statements, off-chain oracles)
- Marketplace of loans or public order book
- Revealing amounts under any transparency mode
- Mainnet launch (L6)
- Defaulted / liquidation flows
- Replacing Lace/1AM identity with real-world legal identity
- General-purpose credential wallet (no W3C VC format in MVP)
- Proving *which* prior counterparty you dealt with (that would break allowlist privacy)

## Why this list item

Settlement already inserts into `HistoricMerkleTree` relationships. L3 is the missing membership proof UX, which is exactly **Private Allowlist Access**. Loans are how the allowlist is populated; standing is what the allowlist gates.

## Success criteria for Turn approval

- Idea explicitly named: **Private Allowlist Access**
- Privacy model states observer vs prover vs verifier clearly
- MVP is one new circuit + verify UI on top of a working loan desk
- Non-goals keep scope hackathon-sized
