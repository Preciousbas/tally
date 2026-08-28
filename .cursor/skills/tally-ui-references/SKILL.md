---
name: tally-ui-references
description: >-
  Curated UI reference sites and integration rules for Tally (tally-midnight).
  Auto-invoke when auditing, polishing, extending, or reviewing the ledger desk
  UI, motion, accessibility, tokens, or when the user shares generic shadcn /
  dashboard component libraries. Read DESIGN_SYSTEM.md first. Never replace
  Tally's warm ledger aesthetic with default SaaS patterns.
---

# Tally UI references

Tally is an **instrument desk** on Midnight — warm dark ledger, Fraunces + Figtree, oxblood accent. Not a crypto casino, not a shadcn dashboard.

**Always read first:** `DESIGN_SYSTEM.md` at repo root.

## Integration rule

Cherry-pick **patterns** into existing `App.css` + React. Do not bulk-install shadcn, ReUI grids, or marketing template kits. New tokens must map to existing CSS variables (`--bg`, `--bone`, `--oxblood`, etc.).

## Always consult (audit + polish)

| Site | URL | Use |
| --- | --- | --- |
| UI Skills | https://ui-skills.com | Agent/human playbooks — audit UI, fix generic AI design, motion, a11y |
| Design system checklist | https://designsystemchecklist.com | Before adding colors, radii, or one-off styles |
| Interfaces | https://interfaces.rauno.me | Focus rings, copy feedback, disabled states, keyboard paths |
| Animations (Emil Kowalski) | https://animations.dev | Motion purpose, frequency, speed — see Motion policy below |

## Reference only (density, tokens, inspiration)

| Site | URL | Use |
| --- | --- | --- |
| Component Gallery | https://component.gallery | Real DS examples — Linear/Mercury density, not copy-paste |
| Design Systems One | https://designsystems.one | Token file structure, production DS research |
| Open Props | https://open-props.style | **Easing/duration only** — not their color palette |
| Utopia | https://utopia.fyi | Fluid type for hero/marketing — desk stays fixed scale |
| bg.ibelick.com | https://bg.ibelick.com | Subtle paper/grain backgrounds if needed (desk already has grain flap) |
| Icon Creator | https://iconcreator.dev | Custom notch/stick icons if SVG set grows |

## Cherry-pick with care

| Site | URL | Use |
| --- | --- | --- |
| Coss UI | https://coss.com/ui | Accessible form/dialog patterns only — not Cal.com chrome |
| Motion Primitives | https://motion-primitives.com | One-off enter for flap/hero — not toolbar or loan list |
| Beautiful UI | https://beautifului.dev | Browse for editorial tone |
| Be UI | https://beui.dev | Browse for editorial tone |
| Rare UI | https://rareui.com | Browse for editorial tone |
| Transitions | https://transitions.dev | Transition timing reference |

## Reject for Tally (unless user explicitly overrides)

| Site | URL | Why |
| --- | --- | --- |
| shadcn/ui | https://ui.shadcn.com | Default SaaS look; conflicts with aesthetic-frontend |
| ReUI | https://reui.io/components | Grids, kanban, gantt — wrong product shape |
| Vibe Prompts | https://vibeprompts.dev | Marketing sections, not instrument desk |
| Animated Buttons | https://animatedbuttons.colorion.co | Breaks button law (`scale(0.97)` shrink, never grow) |
| Kinetics | https://kinetics.colorion.co | Springs on hot-path actions slow the desk |

## Motion policy (desk = high frequency)

Per [You Don't Need Animations](https://animations.dev):

- **No animation** (or ≤180ms): Connect Wallet, Deploy, Preprod/Local toggle, loan list, Offer/Accept/Repay/Settle.
- **Purposeful motion OK:** grain flap (`How a stick is cut`), Funded seal on status change, Copied feedback after deploy.
- **Cap:** UI transitions under **300ms**. Keyboard-initiated actions: **zero** animation delay.

## Workflow

1. Read `DESIGN_SYSTEM.md` rejection list and tokens.
2. Pick a reference site from **Always consult** or **Reference only**.
3. Inspect the pattern — does it fit an instrument desk?
4. Integrate into existing components; map colors to Tally tokens.
5. Run mental ui-skills + designsystemchecklist pass before shipping.

## Related skills

- `aesthetic-frontend` — distinctive UI, anti-slop defaults
- `mad-frontend-design` / `LANDING_PAGE_PLAYBOOK.md` — marketing pages only, not the desk
- `workflow-partner` — creative director loop, rejection list
