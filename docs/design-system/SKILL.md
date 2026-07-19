---
name: wealthme-design
description: Use this skill to generate well-branded interfaces and assets for WealthMe (Personal Wealth OS — a personal & family FinOps app, Bahasa Indonesia, Rupiah), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference

- **Tokens:** link `styles.css` (imports `tokens/*`). Brand indigo `--primary #4F46E5`; semantics success/warning/destructive; fixed `--chart-1..5` ramp; six `data-theme` presets; full `.dark`.
- **Type:** Sora (UI/display, 300–800) + DM Mono (money/IDs, tabular). Dense scale — most UI 10.5–15px, hero numbers 28px/800.
- **Components:** load `_ds_bundle.js`, read from `window.<Namespace>` (run `check_design_system` for the namespace). Core/forms/surfaces/charts groups — see each `*.prompt.md`.
- **Voice:** Bahasa Indonesia, informal "kamu"; Rupiah `Rp 1.250.000` / compact `Rp 25,85 jt`; emoji only as category glyphs; ▲/▼ deltas in green/red.
- **Icons:** Lucide, 1.75px stroke (CDN). Logo = indigo "W" mark + "Wealth**Me**" wordmark in `assets/`.
- **UI kit:** `ui_kits/wealthme-app/` is a full interactive recreation to copy patterns from.
