# Tally

Private bilateral loan origination on Midnight. Amount and due date stay in witnesses. The public ledger stores loan id, status, pseudonymous identity grains, a payment commitment, a relationship Merkle tree, and nullifiers.

Wave 1 of the Midnight Buildathon: offer → accept → disburse → repay → settle on Preprod.

## Engineering (40)

Compact contract: [`contract/tally.compact`](contract/tally.compact)

- Dual ledger: public `LoanPublic` vs witnesses `getUserSecret`, `getPin`, `getLoanAmount`, `getDueSlot`
- Identity from secret + PIN (`tally:user:pk:v1`). Does not use `ownPublicKey()`
- Disburse binds a payment grain (Lace/Zswap tx id or coin commitment). Amount is never disclosed
- Settle inserts a relationship leaf and a nullifier (Wave 2 standing proofs consume the leaf)

## How judges test

1. Node 22+, Docker Compose v2, Compact toolchain 0.31 (`compact --version`)
2. Lace on Preprod. Faucet tNIGHT, generate tDUST. Proof server `http://localhost:6300` for local proving
3. Two Chrome profiles (Lender / Borrower)
4. `npm install`
5. `compact compile tally.compact managed/tally` from `contract/`
6. `npm test`
7. `npm run dev` — or open the Vercel URL after a later deploy
8. Local desk: Offer → switch to Borrower → Accept → Lender Disburse → Borrower Repay → Settle. Funded shows an oxblood seal
9. Preprod: Deploy from Lender, copy address, Join from Borrower, same five steps. Paste a real Lace tx id into payment reference before Disburse

## Setup

```bash
nvm use 22
npm install
cd contract && compact compile tally.compact managed/tally && npm test
cd .. && npm run dev
```

Install Compact:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31
```

Preprod faucet: https://midnight-tmnight-preprod.nethermind.dev/

## QA (15)

`npm test` runs Compact-logic simulation tests (identity stability, happy path, wrong-party rejects, nullifier replay).

CI: `.github/workflows/ci.yml`

## Product (15)

Credit is a pairwise instrument, not a bureau score. Privacy is the product: the explorer cannot see amount. Wave 2 proves standing from settled leaves.

## Non-goals (Wave 1)

Third-party `proveStanding`, web2 attestors, marketplace, mainnet, Defaulted liquidation.

## License

Apache-2.0 for Midnight-related code in this repository.
