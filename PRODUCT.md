# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the Master (family head).** An Indonesian adult who manages personal and household money and thinks in net worth, not just spending. They want one view of every asset and liability, and to see whether wealth is growing.
- **Co-Master (spouse).** Shares household-wide visibility and control with the Master.
- **Family members and children ("Anak").** They record their own transactions, request funds ("Minta Dana"), and see only what their role allows. Children use the app too.
- **Staff ("operational": secretary, driver, domestic helper).** They do delegated data entry with row-scoped access and never see family wealth.
- Older family members (parents or grandparents) may also use the app.
- Usage is split evenly between phone (daily capture) and desktop (reports, planning, settings). Neither is secondary.

## Product Purpose

WealthMe is a family wealth operating system for Indonesia. It combines everything in one place:

- transactions;
- bank, cash and e-wallet accounts;
- investments, physical assets and liabilities, including realistic KPR with fixed, tiered, floating, flat or annuity rates;
- goals, budgets and insurance;
- inheritance (warisan);
- zakat and donations;
- Indonesian personal tax (PPh OP, PPh 21 TER, UMKM, final tax);
- split bills, reports and an AI advisor.

Success means users open the net-worth view weekly and complete financial goals (PRD targets: at least 70% weekly net-worth view, at least 40% complete one goal within 90 days; these are directional and still need validation).

## Positioning

- **Net worth over transaction logging.** Built for Indonesian families rather than individuals.
- **Multi-member households with real roles.** Master, Co-Master, member, child and staff work together without sharing bank credentials.
- **Local obligations as first-class, deterministic calculations** (never the LLM): zakat maal with nisab, PPh 21 TER, UMKM 0,5%, inheritance heirs, tithes (persepuluhan).

## Operating Context

- **Daily capture and approval:**
  - Quick transaction entry and receipt scan on the phone.
  - Members request funds, and the Master or Co-Master approves them in Persetujuan.
- **Periodic review:** reports, net worth, budgets, goals, and the annual tax (SPT) summary.
- **Money model:**
  - Amounts are stored in IDR, and any input currency is converted with an FX audit trail. Each user picks a display currency.
  - Gold is valued from the Antam price per kg (source: emasantam.id).
  - Market prices come from live feeds when they are available. A missing price is labelled, never simulated.
- **Environments:** a dev server at wealthme.demo-wit.id, and a staging server at staging.wealthme.id that holds real user data.

## Capabilities and Constraints

- The stack: Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/Base UI (web) and NestJS 11 + Prisma + PostgreSQL (API), in a Turborepo monorepo.
- Money math uses exact integers or decimal strings with round-half-up. There is no float drift.
- **Honest UI.** A control does what it implies, or it says it doesn't yet. Estimates are labelled ("Perkiraan", "≈"). No fake live badges.
- **Access rules:**
  - A transaction can be edited only by its recorder or by the owner of the private account.
  - Private accounts are visible only to Master and Co-Master.
  - Input Cepat is for Master and Co-Master only.
- Tax figures always stay in IDR.
- Open decisions:
  - The final legal texts (Kebijakan Privasi, Syarat & Ketentuan) are drafts pending review.
  - The support contact is email only for now.

## Brand Commitments

- The name is **WealthMe**. The UI is Indonesian first, with English available (an ID/EN toggle).
- **Voice:** casual but polite, addressing the user as "kamu". Short and warm, never stiff or banking-formal.
- **Client mandate: "anti slop, tidak banyak tulisan secara bahasa atau visual".**
  - Minimal text.
  - Helper text at most one line.
  - No boilerplate subtitles, em-dashes, decorative middle-dots or decorative pills.
  - Rare details go behind a disclosure ("Opsi lanjutan") or a tooltip.
- Forms are symmetric and comfortable. Two-column rows pair only fields of the same control shape.
- Optional fields are marked "(opsional)", never with an asterisk convention.
- Error messages are clear and non-technical. They never show error IDs, status codes or raw server text.

## Evidence on Hand

- The product requirements are in `docs/product/PRD.md`, `docs/product/USER-STORIES.md` and `docs/product/ACCEPTANCE-CRITERIA.md`.
- An interactive prototype, `WealthMe_Demo.html` (21 screens, 11 design-review iterations), is referenced by the PRD.
- The research notes are `docs/research/2026-09-26-kpr-indonesia.md`, `docs/research/2026-09-26-pajak-indonesia.md` and `docs/research/2026-09-26-ter-verification.md`.
- **Absent: do not fabricate.** No user interviews, analytics, testimonials, press, customer logos or pricing exist.

## Product Principles

1. **Net worth is the headline.** Every surface should help answer "is our wealth growing, and why?"
2. **Trust through honesty.** Deterministic math, labelled estimates, and no fake states or simulated prices.
3. **Roles define what each person sees and can change.** Privacy inside the family is a feature.
4. **Less to read, more to do.** One decision at a time. Progressive disclosure over dense screens.
5. **Local by default.** Indonesian money habits and obligations (zakat, PPh, KPR, Antam gold) are native, not add-ons.

## Accessibility & Inclusion

- WCAG 2.2 AA:
  - contrast;
  - visible keyboard focus;
  - labelled controls for screen readers;
  - touch targets of at least 44px on mobile.
- Older users: readable type sizes, high contrast, large targets, and no reliance on hover or tiny icons alone.
- Children use the app too. Their roles see simple language and limited actions.
