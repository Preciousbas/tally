# Tally documentation

Mintlify docs-as-code (`docs.json` theme `mint`). MDX is the source; `.md` mirrors sit beside each page for agents. Human nav is Use vs Build vs Reference. Agent index: [`llms.txt`](llms.txt).

Brand tokens: `--bg` `#1C1914`, `--bone` `#E8DCC8`, `--oxblood` `#8C2F2B` (`custom.css` + `docs.json`).

## Preview

From this directory (port 3333 avoids the desk on 3000):

```bash
npx mintlify dev --port 3333
```

The current Mintlify CLI package is also `mint` (`npx mint dev --port 3333`). From the repo root: `npm run docs:dev`.

Fallback HTML preview (Tally tokens, no Mintlify client):

```bash
npm run docs:preview
```

## Mintlify Cloud (Hobby / free)

1. Sign in at [dashboard.mintlify.com](https://dashboard.mintlify.com) with GitHub.
2. Create a project and connect `Preciousbas/tally`.
3. Set the documentation directory to **`docs`** (`/docs`, no trailing slash). That is where `docs.json` lives.
4. Publish. Later pushes to the connected branch rebuild the site.

Do not point the existing desk Vercel project at this folder.

Secondary static export only: `npm run docs:preview -- --no-serve` → host `docs/.preview` on Cloudflare Pages or GitHub Pages.

## Screenshots

PNG files under `screenshots/local/` and `screenshots/preprod/` are used by Desk, Local quickstart, and the root README. Do not delete them.

| Set | Path |
| --- | --- |
| Local desk | `screenshots/local/01-offered.png` … `05-verifier-pass.png` |
| Preprod | `screenshots/preprod/01-offer.png` … `06-standing-confirmed.png` |

## Pages

See [`llms.txt`](llms.txt) for the Use / Build / Reference index.
