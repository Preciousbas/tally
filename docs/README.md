# Tally documentation

Mintlify docs-as-code (`docs.json` theme `mint`). MDX is the source; `.md` mirrors sit beside each page for agents. Human nav is Use vs Build. Agent index: [`llms.txt`](llms.txt).

## Preview

From this directory (port 3333 avoids the desk on 3000):

```bash
npx mint dev --port 3333
```

From the repo root: `npm run docs:dev`.

Fallback HTML preview (Tally tokens, no Mintlify client):

```bash
npm run docs:preview
```

## Screenshots

PNG files under `screenshots/local/` and `screenshots/preprod/` are used by the Desk tour, Local quickstart, and the root README. Do not delete them.

| Set | Path |
| --- | --- |
| Local desk | `screenshots/local/01-offered.png` … `05-verifier-pass.png` |
| Preprod | `screenshots/preprod/01-offer.png` … `06-standing-confirmed.png` |

## Pages

See [`llms.txt`](llms.txt) for the Use / Build index.
