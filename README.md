# Tally

Private bilateral trade credit on Midnight. Amount and due stay in witnesses. Settlement mints a Merkle **allowlist** leaf. A third party verifies **standing** (membership) without learning which loan, counterparty, or amount.

Approved Moonshots idea: **Private Allowlist Access** ([notes/turn-proposal.md](notes/turn-proposal.md)).

Repo: https://github.com/Preciousbas/tally  
Preprod contract: `f8287add7fd6628c414dc876cb29a619694ecccb859bae5f0036c5dfb821b59e`

[![ci](https://github.com/Preciousbas/tally/actions/workflows/ci.yml/badge.svg)](https://github.com/Preciousbas/tally/actions/workflows/ci.yml)

## Privacy model

What an **observer** (explorer, indexer, unrelated wallet) **can** learn:

- Loan id and **status** (Offered → Accepted → Funded → Repaid → Settled)
- Pseudonymous identity grains (`lenderPk`, `borrowerPk`) — not legal identity
- That a **payment commitment** was bound at disbursement
- The **Merkle root** (and history) of the relationships allowlist
- That a **nullifier** was consumed at settle

What an observer **cannot** learn:

- Loan **amount** or **due**
- User **secret** and **PIN**
- Which **leaf** was used when only a membership / standing proof is presented
- Economic terms of any prior loan used for standing

What a **membership verifier** learns:

- Yes or no: the prover is on the settled-relationship allowlist
- Nothing about amount, due, leaf index, or counterparty pairing

## Engineering

Compact: [`contract/tally.compact`](contract/tally.compact)

- Circuits: `offerLoan`, `acceptLoan`, `disburse`, `repay`, `settle`, `proveStanding`
- Dual ledger: public `LoanPublic` vs witnesses for secret, PIN, amount, due, standing path
- Identity from secret + PIN (`tally:user:pk:v1`)
- Disburse binds a payment grain; amount never disclosed
- Settle inserts a relationship leaf + nullifier
- `proveStanding` checks Merkle membership via `HistoricMerkleTree.checkRoot`

## How judges test

1. Node 22+, Compact 0.31 (`compact --version`), Docker for proof server on Preprod
2. `npm install`
3. `cd contract && compact compile tally.compact managed/tally && npm test` (10 tests)
4. Local desk (standing demo): `npm run dev` → **Local desk** → Offer → Accept → Disburse → Repay → Settle → **Prove standing** → switch **Verifier** → **Verify access** (Pass)
5. Preprod: `npm run dev --workspace leaderboard-ui -- --mode preprod` → Connect Wallet → Join/Deploy → loan lifecycle
6. Faucet: https://midnight-tmnight-preprod.nethermind.dev/

## Setup

```bash
nvm use 22
npm install
cd contract && compact compile tally.compact managed/tally && npm test
cd .. && npm run dev
```

Preprod desk:

```bash
npm run dev --workspace leaderboard-ui -- --mode preprod
```

## QA

`npm test` — identity, loan lifecycle, allowlist standing (happy path + reject + verifier yes/no).

CI: `.github/workflows/ci.yml`

## Live demo

Host the desk on Vercel (`vercel.json`). After deploy, put the URL here:

- Live demo: _(add Vercel URL after deploy)_

## Product

Credit is pairwise. Privacy is the product. Settled leaves populate a private allowlist for standing proofs (L3 Private Allowlist Access).

## Non-goals

Web2 attestors, credit bureau scores, loan marketplace, mainnet (L6), Defaulted liquidation, proving *which* prior counterparty you dealt with.

## License

Apache-2.0 for Midnight-related code in this repository.
