---
name: functional-ui
description: Build product/app UI — dashboards, feeds, forms, settings, app shells, tables. Consistency-first, component-driven, plan-before-style. Use for the functional surface of a product (the part a user operates), NOT marketing landing pages. Covers planning with styled HTML mocks, testing UI variations, shadcn components, and design.md system specs.
---

# Functional UI

The product surface: screens a user operates, not a page they scroll. Optimize for clarity, consistency, and real states over wow. The hard part here is **planning**, not pixels — get the structure right first.

## design.md rule (read first)

- **If `docs/design/design.md` exists → build against it.** It's the system; stay consistent with it. Don't redefine it.
- **If it doesn't → fine.** Proceed, and optionally ask the user whether to create one there. One design specification per project.
- **The design spec is intent, not the interface.** It records tokens and rules; it is not the rendered app. When the app already exists, code remains the source of truth.

## Ground in the real app — do this first, it is not optional

**This is the step that gets skipped, and skipping it is why builds ignore the existing shell.** `AGENTS.md`/`CLAUDE.md` are project instructions, and `docs/design/design.md` records visual tokens; neither substitutes for reading the real UI. Before mockups, inspect the shell and route-specific code.

**A screen inside an app is not a standalone page.** It renders _inside the existing shell_ — the sidebar, the top bar, the nav. Your mock must include that real shell, cloned from the actual components, not your new content floating on a blank page. If your mock doesn't have the sidebar the app has, you didn't ground it.

