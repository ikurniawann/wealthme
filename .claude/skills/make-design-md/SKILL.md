---
name: make-design-md
description: Extract a `docs/design/design.md` spec from an existing implemented UI using its real components, styles, tokens, and theme. Use when asked to capture an existing system, not to invent a system from screenshots.
---

# Make design.md

The build skills (`functional-ui`, `marketing-ui`, `shadcn`) can read `docs/design/design.md` as a project-local spec. This skill writes it when asked and when the system is not already documented. It reads what's there; it doesn't redesign anything.

## When this applies

- The project already has UI shipped: components, a theme/Tailwind config, CSS variables, a token file.
- There's no `docs/design/design.md`, or it is stale and drifted from the code.
- NOT for screenshots or a reference site you're recreating — that's `clone`. This reads the real code that's already in the repo.

## Workflow

1. **Find the source of truth.** Look for it in this order, it's usually one of these:
   - `tailwind.config.*` / `theme` config, `globals.css` / `:root` CSS variables, a `tokens.*` or `theme.*` file.
   - `components.json` (shadcn) and the `components/ui` primitives.
   - Otherwise, the actual components — read the most-used ones and the layout/shell.
2. **Extract the real values, not your defaults.** Pull the literal numbers and hexes the code uses. If spacing clusters on 4/8/12/16, that's the scale — record what's there, don't normalize it to what it "should" be.
   - Type scale (sizes, weights, line-heights, font families)
   - Spacing scale, radius, border, shadow
   - Color tokens (semantic names → values, light/dark if both exist)
   - Recurring components and their variants (button, card, input, dialog, table…)
3. **Note inconsistencies, don't silently fix them.** If two buttons use different radii, the system has drift. Record the dominant value and flag the outlier so the user decides. Don't invent a token that isn't in the code.
4. **Write `docs/design/design.md`** only when the user asks for a durable spec. Keep it concrete and checkable: actual type scale, spacing, radius, color tokens, and recurring components.
5. **Confirm with the user.** Show what you extracted, especially anything ambiguous or drifted, before treating it as canonical.

## The rule

`design.md` here is a mirror of the code, not a wish. Every value in it must trace back to something actually in the repo. If you can't find it, ask — don't fill the gap with a default.

## Keep it lean

Direction, not a rulebook. Read the code, record the system, flag the drift. That's it.
