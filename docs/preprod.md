# Preprod guide

> Join the Midnight Preprod contract with Lace or 1AM.

Run the same seals as Local desk against the published Compact contract. You need a wallet, tDUST, and a proof server.

| | |
| --- | --- |
| Desk | [https://tally-jet-mu.vercel.app](https://tally-jet-mu.vercel.app) |
| Network | Midnight Preprod |
| Contract | `84c44946900ca4ad4456518b09a42c01424dd8b626797310c5ed5b4b933b10af` |
| Indexer | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Faucet | [https://midnight-tmnight-preprod.nethermind.dev/](https://midnight-tmnight-preprod.nethermind.dev/) |

Default contract is also set as `VITE_DEFAULT_CONTRACT` in `leaderboard-ui/.env.preprod`.

## Before you start

1. Node 22 if you run the desk locally
2. Two Chrome profiles (Lender / Borrower). Use the desk **Verifier** role as the third
3. [Lace](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiennaehnffkwbomagd) or [1AM](https://www.1am.xyz/) set to **Preprod**
4. Faucet tNIGHT, then generate tDUST in the wallet
5. Proof server for local proving

## Proof server

The desk takes `proverServerUri` from the connected wallet configuration. For local proving, run Midnight's proof server on port 6300:

```bash
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server --network preprod
```

The repo image is `proof-server/Dockerfile` (`midnightntwrk/proof-server:8.0.3`, `--network preprod`). If the wallet cannot reach a prover, the desk reports: start Docker on port 6300.

## Open the desk

Hosted:

1. Open [https://tally-jet-mu.vercel.app](https://tally-jet-mu.vercel.app)
2. Stay on **Preprod**
3. **Connect Wallet**

Local:

```bash
nvm use 22
npm install
cd contract && compact compile +0.31.1 tally.compact managed/tally
cd .. && npm run dev --workspace leaderboard-ui -- --mode preprod
```

Open [http://localhost:3000](http://localhost:3000). Compile first so `leaderboard-ui` can copy keys and ZKIR into `public/`.

## Join or Deploy

**Join** the published address (already filled on the hosted desk):

```
84c44946900ca4ad4456518b09a42c01424dd8b626797310c5ed5b4b933b10af
```

The field must be 64 hex characters. Click **Join**.

**Deploy** from a connected Lender if you want a fresh instance. The new address is copied. Share it with the Borrower profile so they Join the same contract.

## Desk ID, not wallet address

Each browser derives a Desk ID from a secret stored at `tally-midnight-secret` plus PIN `1234`. That is what you paste into **Borrower id**.

1. On the Borrower profile: Connect, Join, click **Desk ID** in the trust strip, copy
2. On the Lender profile: Offer → Borrower id → paste that 64-hex value
3. Do not paste an `mn_addr_…` Lace address

See [Identity](/identity).

## Loan steps on Preprod

Use two profiles. Switch the role control to match the acting party.

1. **Lender — Offer.** Amount (required, whole number &gt; 0), due (default 30), Borrower Desk ID, Offer
2. **Borrower — Accept**
3. **Lender — Disburse.** Paste a real Lace payment id into Payment when you have one, then Disburse. The chain stores a commitment, not the amount
4. **Borrower — Repay**
5. **Either party — Settle**
6. **Party — Prove standing.** Copy the allowlist root (indexer can lag a few seconds)
7. **Verifier — Verify access.** Pass or Fail, no amount

![Preprod offer with Desk ID.](/screenshots/preprod/01-offer.png)

## Common errors

| Desk message | What to do |
| --- | --- |
| Set your wallet to Preprod | Network ID mismatch in Lace/1AM |
| Insufficient DUST | Faucet tNIGHT, generate tDUST |
| Proof server unreachable | Docker on `:6300`, or use the URI the wallet reports |
| Contract address must be 64 hex | Join field is not a Midnight contract address |
| This instrument is not addressed to your key | Wrong profile / Desk ID |
| Desk private state is missing | Join the contract again on this desk |
| Allowlist root not in indexer yet | Wait and refresh after a successful prove |

## Next steps


  - [Architecture](/architecture) — Desk, API, Compact, proof server.
  - [Identity](/identity) — Secret + PIN, and why Lace address is the wrong field.
