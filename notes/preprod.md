# Preprod deploy (judge path)

Compact 0.31.1 compiled `tally.compact` on 2026-08-17. Circuits: offerLoan, acceptLoan, disburse, repay, settle. ZKIR under `contract/managed/tally/zkir/`.

Host the desk on Vercel when you publish. Proof server needs Docker Desktop running. On a machine with Lace:

1. Lace → Preprod
2. Faucet tNIGHT: https://midnight-tmnight-preprod.nethermind.dev/
3. Generate tDUST in Lace
4. Proof server: local `http://localhost:6300` or the URL Lace reports
5. `npm run dev`, Connect, Deploy, copy 64-hex address into README
6. Second Chrome profile: Join, Accept, Repay
7. Lender: paste the disbursement tx id into payment reference, Disburse

After deploy, replace `VITE_DEFAULT_CONTRACT` in `leaderboard-ui/.env.preprod`.

GitHub topic to add on the public repo: `midnightntwrk`
