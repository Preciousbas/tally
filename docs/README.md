# Tally documentation

Mintlify docs-as-code. Pages are MDX in this directory. Config lives at the repo root (`docs.json`, `mint.json`).

## Preview

From the repository root (port 3333 avoids the desk on 3000):

```bash
npx mint dev --port 3333
```

Fallback HTML preview (Tally tokens, no Mintlify client):

```bash
npm run docs:preview
```

## Demo video

Silent desk walkthrough (no narration):

| Asset | Path |
| --- | --- |
| Recording | [`demo/Tally-Demo-Silent.mp4`](demo/Tally-Demo-Silent.mp4) |
| Docs page | [`demo.mdx`](demo.mdx) |
| README | Root [`README.md`](../README.md) · section **Demo** |

## Screenshots

PNG files under `screenshots/local/` and `screenshots/preprod/` are used by the Desk tour, Local quickstart, and the root README. Do not delete them.

| Set | Path |
| --- | --- |
| Local desk | `screenshots/local/01-offered.png` … `05-verifier-pass.png` |
| Preprod | `screenshots/preprod/01-offer.png` … `06-standing-confirmed.png` |

## Pages

See [`llms.txt`](llms.txt) for the Use / Build index.
