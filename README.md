# Tally

Private bilateral trade credit on Midnight. Loan amounts and due dates stay off the public ledger. When a loan settles, you can prove repaid standing to someone new — yes or no only.

[Live desk](https://tally-jet-mu.vercel.app) · [X](https://x.com/tally_midnight)

[![ci](https://github.com/Preciousbas/tally/actions/workflows/ci.yml/badge.svg)](https://github.com/Preciousbas/tally/actions/workflows/ci.yml)

## What this is

Trade credit is pairwise. Proving “I have repaid before” usually means revealing amounts and counterparties or trusting a centralized score. Tally keeps economic terms in private witnesses and publishes only what a ledger needs for integrity: status, pseudonymous identities, a payment commitment, an allowlist root, and nullifiers.

Settled loans mint a relationship leaf into a Merkle allowlist. A later membership proof answers a single question for a third party: is this identity in the allowlist? The verifier never learns the amount, the counterparty, or which loan was used.

## Live deployment

| | |
|---|---|
| Desk | https://tally-jet-mu.vercel.app |
| Network | Midnight Preprod |
| Contract | `f8287add7fd6628c414dc876cb29a619694ecccb859bae5f0036c5dfb821b59e` |

Use **Lace** or **1AM** on Preprod to join the contract, or switch to **Local desk** for a full in-browser demo with no wallet.

## Product tour

![Desk](docs/screenshots/01-connect.png)

The desk: brand, wallet connect, and a clear split between Preprod and Local.

![Offer](docs/screenshots/02-offer.png)

Offer a loan. Amount stays off-ledger; the public instrument shows status, not terms.

![Settled](docs/screenshots/03-instrument.png)

Lifecycle seals move Offered → Accepted → Funded → Repaid → Settled without disclosing amount.

![Standing](docs/screenshots/04-standing.png)

Prove standing, then verify as a third party. Pass or fail only — no book.

## How it works

1. **Offer** — Lender sets amount and due (private). Borrower is named by pseudonymous id on Preprod.
2. **Accept** — Borrower accepts the instrument.
3. **Disburse** — Lender binds a payment commitment. The amount itself is never disclosed on-chain.
4. **Repay → Settle** — Settlement inserts a relationship leaf and consumes a nullifier.
5. **Prove standing** — A party proves allowlist membership. A verifier learns membership only.

## Privacy

**Visible on the public ledger**

- Loan id and status
- Pseudonymous lender and borrower identity grains
- Payment commitment at disbursement
- Relationships allowlist Merkle root
- Settle nullifiers

**Not visible on the public ledger**

- Loan amount
- Due date
- User secret and PIN
- Which allowlist leaf backs a standing proof
- Economic terms of prior loans

**What a membership verifier learns**

- A boolean: the prover is in the settled-relationship allowlist at a stated root
- Nothing about amount, due, leaf index, or counterparty

## Architecture

```
leaderboard-ui   React desk (Lace / 1AM, Local + Preprod, Lender / Borrower / Verifier)
api              Contract glue and witnesses
contract         tally.compact — offerLoan, acceptLoan, disburse, repay, settle, proveStanding
proof-server     Local proving for Preprod flows
```

Identity is derived from secret + PIN (`tally:user:pk:v1`), not `ownPublicKey()`. Public state is `LoanPublic`; amount and due remain witnesses.

## Setup

```bash
git clone https://github.com/Preciousbas/tally
cd tally
nvm use 22
npm install
```

Install Compact 0.31.1:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1
```

Compile, test, and run the desk:

```bash
cd contract && compact compile +0.31.1 tally.compact managed/tally && npm test
cd .. && npm run dev --workspace leaderboard-ui -- --mode preprod
```

Open http://localhost:3000. For Preprod wallet flows, use Lace or 1AM on Preprod and a proof server on port 6300. Faucet: https://midnight-tmnight-preprod.nethermind.dev/

## Commands

```bash
npm install          # Install workspaces
npm test             # Contract simulation tests (Vitest)
npm run dev          # Desk UI (leaderboard-ui)
```

CI runs `npm install` and `npm test` on push and pull requests to `main`.

## License

Apache-2.0 for Midnight-related code in this repository.