Required reads — find the real files in the repo (search for them, don't guess paths):

- **The app shell / root layout** — the persistent chrome: sidebar, top bar, nav. Your new screen lives inside it.
- **The global token source** — `globals.css` / theme config, resolved values, not just names.
- **The closest existing screen** to what you're building — clone its real structure, classes, and components.
- **The real assets and primitives** — the icon library (e.g. Phosphor, Lucide), the logo file, the fonts. Find which icon set the app uses and the exact icon names on the screen you're cloning.

**Clone one-to-one — no substitutes.** Tokens are not fidelity. Matching the colors while using emoji for icons, a coloured box for the logo, or a hand-rolled approximation of the sidebar is not a clone — it reads as fake and the user will reject it. Use the app's **actual icon set** (same library, same icon names), the **actual logo asset**, the **actual fonts**, and the **actual component markup/classes**. If the app renders a sidebar item with a Phosphor icon, your mock renders the same Phosphor icon — not 🛍️. When you can't load a real asset in a static mock, reproduce it faithfully (an `<img>` to the real logo path, the icon library's CDN), never a placeholder glyph.

**Gate: before you mock, state what you found** — name the shell file, the sidebar/nav component, the existing screen you're cloning, _and the icon set + logo asset_. Can't name them? You haven't read the app. Go back and read it. Do this on every task; a fresh session starts with none of it.

**Be selective.** Clone only the screens structurally related to the feature. Adding a store: clone the app shell, the sidebar, and the landing page. Leave the community section alone — it has nothing to do with the store. Cloning unrelated surfaces drags their structure where it doesn't belong.

**Code wins.** `design.md` is necessary but not sufficient. On any conflict between the spec and the code, the code is right.

(This is for _extending_ an existing app. A deliberate redesign that breaks from the current look is the opposite case — don't clone what you're replacing.)

## Workflow (the spine)

1. **Context** — read `AGENTS.md`, `CLAUDE.md`, and the relevant app-level instructions for project intent and conventions. Do not create a separate product-context file unless asked.
2. **Ground in the real app** (if it already exists) — **mandatory before mocking, every task.** Open the app shell, the token source, and the closest existing screen, then name them before you build. Your screen renders inside the existing sidebar/shell — include it, cloned from the real components. See the section below; do not skip it because design.md exists.
3. **Mock it** — when a mock is useful for the requested task, create a styled HTML mock under `docs/design/mocks/` with real layout, hierarchy, copy, icons, and assets. Settle structure, flow, and look here; don't build a parallel product or change protected foundations to support the mock.
4. **Default to one direction.** Commit to the strongest layout and build that single mock. Only branch into multiple variations when the user asks for options or signals uncertainty (see below).
5. **Get approval** — present the mock/direction to the user and wait for sign-off before building real code. The design direction is the user's decision.
6. **Spec** — if the user wants a durable design spec, distil the chosen direction into `docs/design/design.md` (type scale, spacing, radius, color tokens).
7. **Build** — apply the `shadcn` skill to rebuild the approved mock as real components, themed from design.md. The mock was the blueprint; you don't ship the HTML.
8. **Real states** — populated, empty, loading, error. Not just the happy path.
9. **Verify** — use an available focused reviewer. Claude Code may use an available subagent; Codex reviews in its primary session unless an actual Codex subagent is available. Never claim unavailable delegation.

## Planning first (the important part)

Functional UI lives or dies on structure. The HTML mock _is_ the planning tool — don't reach for Figma or a canvas; HTML renders instantly, it's already code, no handoff. Get the layout and hierarchy right, but build it styled — the mock should read as the real product, not a grayscale skeleton. Iterate on the one you settled on.

## Exploring variations ("3 ways to show X")

**Don't do this by default.** Pick the best direction and build one mock. Generate multiple versions ONLY when the user explicitly asks for options ("show me a few ways", "give me 3 variations") or shows real uncertainty about the layout ("not sure how this should look", "what are my options"). If they described what they want, build that — don't manufacture choices they didn't ask for.

When variations _are_ warranted (e.g. "3 ways to show a community home-feed"):

- Generate one HTML file per requested direction under `docs/design/mocks/`: `feed-a.html`, `feed-b.html`, `feed-c.html`. The primary session can produce these; don't spawn subagents for simple alternatives.
- **Assign each an explicit, distinct direction** (dense/information-first vs card/visual-first vs conversation-first). If you just say "make 3 versions," they converge — the variation must come from the instruction.
- View them together with the bundled gallery script. Claude Code: `python3 .claude/skills/functional-ui/scripts/gallery.py docs/design/mocks/*.html --open`; Codex CLI: `python3 .agents/skills/functional-ui/scripts/gallery.py docs/design/mocks/*.html --open`. Ask before running scripts that open a browser or install dependencies.

## Flows vs variations (pick the right viewer)

Multiple HTML files mean one of two completely different things, and they don't get presented the same way:

- **Variations** — alternative takes on the _same_ screen (3 ways to show one feed). They're competing options; you compare them and pick one. → `gallery.py`, side by side.
- **A connected flow** — distinct screens a user moves through are one prototype, not competing variants. If useful for the task, create a linked `docs/design/mocks/index.html` and wire only the key interactions with fake in-memory data. Avoid real backend, auth, production logic, or extra files unless requested.

**Do not open a flow in the gallery.** Lining up sequential screens as if they were variants hides the only thing that matters in a flow — whether it connects and the steps follow. If the screens link to each other, it's a flow; build the interactive index. If they're swappable, it's variations; use the gallery.

Keep it a prototype, not the real app: wire the interactions that prove the flow works, with fake in-memory data. No backend, no real auth, no production logic. It's still throwaway.

### Inside an existing app: build ONE clone, not scattered pages

When the flow lives inside an app that already has a shell, do **not** spread it across N standalone HTML files (`store.html`, `cart.html`, `admin.html`…). Each separate file re-invents the chrome, and they drift apart the moment you touch one — you end up patching the same sidebar five times and it's never consistent. That scatter is the single biggest time-sink; avoid it from the start.

Instead build **one `app.html` that clones the real app**: the genuine shell (cloned per "Ground in the real app" — real sidebar, topbar, logo, icons), a small client-side **hash router** that swaps the view, **shared state** (cart, auth, selection) in `localStorage` so it persists as you navigate, and an **auth/role switch** so one file demonstrates every state (logged-out / free / member / admin). Build the new feature as a real surface inside it; render the _other_ existing surfaces (Library, Channels, etc.) as light stubs so the nav is whole and clickable. You navigate it like the actual product, not by opening files from a menu.

Separate files + an `index.html` hub are only right for a **greenfield/standalone** flow with no existing app shell to clone. If there's a shell, clone the app.

## Build for every role, not just one

A flow usually serves more than one kind of user, and they don't see the same product. A store has a **buyer** (browse → product → cart → checkout → purchases) and an **admin/seller** (create product → edit → publish → manage). Mocking only the buyer path leaves half the feature unbuilt — which is the trap of mocking "pages" instead of the whole product.

- **List every role the feature touches before mocking** — admin vs end user, viewer vs editor, owner vs member. Build the flow for each.
- Give the hub a **per-role entry point** ("View as buyer" / "View as admin") so each path is walkable on its own.
- Roles share the shell but diverge in nav, permissions, and available actions. Clone the **real role-gating** from the app — don't surface an admin action to a plain user, and don't invent permissions the code doesn't have.

## Components

After the mock is approved, **apply the `shadcn` skill** to build the real thing. Map the mock onto shadcn primitives (button, card, dialog, dropdown, table, form) rather than re-styling raw HTML, and apply the design.md tokens to the shadcn theme so every component inherits the system. Don't hand-roll components you can pull.

## Real states

A demo shows the happy path; a product shows all four: **populated, empty, loading, error.** Build them. Empty and error states are where AI builds fall short and where real products feel real.

## Motion

Functional UI uses **Framer Motion** (the `motion` library) for animation. It is state-driven: things animate because state changed. GSAP is NOT used here — that's the marketing surface.

**Default to no animation.** A minimal product UI looks worse, not better, when everything moves. Add motion only where it does a job.

Animate ONLY:

- State feedback — modal/drawer open, toast, expand/collapse, item added/removed.
- Spatial continuity — a list reorder, an item moving to a new position (layout animation).
- A single, subtle entrance on first load if it earns it.

Do NOT animate:

- Static layout, text, headings, cards just sitting there.
- Every element on the page (staggered everything = the vibe-coded tell).
- Decorative motion with no meaning. If you can't name what it communicates, cut it.

Rules:

- Short and quiet: 150–250ms, ease-out. Consistent timing tokens.
- Transform + opacity only — never animate layout properties.
- One thing moving at a time. No competing animations.
- Respect `prefers-reduced-motion`.

## Project folder

```
docs/design/
  mocks/        task-specific HTML mockups (persist only when useful to the requested deliverable)
  design.md     optional visual-system spec, created only when requested or approved
```

## Keep it lean

Direction, not a rulebook. Over-prescriptive instructions degrade the model — this file stays short on purpose.
