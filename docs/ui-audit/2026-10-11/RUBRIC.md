# WealthMe UI/UX review rubric (per route)

You review screenshots of the LIVE app (https://wealthme.demo-wit.id) captured by a crawler at three
viewports: desktop 1440x900, tablet 834x1112, mobile 390x844. Every screenshot is one state: the page,
scrolled stops ("page scroll N"), each tab/select option, every dialog/menu/sheet the crawler could open
("<label> dialog open"), the dialog after an empty submit ("validation"), after sample data was typed
("filled") and, on desktop, after submit ("submitted"). A manifest row per shot carries cheap metrics:
`overflowX` (px of horizontal page overflow), `tinyText` (text nodes under 11px), `smallTargets`
(mobile tap targets under 36px), `offscreen` (elements cut by the right edge), `errors` (console).

Design intent (what "berkarakter" means here): forest-green dark sidebar/hero cards, lime accent, light
sage background, white cards with 26px radius, no drop shadows, fluid clamp() type, bento layout; mobile
dock with labelled columns and a ring "+" button. Dialogs: prototype `.dialog` (bottom sheet ≤768px).
Currency is the account setting (EUR for the demo user) — "≈ €" values are correct, hardcoded "Rp"
labels/chips next to € values are defects.

Judge each viewport on three axes, 1–5 each:

- **Karakter** — does it look like a deliberate WealthMe design or a generic template / unfinished port?
- **Konsistensi** — same spacing/radius/type/colour/button system as other cards, pages and dialogs?
- **Kerapian** — alignment, truncation, overflow, orphaned labels, empty space, crowded rows, clipped
  charts, broken grids, dialogs that fit the viewport, forms that read well filled and in error.

Also check **data honesty**: numbers that contradict each other on one screen, empty-state copy shown
where data clearly exists (e.g. "Belum ada transaksi" while another card lists a transaction), labels
that promise something the control does not do, loading states rendered as empty states.

Report defects, not praise. For each defect:
`- [P0|P1|P2|P3] <viewport(s)> <file name> — <what is wrong, one sentence> → <what it should be>`
P0 = broken/unusable or data contradiction; P1 = clearly sloppy, user would notice; P2 = polish;
P3 = nit. Be concrete (which element, which text). Do not invent defects you cannot see in a shot.
Skip the crawler's own artefacts: dark mode switched by a "Ganti tema" click, sample text "Audit QA n",
amount 1.250.000, leftover "Ekspor selesai" toasts.

Output format (markdown, nothing else):

```
## <route>
Scores: desktop K/K/K · tablet K/K/K · mobile K/K/K   (Karakter/Konsistensi/Kerapian)
Verdict: <one sentence>
### Defects
- [P1] mobile 003-....png — ...
### Dialogs & forms seen
- <dialog name>: <ok | issues in one line>
### Not reachable
- <what the crawler did not manage to open, if evident>
```
