# PROPOSAL — Tally (Private Allowlist Access)

Product name: **Tally**. Rise In / Turn list item: **Private Allowlist Access**.

Repo: https://github.com/Preciousbas/tally

## 1. What problem are you solving?

Trade credit and bilateral lending need a way to prove *prior repaid standing* to a new counterparty without running a credit bureau and without publishing loan books on-chain.

Today, proving “I have successfully repaid before” usually means:

- revealing the full history (amounts, counterparties, dates), or
- trusting a centralized score issuer.

On a public ledger, raw loan data is unacceptable. On a private channel alone, the new lender has no verifiable signal. Builders need a selective disclosure path: prove membership in a set of settled relationships, disclose nothing else.

Tally addresses that gap on Midnight: the loan lifecycle stays private where it matters; settlement mints an allowlist leaf; later proofs answer only yes/no membership.

## 2. Who is the target audience?

- Small suppliers and merchants who extend bilateral trade credit
- Counterparties who need a privacy-preserving standing check before offering new credit
- Midnight builders who need a concrete Private Allowlist Access demo (loan desk → settle → `proveStanding` → verifier Pass)

Not the audience: retail consumer credit bureaus, KYC issuers, or public loan marketplaces.

## 3. What is the product?

**Tally** is a Midnight desk for private bilateral loan origination that ends in an allowlist entry.

1. **Originate** — Lender offers; borrower accepts; amount and due stay in witnesses.
2. **Fund** — Lender binds a Preprod payment grain (commitment), not a disclosed amount.
3. **Repay → Settle** — Settlement inserts a relationship leaf into `relationships` (HistoricMerkleTree) and a nullifier so the same settlement cannot be replayed.
4. **Allowlist access** — A party with a settled leaf proves membership to a third wallet/app. The verifier learns membership only.

### Privacy model (core feature)

What an **observer** (explorer, indexer, unrelated wallet) **can** learn:

- That a loan id exists and its **status** (Offered → Accepted → Funded → Repaid → Settled)
- Pseudonymous identity grains (`lenderPk`, `borrowerPk`) — not Lace display names or legal identity
- That a **payment commitment** was bound at disbursement
- The **Merkle root** (and history) of the relationships allowlist
- That a **nullifier** was consumed at settle

What an observer **cannot** learn:

- Loan **amount**
- **Due** date / slot
- User **secret** and **PIN**
- Which **leaf** corresponds to which real-world relationship when only a membership proof is presented
- The economic terms of any prior loan used for standing

What a **membership verifier** learns:

- Boolean: the prover is in the settled-relationship allowlist for this contract (at a stated root)
- Nothing about amount, due, or which leaf / index / counterparty pair was used

## 4. Project architecture

```
leaderboard-ui  → Lace / 1AM wallet, Local + Preprod desk, Lender / Borrower / Verifier roles
api             → contract glue, witnesses, proveStanding helpers
contract/       → tally.compact (offerLoan, acceptLoan, disburse, repay, settle, proveStanding)
proof-server    → local proving (Docker, port 6300)
```

Privacy split:

- **Public ledger:** loan id, status, pseudonymous pks, payment commitment, Merkle root, nullifiers
- **Witnesses (private):** user secret, PIN, amount, due slot, Merkle path for standing
- **Verifier output:** boolean membership only

Grounded in Compact (`contract/tally.compact`): public `LoanPublic` vs witnesses; settle writes `relationshipLeaf` + `settleNullifier`; `proveStanding` checks a Merkle path against `relationships` without disclosing the leaf.

### Preprod

| Network | Contract address |
|---|---|
| Midnight Preprod | `f8287add7fd6628c414dc876cb29a619694ecccb859bae5f0036c5dfb821b59e` |

### MVP in scope

- Five loan circuits plus `proveStanding`
- Desk UI: Local + Preprod Connect / Join / Deploy / full lifecycle
- Verifier role: Prove standing / Verify access → Pass or Fail (no amount)
- Simulator + Vitest (≥10 tests)
- README privacy model, demo video, UI screenshots

### Non-goals

- Credit bureau / third-party score issuance
- Web2 attestors (KYC, bank statements, off-chain oracles)
- Marketplace of loans or public order book
- Revealing amounts under any transparency mode
- Mainnet launch
- Defaulted / liquidation flows
- Replacing Lace/1AM identity with real-world legal identity
- General-purpose credential wallet (no W3C VC format in MVP)
- Proving *which* prior counterparty you dealt with (that would break allowlist privacy)

## Why this list item

Settlement already inserts into `HistoricMerkleTree` relationships. Private Allowlist Access is the membership proof UX on top. Loans populate the allowlist; standing is what the allowlist gates.
