# Overview

> What this repository implements, and how to open it.

Tally is a workspace of four pieces. Workspace names still say `leaderboard-*` from the Midnight template. The product contract is `tally.compact`.

```
leaderboard-ui   React desk (Lace / 1AM, Local + Preprod, Lender / Borrower / Verifier)
api              Contract glue and witnesses
contract         tally.compact — offerLoan, acceptLoan, disburse, repay, settle, proveStanding
proof-server     Local proving for Preprod flows
```

Midnight already provides Compact, the proof server, the Preprod indexer, Lace/1AM (connector API `4.x`), and `midnight-js` providers. This repo implements the desk, `TallyAPI`, witnesses, `tally.compact`, and the in-browser `TallySimulator`.

Pins below were read from the repository on **2026-09-20** (`main` @ `9adf209`). Re-read `package.json` and the README compile line before treating them as current.

| Component | Pin in repo |
| --- | --- |
| Node | 22 |
| Compact compiler | `0.31.1` (`compact compile +0.31.1`) |
| Compact source pragma | `language_version 0.23` |
| `@midnight-ntwrk/midnight-js-*` | `4.1.1` |
| `@midnight-ntwrk/dapp-connector-api` | `4.0.1` |
| `@midnight-ntwrk/compact-js` | `2.5.1` |
| Proof server | `midnightntwrk/proof-server:8.0.3`, `--network preprod`, port `6300` |
| Published contract | `84c44946900ca4ad4456518b09a42c01424dd8b626797310c5ed5b4b933b10af` |

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

Open [http://localhost:3000](http://localhost:3000). Switch to **Local desk** for circuits without a wallet. CI on `main` is `npm install` and `npm test`.

Midnight-related code in this repository is Apache-2.0. New TypeScript files should carry the SPDX header from [`CONTRIBUTING.md`](https://github.com/Preciousbas/tally/blob/main/CONTRIBUTING.md).

## Commands

```bash
npm install          # Workspaces: contract, api, leaderboard-ui
npm test             # Vitest — identity, lifecycle, proveStanding
npm run dev          # Desk UI
npm run compile      # compact compile tally.compact
```

`leaderboard-ui` `dev` / `build` copies `contract/managed/tally/keys` and `zkir` into the web root so Preprod proving can fetch artifacts.

## Next steps


  - [Local quickstart](/quickstart) — Offer through Verifier Pass in about ten minutes. No wallet.
  - [Architecture](/architecture) — Request path, public vs private state, env.
