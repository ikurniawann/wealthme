# WealthMe Prototype UX Polish Reference

This note captures the professional-UX direction applied to the static
prototype, so the same decisions can be ported back to React pages without
guesswork.

## Direction

- Treat `pages/beranda.html` as the dashboard pattern master: primary financial
  state first, then supporting metrics, chart context, recent activity, and
  attention items.
- Keep one obvious primary action per page. Secondary and destructive actions
  should stay available but visually quieter.
- Use Lucide/vector icons for structural UI. Emoji-like glyphs may remain in
  user-entered or picker content, but navigation, lists, stats, and table
  actions should use icons controlled by design tokens.
- Preserve the prototype's teal/navy/gold experiment while keeping contrast
  safe. Light mode uses deep teal CTAs on warm neutral surfaces; dark mode uses
  brighter teal with dark CTA text so controls feel alive without losing
  readability.
- Prefer disclosure over clutter: clickable rows open details; row-level edit
  and delete actions appear only on hover or keyboard focus.
- Sell the product through workflow surfaces, not marketing copy. Key screens
  should include short value signals such as automation, family control,
  privacy, or verification status near the top of the page.
- Mobile finance tables should become card lists when each row has multiple
  meaning-rich fields. Horizontal scrolling is acceptable for secondary tables,
  but transaction review should feel native on phone-sized screens.

## Applied Changes

- Added a skip link and `main-content` target in the shared shell for keyboard
  users.
- Strengthened shared card/button states and focus behavior.
- Standardized list/stat icon chips into circular token-driven treatments.
- Added a shell-level icon normalizer so legacy `.list-row__icon`,
  `.stat__icon`, and `.empty__icon` emoji hosts render as Lucide icons.
- Cleaned the transaction table: icon-based category chips, quieter row actions,
  and clearer header copy.
- Cleaned the account and AI pages where they were most visibly using emoji as
  structural UI.

## Review Checklist

- Desktop: open `index.html`, `pages/beranda.html`, `pages/transaksi.html`,
  `pages/rekening.html`, and `pages/ai.html`.
- Mobile: check 390px width for no horizontal page overflow, readable topbar,
  usable bottom nav, and tappable primary actions.
- Keyboard: tab from the browser top; the skip link should appear and jump to
  page content.
- Reduced motion: animations should be effectively disabled by the shared CSS.
- Dark mode: use the theme toggle and confirm text, icons, borders, and cards
  remain legible.
- Color depth: compare light and dark modes on the same page. Background,
  cards, secondary controls, and active states should each read as distinct
  layers, not one flat tint.
- Document structure: each page should expose one main H1. Repeated chrome
  titles can be visible but should not duplicate the semantic page heading.

## External Design References

- Nielsen Norman Group: usability heuristics, especially visibility of system
  status, consistency, and recognition over recall.
- Material Design 3: navigation, state, density, accessibility, and component
  behavior.
- WCAG 2.2: contrast, keyboard focus, and accessible interactions.
- Apple Human Interface Guidelines: clarity, hierarchy, and subtle depth.
