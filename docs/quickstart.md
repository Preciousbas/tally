# Local quickstart

> Run the Local desk end-to-end in about ten minutes. No wallet.

By the end you will have offered, accepted, disbursed, repaid, and settled a loan in the browser simulator, then proved standing and seen Verifier **Pass**. Amount never appears on the instrument.

This path does not talk to Midnight Preprod. For the chain, use the [Preprod guide](/preprod).

## Before you start

- Node 22 (`nvm use 22`)
- npm
- A current Chromium browser

Compact is not required for Local desk. The UI runs `TallySimulator` in-page. Compile + `npm test` if you want the same circuits checked as TypeScript first.

## 1. Install and open the desk

```bash
git clone https://github.com/Preciousbas/tally
cd tally
nvm use 22
npm install
npm run dev --workspace leaderboard-ui -- --mode preprod
```

Open [http://localhost:3000](http://localhost:3000). Or use the hosted desk at [https://tally-jet-mu.vercel.app](https://tally-jet-mu.vercel.app).

## 2. Switch to Local desk

In the toolbar, click **Local desk**. The caption reads Demo/Simulator.

If no Lace/1AM connector appears, the desk switches to Local on its own.

## 3. Offer as Lender

Stay on **Lender**.

1. Amount: a whole number greater than 0 (for example `50`)
2. Due in days: `30` or leave blank (defaults to 30)
3. Click **Offer**

A row `#1` appears with seal **Offered**. Lender id and Borrower id are demo Desk IDs. Amount reads **off-ledger**.

![Local offered instrument.](/screenshots/local/01-offered.png)

## 4. Accept as Borrower

Switch the role segment to **Borrower**. Click **Accept**. Seal becomes **Accepted**.

## 5. Disburse as Lender

Switch to **Lender**. Payment may stay empty on Local desk; the UI derives a stand-in grain. Click **Disburse**. Seal becomes **Funded**.

![Local funded instrument.](/screenshots/local/02-funded.png)

## 6. Repay and Settle

1. Borrower → **Repay** → **Repaid**
2. Lender or Borrower → **Settle** → **Settled**

Settle inserts the relationship leaf in the simulator and records a historic root.

![Settled, Prove standing enabled.](/screenshots/local/03-settled-prove.png)

## 7. Prove standing

As Lender or Borrower, click **Prove standing**. You should see **Standing confirmed** and a copyable allowlist root.

![Standing confirmed on Local desk.](/screenshots/local/04-standing-confirmed.png)

## 8. Verifier Pass

Switch to **Verifier**. The allowlist root field should already hold the root. Click **Verify access**. Standing seal: **Pass**.

![Verifier Pass — yes or no only.](/screenshots/local/05-verifier-pass.png)

The verifier panel does not show amount, due, or which leaf was used.

## If a step fails

| Symptom | Cause |
| --- | --- |
| Amount error | Amount must be a whole number greater than 0 |
| “Local simulator reset” | Refresh cleared in-memory circuits. Offer through Settle again |
| Standing Fail | Root does not match the simulator history, or the loan is not Settled |
| No instruments after refresh | The list can restore from `tally.localLoans.v1`, but proofs need a live simulator run |

## Next steps


  - [Preprod guide](/preprod) — Same five loan steps against the published contract.
  - [How it works](/how-it-works) — What each circuit writes on the ledger.
