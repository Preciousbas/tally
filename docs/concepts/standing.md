# Standing

> A membership proof answers yes or no. It does not name a leaf, amount, or counterparty.

Settled loans mint a relationship leaf into `relationships`. Later, a party proves they sit on that allowlist. A verifier learns a boolean at a stated Merkle root. The verifier does not learn which loan, which leaf index, or any economic term.

This is Private Allowlist Access. It is not a credit score and not a proof of *which* prior counterparty you dealt with.

```mermaid
flowchart LR
  S[Settle] --> L[relationship leaf]
  L --> T[HistoricMerkleTree]
  T --> P[proveStanding]
  P --> V[Verifier Pass or Fail]
```

## At a glance

| Piece | Role | Result |
| --- | --- | --- |
| `relationshipLeaf` | Hash of domain `tally:rel:v1:repaid`, loan id, both Desk IDs | Inserted at settle |
| `relationships` | `HistoricMerkleTree<10, Bytes<32>>` | Current root plus history |
| `proveStanding` | Rebuilds the leaf in witnesses; checks a Merkle path | Public transcript is a root check |
| Verifier | Pastes a root; desk compares to known roots | Pass or Fail only |

## How it works

Plain path on the desk:

1. Status must be **Settled**
2. Lender or Borrower clicks **Prove standing**
3. The desk copies the allowlist root
4. **Verifier** pastes that root and clicks **Verify access**

Mechanism: `proveStanding()` takes no public arguments. Witnesses supply `getStandingLoanId`, `getStandingCounterpartyPk`, and `getRelationshipPath`. The circuit rebuilds the leaf as lender and as borrower, asserts the path leaf matches one of those, then `relationships.checkRoot`. Failures include `"not a party leaf"` and `"not on allowlist"`.

On Preprod the desk derives the leaf with Compact `_relationshipLeaf_0` in `deskId.ts`. It does not use `TallySimulator`'s toy hash for that path. Local desk checks the simulator's in-memory root history.

## What is public vs private

| Public | Private |
| --- | --- |
| Allowlist Merkle root (and historic roots) | Which leaf was used |
| That `proveStanding` succeeded or failed | Amount, due, counterparty pairing |
| Loan status `Settled` | User secret and PIN |

## Guarantee

A membership verifier learns **yes or no only**. The proof does not disclose amount, due, leaf index, or which counterparty pair minted the leaf.

## Next steps


  - [Privacy](/privacy) — Visible / not visible / what a verifier learns.
  - [Verify access](/verify/overview) — How a third party checks a root on the desk.
