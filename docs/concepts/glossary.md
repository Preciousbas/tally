# Glossary

> Plain meaning, then the mechanism, then the owner page.

Terms used on the desk and in `tally.compact`. Nothing here adds product claims beyond those pages.

| Term | Plain meaning | Mechanism | Owner |
| --- | --- | --- | --- |
| Tally | Private bilateral trade credit on Midnight | Desk + Compact contract `tally.compact` | [Introduction](/) |
| Local desk | In-browser demo. No wallet. | `TallySimulator`; Demo/Simulator caption | [Quickstart](/quickstart) |
| Preprod | Midnight test network the live desk joins | `VITE_NETWORK_ID=preprod`; Lace or 1AM | [Preprod](/preprod) |
| Desk ID | Pseudonymous party id you paste as Borrower id | `deriveUserPublicKey(secret, PIN)` domain `tally:user:pk:v1` | [Identity](/identity) |
| Witness | Private circuit input. Not on the explorer. | `getLoanAmount`, `getDueSlot`, secret, PIN, standing path | [Privacy](/privacy) |
| `LoanPublic` | What the ledger stores per loan | `status`, `lenderPk`, `borrowerPk`, `paymentCommit` | [Contract](/contract) |
| Payment grain | Commitment that a disbursement happened | 32-byte `paymentCommit`; amount is not stored | [How it works](/how-it-works) |
| Allowlist | Set of settled relationships | `HistoricMerkleTree<10>` named `relationships` | [Standing](/concepts/standing) |
| Leaf | One settled lender+borrower+loan tuple | Domain `tally:rel:v1:repaid` | [Standing](/concepts/standing) |
| Nullifier | Stops a second settle on the same pair | Domain `tally:nul:v1`; `nullifiers` set | [How it works](/how-it-works) |
| Standing | Yes/no membership in the allowlist | `proveStanding` + Verifier Pass/Fail | [Standing](/concepts/standing) |
| Verifier | Third party who only sees the boolean | Role segment → **Verify access** | [Verify](/verify/overview) |

## Next steps


  - [How it works](/how-it-works) — The six seals in order.
  - [Contract reference](/contract) — Circuit names and ledger fields.
