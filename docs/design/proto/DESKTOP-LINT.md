# Desktop layout lint (v2.1) — the user says most desktop pages still look messy

Exemplars: anggaran.html, rekening.html, index.html. Match their discipline. Keep all logic/features; change layout only.

Check each page at 1440x900, 1280x800 and 1024x768 (screenshots) and fix:

1. No dead space: no card may be more than ~25% empty inside. Do not let a short card stretch next to a tall one.
   Rebalance with explicit placement (`@media (min-width:1181px)` grid-column/grid-row per area): stack two short
   cards in one column, move a card up, or give the tall card the wide slot. Bottoms of the last row line up.
2. Every card column is intentional: main column 1/9 (8 cols) + side column 9/13 (4 cols). No orphan column,
   no card spanning 12 cols unless it is a full-width table/list. No empty right column.
3. Hero chart must show real data (a time series, per-item comparison or composition). If the page has none,
   use a meaningful visual instead (composition strip, progress track, key figure grid) — never filler bars
   such as "members count" or "profile steps 1..5".
4. Hero head: max one number + caption on the left and at most 2 controls on the right. Filters beyond that go to
   the list card they filter. Nothing may overlap the KPI column.
5. Data tables as primary UI become rows like rekening.html `.arow` (badge, name + meta, share track, amount).
   Tables are allowed only inside a detail side panel.
6. Consistent card heads: h2 + one-line `.cap`, one action button (`.ghost-btn`) on the right. No stray inline styles.
7. Type scale: hero `.big`, card numbers `.mid` or `.pv`, rows 13.5px. Sora tabular numbers everywhere (no mono for money).
8. 721-1180px: two clean columns or single column; no overlaps. 390px unchanged unless broken.
   Verify: `node _shot.cjs page.html` (no errors/overflow) + look at the 1440 shot once, fix once more at most.
