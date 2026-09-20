# Introduction

> Private bilateral trade credit on Midnight.

Tally is a desk for private bilateral loan origination on Midnight. Amount and due stay in witnesses. The public ledger stores loan id, status, pseudonymous identity grains, a payment commitment, a relationship Merkle allowlist, and nullifiers.

When a loan settles, it mints a relationship leaf. A later membership proof (`proveStanding`) answers one question for a third party: is this identity in the allowlist? The verifier learns **yes or no only**. The proof does not disclose which leaf, amount, or counterparty.

The product name is **Tally**. Credit is a pairwise instrument. It is not a bureau score.

```mermaid
flowchart LR
  A[Offer] --> B[Accept]
  B --> C[Disburse]
  C --> D[Repay]
  D --> E[Settle]
  E --> F[Prove standing]
  F --> G[Verifier yes or no]
```

## The pipeline

Every instrument follows one ordered path:

**Offer → Accept → Disburse → Repay → Settle → Prove standing**


  1. **Offer** — Lender sets amount and due privately. On Preprod the borrower is named by Desk ID, not a wallet address.
  2. **Accept** — The named borrower accepts. Status becomes Accepted.
  3. **Disburse** — Lender binds a payment commitment. The amount itself is never disclosed on-chain.
  4. **Repay** — Borrower marks the instrument repaid.
  5. **Settle** — Either party closes it. The contract inserts a relationship leaf and consumes a nullifier.
  6. **Prove standing** — A party proves allowlist membership. A verifier sees Pass or Fail only.


## Two ways in

| Path | What you need | What you get |
| --- | --- | --- |
| [Local desk](/quickstart) | Node 22 and a browser. No wallet. | Full circuit path in-browser (Demo/Simulator). |
| [Preprod](/preprod) | Lace or 1AM on Midnight Preprod, tDUST, proof server. | The same seals against the live contract. |

Live desk: [https://tally-jet-mu.vercel.app](https://tally-jet-mu.vercel.app)

| | |
| --- | --- |
| Network | Midnight Preprod |
| Contract | `84c44946900ca4ad4456518b09a42c01424dd8b626797310c5ed5b4b933b10af` |

## Use vs Build


  - [Use the desk](/desk) — Local vs Preprod, Lace or 1AM, and the Lender / Borrower / Verifier roles.
  - [Build on the contract](/overview) — What Midnight already gives you, and what this repo implements.


## What Tally is not

These are out of scope:

- Credit bureau / third-party score issuance
- Web2 attestors (KYC, bank statements, off-chain oracles)
- A marketplace of loans or a public order book
- Revealing amounts under any transparency mode
- Mainnet launch
- Defaulted / liquidation flows
- Replacing Lace/1AM with real-world legal identity
- A general-purpose credential wallet (no W3C VC format)
- Proving *which* prior counterparty you dealt with

`proveStanding` is in scope. It is Private Allowlist Access — membership only.

## Next steps


  - [Lifecycle](/lifecycle) — Each seal, who acts, and what the ledger stores.
  - [Local quickstart](/quickstart) — Offer through Verifier Pass in about ten minutes. No wallet.
