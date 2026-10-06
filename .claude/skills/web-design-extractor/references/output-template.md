# Output Template — design-system.md

Produce a file with this structure. Adapt section names to the site, but keep the overall shape. The goal: an AI reading this file alone can generate on-brand pages.

````markdown
# Design System — <Site Name> (<domain>)

> Extracted from <page> source on <date>. Source: <stack, e.g. WordPress + Elementor>.
> Visual identity: <one-paragraph vibe summary — dominant colors, mood, what kind of product>.
> This file is written to be fed to an AI to generate new pages/apps in the same style. Tokens note where they're used on the original site.

## 1. Color Palette

### Brand / Global

| Role | Hex | Notes / Usage |

### Backgrounds / Surfaces

| Hex | Usage |

### Accents / Text-on-color

| Hex | Usage |

### Signature Gradients

- <name>: <full gradient> — <where used>

### Palette summary

`<compact list grouped by family>`

## 2. Typography

(Full fonts section per fonts-guide.md: family, full stack, source, all weights, weight→role table, import code.)

### Type scale

| Token | Desktop | Mobile | Usage |

## 3. Spacing & Layout

(container max-widths, gaps, section paddings, column layouts, base unit)

### Container tokens

`<vars>`

## 4. Borders, Radius & Shadows

(radius, shadow approach — flag if minimal, transitions)

## 5. Buttons

(background, size, style, link treatment)

## 6. Components Observed

(hero, feature rows, stat blocks, carousels, footer, nav, etc.)

## 7. Responsive Breakpoints

`<breakpoint list>`
(what changes at each)

## 8. Style Direction (for AI generation)

Numbered, concrete do/don't principles for cloning the look.

### Copy-paste CSS variables

```css
:root {
  /* all key tokens as variables */
}
```
````

```

## Rules
- Fill tables with REAL values from source; never placeholders.
- Mark low-confidence/missing data explicitly (e.g. "shadows: none observed", "weights inferred").
- Keep the visual-identity summary punchy and accurate — it anchors the AI's generation.
- The `:root` block and the Style Direction section are the two most useful parts for downstream generation; make them strong.
```
