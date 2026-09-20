# Contributing

> Node 22, Compact 0.31, npm test, then the desk.

Clone, compile `tally.compact`, run the simulator tests, then open the desk. CI on `main` is `npm install` and `npm test` (`.github/workflows/ci.yml`).

Midnight-related code in this repository is Apache-2.0. New TypeScript files should carry the SPDX header from [`CONTRIBUTING.md`](https://github.com/Preciousbas/tally/blob/main/CONTRIBUTING.md). Contributors sign the Midnight CLA via CLA assistant on the pull request.

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

Open [http://localhost:3000](http://localhost:3000). Switch to **Local desk** for circuits without a wallet.

## Commands

```bash
npm install          # Workspaces: contract, api, leaderboard-ui
npm test             # Vitest — identity, lifecycle, proveStanding
npm run dev          # Desk UI
npm run compile      # compact compile tally.compact
```

`leaderboard-ui` `dev` / `build` copies `contract/managed/tally/keys` and `zkir` into the web root so Preprod proving can fetch artifacts.

## Preview these docs

From `docs/` (port 3333 avoids the desk on 3000):

```bash
cd docs && npx mintlify dev --port 3333
```

The current Mintlify CLI package is also `mint` (`npx mint dev --port 3333`). If the Mintlify client cannot download, generate a local HTML preview:

```bash
npm run docs:preview
```

That writes `docs/.preview/` and serves it (default [http://127.0.0.1:3333](http://127.0.0.1:3333)).

Validate the Mintlify graph:

```bash
cd docs && npx mintlify validate
```

## Deploy

**Desk (existing):** `vercel.json` builds workspaces and serves `leaderboard-ui/dist`. Production: [https://tally-jet-mu.vercel.app](https://tally-jet-mu.vercel.app).

```bash
npx vercel --prod --yes
```

Set `VITE_DEFAULT_CONTRACT` and `VITE_NETWORK_ID=preprod` on the Vercel project if the hosted desk should Join the published address by default.

**Docs (Mintlify Hobby):** connect `Preciousbas/tally` at [dashboard.mintlify.com](https://dashboard.mintlify.com). Select the **`docs`** folder (`docs/docs.json`). Publish. Do not point the existing desk `vercel.json` at MDX.

**Docs (secondary static export):** Cloudflare Pages or GitHub Pages from `npm run docs:preview -- --no-serve` output `docs/.preview`. Leave the current desk project unchanged.

## Pull requests

Use `.github/PULL_REQUEST_TEMPLATE/pull_request_template.md`. Do not `--force` push. Match existing desk voice: no exclamation marks, no purple neon, no invented product claims. Circuit changes need a simulator test.

## Next steps


  - [Architecture](/architecture) — Which package to open first.
  - [Design system](/design-system) — Tokens and the rejection list.
