# Privacy

> Amount and due stay in witnesses. A verifier learns yes or no only.

The explorer does not see amount. Standing proofs answer allowlist membership only. That split is the product, not a mode you turn off.

Grounded in `contract/tally.compact`: public `LoanPublic` versus witnesses; `settle` writes `relationshipLeaf` and `settleNullifier`; `proveStanding` checks a Merkle path against `relationships`. The circuit does not disclose the leaf.

## Guarantee

Amount never crosses `disclose()`. `LoanPublic` has no amount field. A membership verifier never learns due, leaf index, or counterparty pairing.

## What an observer can learn

An observer is an explorer, indexer, or unrelated wallet.

- That a loan id exists and its **status** (Offered → Accepted → Funded → Repaid → Settled)
- Pseudonymous identity grains (`lenderPk`, `borrowerPk`) — not Lace display names or legal identity
- That a **payment commitment** was bound at disbursement
- The **Merkle root** (and history) of the relationships allowlist
- That a **nullifier** was consumed at settle

## What an observer cannot learn

- Loan **amount**
- **Due** date / slot
- User **secret** and **PIN**
- Which **leaf** corresponds to which real-world relationship when only a membership proof is presented
- The economic terms of any prior loan used for standing

Amount never crosses `disclose()` in Compact. `LoanPublic` has no amount field. Desk copy labels amount and due as off-ledger / witness-only. Instrument rows show `Amount: off-ledger`.

## What a membership verifier learns

- Boolean: the prover is in the settled-relationship allowlist for this contract (at a stated root)
- Nothing about amount, due, or which leaf / index / counterparty pair was used

The Verifier role on the desk states the same split: yes or no only.

## Witnesses vs public ledger

| Private (witness) | Public ledger |
| --- | --- |
| `getUserSecret` | `loans` map (`LoanPublic`) |
| `getPin` | `nextId` |
| `getLoanAmount` | `relationships` historic Merkle root |
| `getDueSlot` | `nullifiers` |
| `getRelationshipPath` | — |
| `getStandingLoanId` | — |
| `getStandingCounterpartyPk` | — |

Identity grains on-chain are hashes of secret + PIN, not `ownPublicKey()`. See [Identity](/identity).

## Desk copy

The live desk repeats this model in the UI:

- Hero: amount and due stay off-ledger
- Trust strip: link to the privacy write-up
- Lender fields: amount “stays off-ledger”; due “witness only”
- Verifier: “You only learn yes or no — not amount, due, or which leaf”

## Next steps


  - [Identity](/identity) — How Desk ID is derived. Not a wallet address.
  - [Contract reference](/contract) — Each circuit and what it discloses.
