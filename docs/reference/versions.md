# Versions

> Pins from this repository. Drift if origin/main moves.

Verified against **Preciousbas/tally `main` @ `9adf209`** (2026-09-20), reading `package.json`, `README.md`, `contract/tally.compact`, `proof-server/Dockerfile`, and `leaderboard-ui/.env.preprod`. These numbers are not a compatibility promise beyond what those files state.

## Surface table

| Component | Pin in repo | Where |
| --- | --- | --- |
| Node | 22 | README (`nvm use 22`); CI `node-version: "22"` |
| Compact compiler | `0.31.1` (`compact compile +0.31.1`) | README, `contract/package.json` |
| Compact source pragma | `language_version 0.23` | `contract/tally.compact` |
| `@midnight-ntwrk/midnight-js-*` | `4.1.1` | root `package.json` |
| `@midnight-ntwrk/dapp-connector-api` | `4.0.1` | root + `leaderboard-ui` |
| Wallet connector range | `4.x` (`COMPATIBLE_CONNECTOR_API_VERSION`) | `leaderboard-ui/src/wallets.ts` |
| `@midnight-ntwrk/compact-js` | `2.5.1` | root `package.json` |
| Proof server image | `midnightntwrk/proof-server:8.0.3` | `proof-server/Dockerfile` |
| Proof server network flag | `--network preprod` | same Dockerfile |
| Local prover port | `6300` | README; desk error copy |
| Desk UI | React 19, Vite 7 | `leaderboard-ui/package.json` |
| Network | Midnight Preprod | README |
| Published contract | `84c44946900ca4ad4456518b09a42c01424dd8b626797310c5ed5b4b933b10af` | README; `.env.preprod` |

> **Warning:** `npm` and `origin/main` can move independently. Re-read `package.json` and the README compile line before treating this table as current.

## Networks

| Item | Value in repo |
| --- | --- |
| Desk | https://tally-jet-mu.vercel.app |
| Indexer GraphQL | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Indexer websocket | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |
| tNIGHT faucet | https://midnight-tmnight-preprod.nethermind.dev/ |

`VITE_PROOF_SERVER_URL` is set in `.env.preprod`. Runtime proving uses the connected wallet's `proverServerUri`, not that env key.

## Next steps


  - [Overview](/overview) — Compile +0.31.1 and run tests.
  - [Contract reference](/contract) — Circuits verified against tally.compact.
