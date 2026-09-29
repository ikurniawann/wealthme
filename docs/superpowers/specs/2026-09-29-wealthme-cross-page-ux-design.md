# WealthMe cross-page UX and form consistency

**Status:** design for review
**Date:** 2026-09-29
**Requested outcome:** improve the authenticated WealthMe experience across pages and input forms, with economical scope and an intended five-hour implementation timebox.

## 1. User and product intent

WealthMe is a shared Indonesian household wealth system used by adults, older family members, and children with different roles. Its interface should make financial state and next actions easy to understand on both phones and desktop. It should feel calm, accurate, and trustworthy, with concise Indonesian copy and a restrained teal, navy, and gold palette.

Success means financial controls describe the data they actually change; users can reach the main content and form actions without excessive scrolling; form labels, optional state, validation, and errors are clear; and mobile interactions remain usable with touch and assistive technology.

## 2. Existing evidence

- A Codex browser review inspected 28 authenticated route pages and representative 390px screens for Beranda, Transaksi, Ringkasan, Laporan, Anggaran, and Akun.
- The Beranda 6/12 month toggle changes the card title although the cashflow series is fixed at six months; the same toggle is tied to net-worth history.
- On a 390px screen, Transaksi stacks three summary cards before its list, and the Akun profile action overlaps the identity content.
- Transaction and liability dialogs use the existing responsive form and fieldset patterns; these should be retained where they already work.
- Tax Center places several summary sections before its calculator. Other complex input flows include reconciliation, investment, insurance, donation, goal, budget, and family-role setup.
- The route-folder Impeccable detector reported 417 font-size advisories, 32 color advisories, and one side-tab warning. This is a review queue, not a mandate for mechanical edits.
- The current design system and form classes already exist. The repo protects shared foundation files.

## 3. Recommended approach

Make focused, route-level changes in short workstreams using existing design tokens, `.field`, `.input`, `.select`, `.textarea`, `.error-text`, Base UI dialogs, and current page-local patterns. Fix evidence-backed usability problems first, then audit the primary forms and correct concrete accessibility, clipping, label, hierarchy, or validation problems. Do not perform a blanket rewrite of all detector advisories.

This avoids a global component migration, keeps the requested time economical, and lets each change be verified against the real page and form.

### Alternatives considered

1. **Route-by-route visual polish only:** fast per page, but likely to leave form behavior and shared interaction patterns inconsistent.
2. **Foundation redesign first:** could create broader consistency, but touches protected shared files and creates regression risk before high-impact page problems are resolved.
3. **Focused page and form pass with existing patterns (recommended):** resolves the observed problems, audits primary forms, and limits shared-foundation changes to a separately justified exception.

## 4. Workstreams

### A. Data truth and control placement

Move or relabel the 6/12 month control so it clearly controls net-worth history and does not change the fixed six-month cashflow title. Keep cashflow data and its labels truthful without adding API behavior.

### B. Mobile hierarchy

- Reduce the vertical cost of the three Transaksi summary metrics while keeping full amounts and meanings available.
- Reflow the Akun profile header so its action never overlays identity details.
- Review the first viewport of Beranda, Ringkasan, Laporan, Anggaran, and Tax Center for content order, clipping, and access to the primary action.

### C. Input and form quality

Review the main create/edit/input flows across transaction, account, asset, investment, liability/KPR, insurance, budget, goal, donation/tax, reconciliation, Split Bill, IAM, and Master Data. Fix concrete issues with:

- explicit labels, required/optional markers, and concise single-line help;
- inline field errors with accessible associations and business-safe messages;
- clear form grouping and progressive disclosure for conditional fields;
- keyboard operation and touch targets of at least 44px for coarse pointers;
- reachable submit/cancel actions on small screens, with no obscured or accidental destructive action.

Preserve existing behavior and defer backend/API changes unless a proven UX defect cannot be fixed at the web layer. Money input and display must keep current decimal-string/BigInt and `useMoney()` rules.

### D. Cross-page visual consistency

Review high-visibility detector findings against screenshots and `DESIGN.md`. Use existing tokens and classes for route-level fixes. Keep gold as a rare accent, financial figures in DM Mono, and theme colors token-driven. Ignore intentional small-type exceptions unless they are unreadable or fail contrast/touch checks.

## 5. Scope and guardrails

- Scope is the 28 authenticated route pages reviewed, including representative modal and inline forms. Public auth/legal pages and the dynamic `/aset/[id]` detail are outside this pass unless directly needed by a shared flow.
- Do not edit API, Prisma schema, migrations, contracts, generated `dist`, environment files, production or staging data.
- Do not edit `globals.css`, `design-system.css`, `lib/*`, `components/ui/*`, `components/wm/*`, `components/charts/*`, `components/shell/*`, `layout.tsx`, or `packages/config/*` unless a concrete cross-page defect cannot be fixed in route code. If such an exception is required, document the exact reason in that commit.
- All new copy goes in Indonesian and English i18n files. Use polite conversational “kamu”, avoid em dashes and decorative middle dots, keep helpers to one line, and mark optional fields with “(opsional)”.
- Keep changes scoped and preserve existing user-local edits. Stage explicit file paths only.
- Use focused test-first changes for behavior defects, and do not add tests that only snapshot implementation details.

## 6. Acceptance criteria

1. The Beranda period control cannot present a 12-month cashflow title over six-month data, and its accessible name matches the chart it controls.
2. At 390px, Transaksi exposes its list/action without three full-height metric cards pushing it below the first viewport; all three totals remain understandable.
3. At 390px, the Akun profile action and identity text do not overlap at common name/email lengths.
4. Every audited primary form has an associated label for each control, clear optional state, field-level business errors where validation exists, and reachable submit/cancel actions.
5. Conditional forms show only relevant fields and expose those changes to keyboard and screen-reader users.
6. Controls used by touch meet the 44px minimum at coarse pointers; keyboard focus and error states remain visible in light and dark themes.
7. Money amounts, API error handling, role permissions, and existing business logic are not weakened by visual changes.
8. No planned change requires API or database work. Any protected-file exception is stated in its commit body.
9. Visual review covers 390px and 1440px in light and dark themes for changed routes, plus at least one representative long form and one conditional form.
10. Required web tests, TypeScript, ESLint, and repository QA gates pass; report any gate that cannot be completed within the timebox with its exact reason.

## 7. Delivery and timebox

Plan implementation as reviewable workstream commits with explicit staging paths and Conventional Commit subjects. Aim to complete the accepted scope within five hours. If the timebox is reached, finish verification for the highest-priority work already changed and clearly list remaining work rather than hiding or silently expanding the scope.

No implementation starts until this design and its implementation plan have both been reviewed as required by the project workflow.
