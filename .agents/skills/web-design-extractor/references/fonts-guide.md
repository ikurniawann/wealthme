# Fonts Extraction Guide

Fonts are the #1 under-extracted part of a design system. A generated page with the right colors but the wrong font looks nothing like the source. Be thorough.

## Where fonts live in source

1. **Web font loaders (highest priority)** — look for:
   - `<link href="https://fonts.googleapis.com/css2?family=...">` (Google Fonts). The `family=` param lists the family AND the loaded weights, e.g. `family=Lexend:wght@100;200;300;400;500;600;700;800;900`.
   - `@import url('https://fonts.googleapis.com/...')` in CSS.
   - `@font-face { font-family: ...; src: url(...) }` (self-hosted). Each block = one family/weight/style.
   - Adobe Fonts/Typekit: `<link rel="stylesheet" href="https://use.typekit.net/xxxx.css">`.
2. **`font-family` declarations** — confirms the active family + the full fallback stack, and reveals secondary fonts.
3. **CSS variables** — `--font-...`, `--e-global-typography-*` (Elementor), theme tokens.
4. **Inline styles / framework configs** — sometimes weights are set per-element (`font-weight: 600`).

## What to extract (the complete fonts section)

- **Primary family** (the brand text font).
- **Full fallback stack.** If the source only says `sans-serif`, upgrade to a robust stack so generated pages degrade gracefully:
  `"<Primary>", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **All loaded weights**, listed individually with names (400 Regular, 600 SemiBold, ...). Don't collapse to "100–900".
- **Weight → role mapping** — scan `font-weight` usage: which weight is body, which is headings/emphasis. This is what makes a clone feel right.
- **Source & load strategy** — Google Fonts / Adobe / self-hosted; `display=swap`?
- **Loader code** — give ready-to-paste `<link>` (with preconnect) and `@import` forms so any generated page actually loads the font.
- **Secondary/display fonts** — if a distinct heading or display face exists, capture it the same way.

## What to EXCLUDE (or clearly label as non-typography)

- **Icon fonts** — `eicons` (Elementor), `FontAwesome`/`fa`, `Material Icons`, `dashicons`. These render glyphs, not text. Exclude from brand typography (mention separately if relevant).
- **Incidental mono fallbacks** — e.g. `"Courier New", Courier, monospace` appearing only on `code` elements. Label as "code/mono fallback only," not a brand font.
- **System-only stacks** with no custom font (`-apple-system, ...`) — note the site uses system fonts rather than inventing a brand font.

## Output snippet shape

```markdown
## Typography — Fonts

### Family

- Primary: <Name>
- Full stack: "<Name>", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- Source: Google Fonts (display=swap)
- Mono (code only): "Courier New", Courier, monospace
- Icon font (not typography): <eicons / fa / ...>

### Loaded weights

100 Thin · 200 ExtraLight · 300 Light · 400 Regular · 500 Medium · 600 SemiBold · 700 Bold · 800 ExtraBold · 900 Black

### Weight usage

| Weight | Used for                          |
| ------ | --------------------------------- |
| 400    | body, paragraphs, captions        |
| 600    | headings, large numbers, emphasis |

### Import code

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=<Name>:wght@...&display=swap" rel="stylesheet">

@import url('https://fonts.googleapis.com/css2?family=<Name>:wght@...&display=swap');
```

## Confidence

If weights are loaded but you can't tell which are actually used (no per-element `font-weight` in the source), say so: "all weights loaded; usage inferred." Never assert a weight mapping you didn't see evidence for.
