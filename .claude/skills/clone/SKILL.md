---
name: clone
description: Reconstruct an existing UI from screenshots or public rendered source, adapting output to the repository's design-doc locations and host tools. Use only when the user asks to match a reference; captures guide a clean implementation, they are not shipped.
---

# Clone

Two modes, by what's being cloned. Apps live behind login (screenshots); public pages don't (real code). Either way the capture is a **reference**, never the shipped output — you rebuild it clean in the project's stack.

## Mode A — App / functional UI (screenshots)

App screens (dashboards, feeds, editors) are behind a login, so they can't be captured as code. The user screenshots them and hands you the files.

0. **Scaffold first.** If needed, create `docs/design/clone/screenshots/`. Keep source captures there only when they are part of the requested deliverable.
1. **Take the files in.** Copy user-provided screenshots into `docs/design/clone/screenshots/`; never move or delete their originals.
2. **Read them one by one.** Note layout, components, typography, color, spacing, and states.
3. **Capture project context** by following `AGENTS.md`, `CLAUDE.md`, and relevant app instructions. Do not create a separate `product.md`.
4. **Write `docs/design/design.md`** only when the user wants a durable design spec; record extracted type, spacing, radius, color tokens, and recurring components.

Then hand off: build with **`functional-ui`** + **`shadcn`** against that design.md.

## Mode B — Landing / marketing page (real code)

Public pages can be captured exactly, so don't screenshot them — get the real rendered code:

Check whether `single-file-cli` is already available. Ask before using `pnpm dlx`
to download/run it; keep captures outside the repository unless the user wants them saved.

```
pnpm dlx single-file-cli <url> out.html
```

One self-contained file: real HTML, CSS, fonts, and images inlined as base64. Exact fonts and colors, not a guess. (Assets are embedded in the file, not separate files — the model reads them in place. If you need image files on disk, extract the data URIs.)

- **Authed pages don't work here** — SingleFile only reaches what's public. If it's gated, it's Mode A (screenshots).
- **Multi-page:** get routes from `sitemap.xml`, capture each, then extract the SHARED system into one `design.md`. Don't clone page-by-page or the pages drift.

Then hand off: build with **`marketing-ui`** (+ **`gsap`** for animation).

## The rule

The capture tells you what to build, not what to ship. Rebuild in the real stack against `design.md` — never serve the scraped markup or a screenshot.
