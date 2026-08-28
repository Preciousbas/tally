# Tally design system

Paste this paragraph into any later UI chat:

Tally is archival trade-credit on Midnight, not a crypto casino. Warm dark `#1C1914`, surface `#2A241C`, bone `#E8DCC8`, ink `#C4B49A`, oxblood `#8C2F2B` (2–3 uses per screen), moss `#4F6F54` for Settled only. Display Fraunces, body Figtree. Buttons shrink on hover, never grow. No gradient text, no purple neon, no glassmorphism, no Inter/Roboto/Space Grotesk, no exclamation marks, no seamless/robust/empower/unlock/supercharge, no three-column feature grids. The product is a desk of instruments, not a dashboard. Logo is a split tally stick SVG. Headline only under the mast. How-it-works is a ledger flap (`How a stick is cut`), never a route or a modal. Mast CTA stays on the same row as Tally on phone.

## Brand core

A medieval tally stick was split down the grain. Creditor kept one half, debtor the other. Forgery failed because the wood had to match. Tally does that on Midnight: the public ledger holds the matching grain (commitment). Amount and names live only in the two private halves.

## Naming

**Tally.** Repo: `tally-midnight`. Mascot: Notch (the split stick).

## Tokens

| Slot | Value | Role |
| --- | --- | --- |
| `--bg` | `#1C1914` | Page background (not black) |
| `--surface` | `#2A241C` | Cards, instrument paper |
| `--bone` | `#E8DCC8` | Headlines, primary text |
| `--ink` | `#C4B49A` | Body |
| `--muted` | `#8A7A64` | Eyebrows, chain strip |
| `--oxblood` | `#8C2F2B` | Primary action, Funded seal |
| `--moss` | `#4F6F54` | Settled only |
| `--rule` | `#3D3428` | Hairline borders |

## Type

- Display: Fraunces (opsz, soft) — headlines
- Body: Figtree — UI, forms
- Eyebrows: Figtree 600, letter-spacing 0.18em, uppercase

## Button laws

- Primary: oxblood fill, bone text, hover `scale(0.97)`
- Secondary: transparent, bone border
- Never `scale(1.02)` or grow

## Copy (rewrite before shipping if the voice feels off)

- Headline: `The other half stays private.`
- Flap tab: `How a stick is cut` — open on first visit, collapsed after. Not a page. Not a modal. No Wave 1 kicker in the mast.
- Notches (gloss only on what needs it): Offer — amount and due stay private. Accept — borrower agrees. Disburse — pay out. Chain never sees how much. Repay — borrower pays it back. Settle — close it. Settle in moss.
- Funded seal: `Funded`
- Mast: `Connect Wallet` (primary oxblood), wallet address chip when connected. Same row as wordmark at every width. No Lace-only copy unless Lace is the only installed wallet.
- Form: Amount / `how much`. Due in days / `30`. Borrower id / `borrower's id`. Payment / `Lace payment id`. Join / `Contract Address`. Instrument rows: Lender id, Borrower id, Payment (the chain proof, not the Lace id). No `(private)` on labels. No grain on the desk.

## Rejection list

No gradient text. No `scale-1.02` hover. No image overlays. No pure white or black. No exclamation marks. No seamless / robust / empower / unlock / supercharge. No three-column feature grids. No purple neon. No glassmorphism. No Inter, Roboto, or Space Grotesk. No “unlock credit”.

## Visual references (collect 8–12; starter set)

**Mood / craft (Pinterest, museums, print)**

- Split oak tally sticks, raking museum light
- Iron-gall ink on rag paper
- Notarial wax seal, oxblood
- 18th-century ledger ruled pages
- Quiet bilateral desk, one instrument at a time
- Midnight indigo cloth, not RGB purple
- Hairline wood grain matching across a split
- Linear-level density crossed with a print shop, not a trading terminal

**UI toolkit (agents: see `.cursor/skills/tally-ui-references/SKILL.md`)**

| Tier | Sites |
| --- | --- |
| Always consult | [ui-skills.com](https://ui-skills.com), [designsystemchecklist.com](https://designsystemchecklist.com), [interfaces.rauno.me](https://interfaces.rauno.me), [animations.dev](https://animations.dev) |
| Reference only | [component.gallery](https://component.gallery), [designsystems.one](https://designsystems.one), [open-props.style](https://open-props.style) (easing only), [utopia.fyi](https://utopia.fyi) (hero type only) |
| Cherry-pick | [coss.com/ui](https://coss.com/ui) (a11y patterns), [motion-primitives.com](https://motion-primitives.com) (flap/hero only) |
| Reject default | [ui.shadcn.com](https://ui.shadcn.com), [reui.io](https://reui.io/components), [vibeprompts.dev](https://vibeprompts.dev), [animatedbuttons.colorion.co](https://animatedbuttons.colorion.co), [kinetics.colorion.co](https://kinetics.colorion.co) |

## Logo

`brand/tally-stick.svg` — vertical stick, 5 notches, hairline gap down the grain. Favicon = the stick.
