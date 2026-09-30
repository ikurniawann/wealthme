---
name: WealthMe
description: A practical family Wealth OS with a warm neutral canvas, lime actions, and forest hero surfaces.
colors:
  background: "#ECEDE8"
  foreground: "#15170F"
  card: "#FFFFFF"
  muted: "#666D5F"
  border: "#E2E4DC"
  primary: "#9CCB3B"
  primary-foreground: "#1F2A07"
  primary-soft: "#E4F1C4"
  forest-start: "#1A4B3B"
  forest-end: "#0C2B22"
  dark-background: "#09090A"
  dark-card: "#131314"
  dark-border: "rgba(255,255,255,0.07)"
  dark-foreground: "#F3F3F1"
  success: "#3F8F2F"
  warning: "#F2A247"
  destructive: "#C2462B"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1.05
  title:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  body:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  numeric:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
rounded:
  sm: "10px"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
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

The light canvas is warm and pale, with white working surfaces and lime for selected states and primary actions. Forest gradients mark hero surfaces. Dark mode uses neutral near-black surfaces, fine borders, and lime accents without tinting the canvas green.

**Key Characteristics:**

- Sora is the only interface and chart typeface.
- Money uses tabular Sora numerals; mono is reserved for codes and IDs.
- Each page starts with a dark hero, then an 8/4 bento layout where the content supports it.
- Data appears in compact rows and composition stacks, not primary data tables or donut charts.

## Colors

Warm neutrals carry most of the interface. Lime is the single brand accent. Functional colors communicate status only.

### Named Rules

**The Lime Action Rule.** Use lime for the active state and the primary action. Keep other surfaces neutral.

## Typography

Use Sora at the approved 11, 12, 13, 14, 16, 20, 28, 40, and 52 px steps. Apply tabular numerals to money. Use mono only for codes and IDs.

## Layout

Use a 12-column bento grid with an 8-column main area and a 4-column side area on wide screens. At 901–1439 px, use an icon rail. On phones, use the floating five-position dock and launcher sheet. Keep the hero chart grounded in actual page data; when a time series is unavailable, use a meaningful composition or progress visual.

## Elevation & Depth

Use white cards against the warm canvas with restrained shadows. Dark mode uses #131314 cards on #09090A and a 1px white border at 7% opacity. Avoid green-tinted dark surfaces.

## Shapes

Use 18px card corners, 10–14px control corners, and pill-shaped navigation and buttons. Dialog fields are 54px high with a lime focus ring.

## Components

The shared kit includes dark heroes with KPI columns, bento tiles, compact account rows, mini-lists, composition stacks, right-side detail panels, phone bottom sheets, and undo toasts. Forms use a dark-gradient title area, filled fields, and pill actions.

## Do's and Don'ts

**Do**

- Keep Indonesian copy short and address the user as “kamu”.
- Preserve API data, money arithmetic, currency display, and permission checks.
- Make details editable inline where the page interaction allows it.

**Don't**

- Don't fabricate financial data or filler charts.
- Don't use mono for money, donut charts, or a data table as the primary page surface.
- Don't ask for confirmation before reversible deletes; show an undo action instead.
