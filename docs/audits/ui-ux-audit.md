# WealthMe — UI/UX Audit (Impeccable Critique)

**Date:** 2026-10-05
**Scope:** Full-site UI/UX audit of `apps/web` against the 10 dimensions requested: visual hierarchy, typography, spacing/layout, responsive desktop/mobile, accessibility, interaction states, forms & error states, navigation, loading/empty states, cross-page consistency.
**Constraint honored:** No code was changed during this audit. All findings are observation-only.
**Report location:** `docs/audits/ui-ux-audit.md` (this file).

---

## Methodology & Disclosure

This audit combines two evidence sources, run from the main session rather than as isolated dual sub-agents (Assessment A / Assessment B) as Impeccable's strict `critique` protocol normally requires for a single-target run. That protocol is designed for one page/component; this engagement is a **multi-page, custom-structured site audit** per the user's explicit request, with its own 5-part report format (findings/evidence/recommendations/priority/acceptance criteria). This is disclosed per Impeccable's "never silently degrade" principle:

1. **Deterministic detector scan** — `impeccable detect --json` against `apps/web/src/app/(app)` (all authenticated app routes). 384 raw findings (2 `warning`, 382 `advisory`) checked against `DESIGN.md` tokens (typography, spacing, radius, motion).
2. **Live browser verification** — `playwright-cli` session against `localhost:3000` (Chrome extension was not connected; playwright-cli is Impeccable's sanctioned fallback browser tool), authenticated with the repo's own seeded demo account (`demo@wealthme.id`, from `apps/api/prisma/seed.ts`), at both desktop (1440×900) and mobile (390×844) viewports. Pages visited: Beranda, Transaksi, Anggaran, Rekening, Dana, Laporan, Tujuan, IAM/Akses Saya, Splitbill, plus the Tambah Transaksi modal.

Evaluated against Nielsen's 10 Usability Heuristics and the product's own `PRODUCT.md`/`DESIGN.md` commitments (Sora-only typography + DM Mono for numbers, lime `#9CCB3B` accent, bento-grid layout, 10/14/18/999px radius scale, dark forest-gradient hero).

A pre-existing, differently-scoped artifact already lives at `docs/ui-audit/GAP-ANALYSIS.md` (prototype-vs-live gap tracking). This report is independent of it and does not modify it.

---

## 1. Findings by Severity

### P0 — Critical (blocks a core task / data integrity / broken on load)

**P0-1. Mobile bottom navigation becomes fully unreachable while scrolled**

- **Dimension:** Navigation, Responsive (mobile), Interaction states
- **Evidence:** `nav[aria-label="Navigasi mobile"]` — likely `apps/web/src/components/shell/*` (protected foundation path, not inspected further per guardrails). At 390×844 viewport, scrolling down inside the page's inner scroll container triggers `transform: translateY(84px)` to hide the dock. Measured via `getBoundingClientRect()`: hidden state renders at `top:854, bottom:914`, while `window.innerHeight` is `844` — i.e. the dock moves **fully below the viewport**, not just tucked out of view. The 84px hide-offset exceeds the element's own footprint (~60px height + 14px bottom safe-area inset ≈ 74px). Confirmed reproducible: scroll down → dock vanishes entirely except the floating "+" FAB; scroll up → dock returns (`top:772, bottom:832`).
- **Impact:** For as long as a user is scrolled down on any page — which is the normal reading position on long bento pages like Laporan — the Beranda/Transaksi/Laporan links and the "Semua menu" overflow button are **completely inaccessible**. Only the "+" FAB remains reachable. This fails Nielsen #7 (Flexibility/efficiency) and #6 (Recognition over recall) outright: the primary navigation disappears rather than degrading gracefully.
- **Why P0 not P1 (reclassified from earlier working note):** on reflection this is promoted from the initial P1 working assessment — it is reproducible on every long page at the standard iPhone viewport (390×844, one of the most common mobile breakpoints), affects 3 of 4 primary nav destinations plus the overflow menu, and has no visible workaround other than "scroll back up," which a user scanning a long report page will not intuit as the fix.

### P1 — Major (significant usability/consistency damage, workaround exists)

**P1-1. Typography token violation — undeclared font-family**

- **Dimension:** Typography, Consistency
- **Evidence:** Detector `warning` finding — `apps/web/src/app/(app)/masterdata/masterdata.css:112` declares `font-family: Sfmono-Regular`, not present in `DESIGN.md`'s typography scale (Sora for UI text, DM Mono for numerals only).
- **Impact:** Breaks the single-typeface brand commitment; any text rendered in this rule will look inconsistent with the rest of the app, especially on fallback-font systems where Sfmono-Regular isn't installed.

**P1-2. Layout-thrash animation technique**

- **Dimension:** Interaction states, Performance-adjacent UX
- **Evidence:** Detector `warning` finding — `apps/web/src/app/(app)/beranda/_components/beranda.css:413` animates `transition: width`, which forces layout recalculation every frame instead of `transform`/`opacity`.
- **Impact:** On lower-end mobile devices this will visibly jank during the transition, contradicting the "every pixel earns its place" / polished-interaction bar implied by the bento redesign work already done on Beranda.

**P1-3. Repeated console error on every authenticated page load (TanStack Query)**

- **Dimension:** Loading/empty states, System status
- **Evidence:** Live console capture showed a recurring error consistent with a missing `queryFn` on a `useQuery` call, firing on Beranda load and again when opening the Tambah Transaksi modal (7 console errors observed on modal open alone).
- **Impact:** Silent-failure risk (Nielsen #1, Visibility of system status) — if this query backs a real UI section, that section may be failing to load without any user-visible error or empty state. Needs source tracing (not done here — no code was read beyond the CSS/detector evidence already covered by the no-code-change constraint) to confirm whether real data is silently missing anywhere.

**P1-4. Inconsistent money formatting across pages**

- **Dimension:** Consistency, Typography
- **Evidence:** Dana page card values and hero figures did not consistently apply the DM Mono / tabular-numeral treatment that `DESIGN.md` specifies for monetary figures elsewhere (e.g., Beranda hero, Rekening cards render bold tabular figures; some Dana figures appeared in the body typeface).
- **Impact:** Numbers are the single most frequently scanned data type in a finance app; inconsistent treatment undermines scanability and the "every number should look authoritative" brand intent.

**P1-5. Contradictory status language on Tujuan (Goals) page**

- **Dimension:** Visual hierarchy, Forms/error states, Clarity
- **Evidence:** A goal card simultaneously displayed "Perlu perhatian" (needs attention) styling/badge alongside progress framing that read as "On Track" in the same card — i.e. two status signals in conflict, observed live on the Tujuan page.
- **Impact:** Directly violates Nielsen #1 (match between system and real world / visibility of system status) — a user cannot tell at a glance whether a goal is healthy or at risk. Trust-critical in a financial product.

### P2 — Moderate (polish, minor consistency, non-blocking)

**P2-1. Account cards lack strong color differentiation**

- **Dimension:** Visual hierarchy, Consistency
- **Evidence:** On Rekening, multiple bank account cards (BCA, Mandiri, BNI) use the customizable skin system (`AccountCard`, 8 skins/4 patterns per memory) but in the observed live session several adjacent cards read as visually similar, reducing at-a-glance bank differentiation in the horizontal scroller.
- **Impact:** Minor scanability cost; mitigated by the existing per-card skin customization feature, but defaults could be more differentiated out of the box.

**P2-2. Unlabeled IAM access matrix**

- **Dimension:** Accessibility, Forms
- **Evidence:** The IAM/Akses Saya page renders a grid-style access matrix without clear row/column ARIA labeling in the accessibility snapshot (generic grid cells, no discernible `aria-label`/`scope` semantics for screen-reader users to resolve "which permission, for which resource").
- **Impact:** Screen-reader users cannot reliably interpret a permissions matrix — a moderate but concrete accessibility gap (WCAG 1.3.1 Info and Relationships).

**P2-3. Category overflow pattern untested for consistency**

- **Dimension:** Forms, Interaction states
- **Evidence:** The Tambah Transaksi modal's category grid shows 7 presets plus a "Lihat semua" (see all) overflow entry; the expanded/overflow state was not verified against the same visual grid rules (icon size, label truncation) used elsewhere.
- **Impact:** Low risk, flagged for the next verification pass rather than confirmed broken.

**P2-4. No visible required-field indicators in Tambah Transaksi form**

- **Dimension:** Forms and error states
- **Evidence:** In the captured modal screenshot (Pengeluaran tab), "Jumlah" (amount) and "Akun"/"Kategori" selection have no asterisk or "required" microcopy; "Mata uang" and "Deskripsi" are explicitly marked "(opsional)" by contrast, implying the others are required only by omission.
- **Impact:** Minor — the opsional-labeling convention is good practice (Nielsen #5, Error prevention) but is incomplete without the inverse required-marking, so a user only learns a field is mandatory after a failed submit (not verified live — submit/validation state was not reached before the audit's time-box ended).

### P3 — Minor / informational

**P3-1. 382 advisory-level detector findings not yet triaged individually**

- **Evidence:** `impeccable detect --json` on `apps/web/src/app/(app)` returned 384 total findings; 382 are `advisory` severity (below `warning`). Hotspot directories by finding count: `akun` (67), `laporan/_components/sections` (53), `rekonsiliasi` (40), `investasi` (24), `beranda/_components` (20), `laporan` (16), `splitbill` (14), `kalkulator` (13), `donation` (12), `tax/_components` (11), `transaksi` (11), `ai` (10), `dana` (10), `liabilitas` (10), `tax` (9).
- **Recommendation:** Treat as a backlog for a future `impeccable polish` pass per directory, prioritized by hotspot size (`akun` and `laporan` first). Not actioned in this audit (no-code-change constraint + budget).

**P3-2. Next.js/TanStack Query dev-tool overlays are correctly out of scope**

- **Note (not a defect):** The persistent "1 Issue" floating badge and related overlay buttons seen in every screenshot are Next.js Dev Tools + TanStack Query Devtools, confirmed via the accessibility snapshot (`button "Open Next.js Dev Tools"`, `button "Open issues overlay"`, `button "Open Tanstack query devtools"`). These are dev-environment-only chrome, excluded from this report's UX findings about the shipped product — only the underlying console error they surface (P1-3) is treated as a real finding.

---

## 2. Evidence Index

| Finding                            | Route / File                                                        | Evidence type                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| P0-1 Mobile nav off-screen         | `/beranda` (and any long page), mobile 390×844, shell nav component | Live: `getBoundingClientRect()` before/after scroll + screenshots (`mobile-dock.png`, `mobile-dock-reload.png`) |
| P1-1 Sfmono-Regular                | `apps/web/src/app/(app)/masterdata/masterdata.css:112`              | Detector `warning`                                                                                              |
| P1-2 `transition: width`           | `apps/web/src/app/(app)/beranda/_components/beranda.css:413`        | Detector `warning`                                                                                              |
| P1-3 TanStack Query console error  | `/beranda`, Tambah Transaksi modal                                  | Live: `playwright-cli console` output (7 errors on modal open)                                                  |
| P1-4 Money formatting              | `/dana`                                                             | Live screenshot (`dana-desktop.png`)                                                                            |
| P1-5 "Perlu perhatian" vs on-track | `/tujuan`                                                           | Live screenshot (`tujuan-desktop.png`)                                                                          |
| P2-1 Account card differentiation  | `/rekening`                                                         | Live screenshot (`rekening-desktop.png`)                                                                        |
| P2-2 IAM matrix labeling           | `/akses-saya` (or `/iam`)                                           | Live accessibility snapshot                                                                                     |
| P2-3/P2-4 Tambah Transaksi form    | `/beranda` → "Tambah transaksi" modal                               | Live screenshot (`add-transaksi-modal.png`)                                                                     |
| P3-1 Detector hotspots             | `apps/web/src/app/(app)/**`                                         | `impeccable detect --json`, 384 findings, summarized by directory                                               |

Screenshots referenced above were captured to an ephemeral session scratchpad during the audit and are not committed to the repository (no binary assets were added, consistent with the no-code-change constraint). Re-run the live verification steps in this report to regenerate them if a committed evidence set is wanted.

---

## 3. Recommendations

1. **P0-1:** Cap the mobile nav's hide-transform to the element's actual rendered height (or use a measured `offsetHeight` instead of a fixed `84px`), or switch to `opacity`+`pointer-events` with a smaller, bounded translate so the dock never fully exits the viewport. Re-verify at 375×667 and 390×844 after the fix.
2. **P1-1:** Replace `Sfmono-Regular` with the DM Mono numeral token (or Sora, if the element isn't numeric) in `masterdata.css:112`.
3. **P1-2:** Change `transition: width` to `transition: transform` (scale) or `opacity` in `beranda.css:413`.
4. **P1-3:** Trace the `useQuery` call(s) missing a `queryFn` (not identified further here, console-evidence only) and either supply it or confirm the query is dead code to remove.
5. **P1-4:** Audit all monetary value renders app-wide for the DM Mono/tabular-numeral class and apply consistently, starting with Dana.
6. **P1-5:** Resolve the single source of truth for a goal's status (one badge/label system, not two conflicting signals) on Tujuan cards.
7. **P2-1/P2-2/P2-3/P2-4:** Lower-priority polish items — bundle into a future `impeccable polish` pass once P0/P1 are resolved.
8. **P3-1:** Schedule directory-by-directory `impeccable polish` passes starting with `akun` (67 findings) and `laporan/_components/sections` (53 findings).

---

## 4. Priority Summary

| Priority | Count | Items                                                                                                                                                             |
| -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | 1     | Mobile nav fully off-screen while scrolled                                                                                                                        |
| **P1**   | 5     | Sfmono-Regular token violation · `transition: width` layout-thrash · TanStack Query console error · Dana money-format inconsistency · Tujuan contradictory status |
| **P2**   | 4     | Account card differentiation · IAM matrix labeling · category overflow untested · missing required-field indicators                                               |
| **P3**   | 2     | 382 advisory detector findings (backlog) · dev-tool overlay note (informational, no action)                                                                       |

---

## 5. Acceptance Criteria for Next Implementation Pass

**AC-1 (P0-1 fix — mobile nav visibility)**

- Given a user is on any authenticated page at a mobile viewport (375–430px wide)
- When they scroll down past the fold
- Then the bottom navigation dock must remain either fully visible or only partially/intentionally hidden such that at minimum its tap targets stay reachable within one scroll-up gesture, and its hidden-state `transform`/`opacity` must never move the element's bounding box entirely outside `window.innerHeight`.
- Verified by: live `getBoundingClientRect()` check at 390×844 and 375×667 post-scroll, confirming `top < window.innerHeight`.

**AC-2 (P1-1/P1-2 token fixes)**

- Given the detector is re-run after the fix (`impeccable detect --json apps/web/src/app/(app)`)
- Then the two `warning`-severity findings (masterdata.css:112, beranda.css:413) no longer appear.
- Verified by: detector JSON diff, zero `warning`-severity entries remaining.

**AC-3 (P1-3 console error)**

- Given a user loads `/beranda` and opens "Tambah transaksi"
- Then the browser console shows zero errors attributable to a missing `queryFn`.
- Verified by: `playwright-cli console` (or equivalent) showing 0 relevant errors on both page load and modal open.

**AC-4 (P1-4 money formatting)**

- Given any page rendering a monetary value (Beranda, Rekening, Dana, Laporan, Tujuan, Transaksi)
- Then all such values use the same DM Mono/tabular-numeral class as the existing Beranda hero and Rekening cards.
- Verified by: visual diff / shared CSS class audit across the listed pages.

**AC-5 (P1-5 goal status clarity)**

- Given a goal card on `/tujuan`
- Then it shows exactly one unambiguous status signal (e.g., "Perlu perhatian" OR an on-track indicator, never both) derived from a single source of truth in the data model.
- Verified by: manual review of all goal states (on-track, at-risk, completed, overdue) on the live Tujuan page.

**AC-6 (P2-2 IAM accessibility)**

- Given a screen-reader user navigates the access matrix on `/akses-saya`
- Then each cell's row (resource) and column (permission) context is announced (via `aria-label`, `scope`, or table semantics).
- Verified by: accessibility-tree snapshot showing descriptive labels per cell, plus a manual screen-reader pass (VoiceOver/NVDA) if available.

**AC-7 (P2-4 required-field marking)**

- Given the Tambah Transaksi form
- Then every required field is marked consistently (not just optional fields), and attempting submit with a required field empty shows an inline, field-level error message.
- Verified by: live form interaction — clear the amount field, attempt submit, confirm inline error appears without a full-page reload or silent no-op.

---

## Out of Scope / Not Verified This Pass

- Dark mode toggle behavior (DESIGN.md commits to it as a token-driven feature; not exercised live in this session).
- Explicit empty-state testing (e.g., zero search results, empty category list).
- Deeper keyboard-only navigation and focus-visible contrast audits beyond the IAM matrix spot-check.
- Pages not visited live: Anggaran interaction states beyond initial load, Kalkulator, Donation, Pajak & Zakat, Masterdata (file-only evidence via detector), Liabilitas, AI Advisor.
- Root-causing the TanStack Query `queryFn` error in source (would require reading query-definition files beyond what the no-code-change, evidence-gathering scope of this audit covered).

These are reasonable candidates for a follow-up audit session or to fold into the next `impeccable polish`/`audit` pass once P0/P1 items above are resolved.
