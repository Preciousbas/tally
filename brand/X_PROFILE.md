# Tally — X product profile kit

Create the account, then paste from this file. Brand DNA: [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).

## Handle

1. Prefer: **`@tally_midnight`**
2. Fallback: `@usetallydesk`
3. Fallback: `@notch_tally`

Display name: **Tally**

## Assets (upload)

| File | Use |
|---|---|
| [`x-avatar.svg`](x-avatar.svg) | Profile photo (export PNG 400×400 if X rejects SVG) |
| [`x-header.svg`](x-header.svg) | Header / banner (export PNG 1500×500 if needed) |
| [`tally-stick.svg`](tally-stick.svg) | Source mark |

Colors: bg `#1C1914`, bone `#E8DCC8`, ink `#C4B49A`, oxblood `#8C2F2B`. No gradient text. No purple neon.

## Bio (paste)

```
Private trade credit on Midnight. Amounts stay off-ledger. Settled loans mint standing you can prove without revealing the book.
https://tally-jet-mu.vercel.app
```

Website field (if separate): `https://tally-jet-mu.vercel.app`  
Location (optional): `Midnight Preprod`

## Pinned post (draft)

```
A medieval tally stick was split down the grain. Creditor kept one half. Debtor the other. Forgery failed because the wood had to match.

Tally does that on Midnight Network.

Amount and due stay in witnesses. The public ledger keeps status, a payment grain, and a Merkle allowlist. When a loan settles, you can prove standing — yes or no — without revealing the book.

Desk: https://tally-jet-mu.vercel.app
Repo: https://github.com/Preciousbas/tally
Preprod: f8287add7fd6628c414dc876cb29a619694ecccb859bae5f0036c5dfb821b59e
```

Attach: demo video (once recorded) or `docs/screenshots/04-standing.png`.

## Seven post starters (Week 1)

1. **Origin** — Stick metaphor (pinned variant, shorter). End with desk link.
2. **Privacy model** — What an explorer sees vs what stays in witnesses. Link README Privacy model.
3. **Pass seal** — Screenshot of Verifier Pass; “They never see amount or which leaf.”
4. **How to try (builders)** — `npm run dev` → Local desk → Offer → Settle → Prove standing → Verifier.
5. **Preprod** — Join address `f8287add…b59e`, Lace on Preprod, Vercel desk.
6. **Ask** — “Need two wallets to cut a stick this week. Reply if you build on Midnight.”
7. **Merchant stretch (one line only)** — “Prove you repaid without showing the amount.” Then builder CTA.

## Voice

- Builders first: Preprod, Local desk, `proveStanding`, GitHub, CI.
- Merchants: one line max per post. No bureau / KYC pitch.
- Ban: seamless, robust, empower, unlock, supercharge, exclamation marks, purple neon.

## After account exists

1. Paste handle URL into README `## Product profile` if different from `@tally_midnight`.
2. Pin the draft above.
3. Log trials in [`notes/users-l4.md`](../notes/users-l4.md).
