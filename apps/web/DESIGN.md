---
name: WealthMe
description: A practical family Wealth OS with a warm neutral canvas, forest commit actions, lime active states, and forest hero surfaces.
colors:
  background: "#ECEDE8"
  foreground: "#15170F"
  card: "#FFFFFF"
  muted: "#666D5F"
  border: "#E2E4DC"
  primary: "#9CCB3B"
  primary-foreground: "#1F2A07"
  primary-soft: "#E4F1C4"
  commit: "#11382C"
  commit-foreground: "#EEF0E8"
  forest-start: "#1A4B3B"
  forest-end: "#0C2B22"
  dark-background: "#09090A"
  dark-card: "#131314"
  dark-border: "rgba(255,255,255,0.07)"
  dark-foreground: "#F3F3F1"
  success: "#2F7524"
  warning: "#F2A247"
  destructive: "#C2462B"
  commit: "#11382C"
  commit-foreground: "#EEF0E8"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1.05
  hero-figure:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  lead:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  body:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  control:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  micro:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  numeric:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
rounded:
  sm: "10px"
  control: "12px"
  md: "14px"
  lg: "18px"
  full: "999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.commit}"
    textColor: "{colors.commit-foreground}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
  dark-hero:
    backgroundColor: "linear-gradient(135deg, {colors.forest-start}, {colors.forest-end})"
    textColor: "#EEF0E8"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: WealthMe

## Overview

**Creative North Star: The Family Wealth Board.** The interface makes a household's financial picture easy to scan and act on. Real data leads; the layout uses a bento grid, compact rows, and short Indonesian copy. This is an operating surface, so clarity and direct actions shape every screen.

The light canvas is warm and pale, with white working surfaces, forest for the commit action, and lime for active and selected states. Forest gradients mark hero surfaces. Dark mode uses neutral near-black surfaces, fine borders, and lime accents without tinting the canvas green.

**Key Characteristics:**

- Sora is the only interface and chart typeface.
- Money uses tabular Sora numerals; mono is reserved for codes and IDs.
- Each page starts with a dark hero, then an 8/4 bento layout where the content supports it.
- Data appears in compact rows and composition stacks, not primary data tables or donut charts.

## Colors

Warm neutrals carry most of the interface. Forest commits: it fills the primary action (#11382C, #1A4B3B on hover) and the hero surfaces. Lime is the active-state accent: it marks the selected nav item, tab, segment, chip, the active dock position, the unread dot, the current step, and focus accents. Functional colors communicate status only. In dark mode forest has no contrast on the near-black canvas, so the commit action inverts to a lime fill with dark ink.

The commit fill is a themable token, `--commit` (with `--commit-foreground`, `--commit-hover`, `--commit-pressed`), consumed by `.btn--primary`, `.wm-add`, primary `.wm-pill`, lit `.wm-ghost-btn`, and the dialog footer action. Default light = forest #11382C with #EEF0E8 ink; dark = lime #C6E48C with #10160A ink. Each `[data-theme]` preset (emerald, rose, amber, violet, slate) sets `--commit` to its `--primary-strong` in light (ink #EEF0E8) and to its 400-level tint in dark (ink #10160A), all at least 4.5:1. Hero and cover gradients stay fixed forest; they are brand chrome, not commit controls.

### Named Rules

**The Lime Active Rule.** Lime marks active or selected state. Forest commits. Everything else stays neutral, and lime is never text on a light surface.

**The Semantic Ramp.** Meaning, not hue, picks the colour, and each meaning keeps one tone on every screen.

- Pemasukan: lime family on dark surfaces and the forest hero (`--wm-lime`), deepened lime `--viz-2` on light cards (3.4:1 on white); as text, `--wm-good`.
- Pengeluaran: one ink-graphite tone, `EXPENSE_COLOR` in `lib/viz-colors.ts` (the surface's `--cstrong` at 72% over `--cbg`); 7.2:1 on the white card, 9.0:1 on the dark card, 6.5:1 on the forest hero. Never amber or red.
- Amber (`--warning`, `--viz-3`) means only a due-soon installment or a budget under pressure or over its limit.
- Red (`--destructive`, `--wm-bad`) means only an overdue installment or a negative balance. A loan being repaid is progress and fills lime, not red.
- Success green text on `--success-soft` (#DCEFD4 light, a green tint distinct from lime-soft) marks settled or healthy; badge text is at least 4.7:1.
- Neutral ink on the ghost tint (`StatusBadge variant="info"`, `.notice--info`) marks information and categories. The notification "Baru" pill is neutral with a lime unread dot, never a lime fill.
- Progress colour is a secondary cue: pair it with text (for example a goal's "Sesuai rencana", "Terlambat", "Selesai").

## Typography

Use Sora at the approved 11, 12, 13, 14, 16, 20, 28, 40, and 52 px steps: 11 for micro labels, 12 for labels and captions, 13 for compact controls, 14 for body, 16 for lead text and compact KPIs, 20 for titles, 28 for headline figures, 40 for hero figures, 52 for display. Apply tabular numerals to money. Use mono only for codes and IDs.

## Layout

Use a 12-column bento grid with an 8-column main area and a 4-column side area on wide screens. At 901–1439 px, use an icon rail. On phones, use the floating five-position dock and launcher sheet. Keep the hero chart grounded in actual page data; when a time series is unavailable, use a meaningful composition or progress visual.

## Elevation & Depth

Use white cards against the warm canvas with restrained shadows. Dark mode uses #131314 cards on #09090A and a 1px white border at 7% opacity. Avoid green-tinted dark surfaces.

## Shapes

Use 18px card corners, 10–14px control corners, and pill-shaped navigation and buttons. Dialog fields are 54px high with a lime focus ring (focus accents are an active-state use of lime).

## Components

The shared kit includes dark heroes with KPI columns, bento tiles, compact account rows, mini-lists, composition stacks, right-side detail panels, phone bottom sheets, and undo toasts. Forms use a dark-gradient title area, filled fields, and pill actions. The commit button is forest (#11382C) with light ink and moves to #1A4B3B on hover and #0C2B22 when pressed; its disabled fill is a muted forest (#3F6B64). On a forest hero the page's own create action inverts to a pale fill with forest ink, and every other hero action is a ghost button. Notification and account tiles are neutral; colour appears only for status (warning for budget pressure and due dates) and for the per-account card skins, which default to forest, midnight, graphite, sky, lilac, coral, or sand, never lime.

## Do's and Don'ts

**Do**

- Keep Indonesian copy short and address the user as “kamu”.
- Preserve API data, money arithmetic, currency display, and permission checks.
- Make details editable inline where the page interaction allows it.
- Give each screen one forest commit action; mark the active nav item, tab, segment, chip, and dock position with lime.

**Don't**

- Don't fabricate financial data or filler charts.
- Don't use mono for money, donut charts, or a data table as the primary page surface.
- Don't ask for confirmation before reversible deletes; show an undo action instead.
- Don't fill a button, card, badge, avatar, or icon tile with lime unless it marks active or selected state.
- Don't use lime as text on a light surface (#9CCB3B on white is about 1.9:1); links use forest with an underline on hover.
- Don't use `text-primary` expecting lime; it resolves to `--primary-strong`. Use `bg-primary` / `--primary` for lime fills (active state only).
- Don't hardcode forest (#11382C) or lime on a commit control; use `--commit` / `--commit-foreground` so colour presets apply.
- Don't show two forest-filled buttons in one screen region; demote the secondary action to a ghost or outline button.
