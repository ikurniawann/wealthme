---
name: marketing-ui
description: Build marketing/landing pages — hero sections, scroll experiences, brand sites. Creativity-first, bespoke, animation-heavy. Use for the marketing surface, NOT product/app UI.
---

# Marketing UI

For the page a visitor scrolls and feels, not operates. Optimize for distinctiveness and a strong first impression.

## Break the default

Your default design choices converge on-distribution: generic fonts, predictable layouts, safe palettes (the cream/serif/terracotta "AI slop" house style). This reads as AI-generated. The goal here is escaping your own defaults, not following a checklist. Commit to one cohesive aesthetic that feels designed for this specific context, and execute it with conviction. Draw from unexpected references (IDE themes, print design, cultural aesthetics) rather than templates.

Known attractors you reach for even when told to be original. Avoid:

- Inter, Roboto, Arial, system font stacks, and Space Grotesk
- Purple gradients on white
- Timid, evenly-distributed palettes (commit to dominant colors with sharp accents)
- Flat solid backgrounds when atmosphere or depth would serve the aesthetic

Process:

- Generate **several full HTML mockups** with explicitly different directions, then pick one. Don't ask for "3 versions" — name each direction or they converge.
- **Fonts carry the page.** One distinctive typeface, used decisively, is the single biggest lever for not looking AI-built.
- `design.md` comes **after** the landing is generated, not before — strict tokens up front kill the creativity that makes a landing page work. Lock it once you've chosen a direction.

## Motion

- Use **GSAP** (timelines, ScrollTrigger: scrub, pin, sequence). This is the scroll-choreography surface.
- **One signature moment per page** (an orchestrated entrance / hero reveal). One scroll-trigger per section, max. Scattered micro-interactions are the vibe-coded tell.
- Transform + opacity only — never animate layout properties (that's where the lag comes from). Respect `prefers-reduced-motion`.

## Real assets, not placeholders

Use an available image/video generation MCP only when the user has authorized it and the tool is installed. Otherwise use user-provided or appropriately licensed assets; if no suitable assets are available, say so rather than inventing a generation result. Do not install or configure external asset services without approval.

## Cloning award-style sites

Use an available SingleFile capture tool for public code structure. If `single-file-cli` is not installed, ask before using `pnpm dlx` to download/run it. Keep captures outside the repository unless the user requested saved references.

## Keep it lean

Direction, not a rulebook. Record durable decisions in `docs/design/` only when useful to the requested deliverable; don't create a lessons backlog by default.
