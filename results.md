# Task loop results

## 2026-10-05 — WealthMe Arc UI shared component map (Batch 0, Task 1)

- Checks: `.superpowers/sdd/2026-10-05-uiarc-batch-0-inventory-spike/task-1-brief.md`
- Round: 1/2
- Result: PASS
- Change: `docs/architecture/uiarc-component-map.md` maps all 65 production source
  files from `ui/`, `wm/`, `shell/`, and `charts/` to their exports, Arc
  candidates and catalog tiers, one of the five required decisions, risk,
  representative consumers, and focused verification owner. Arc Pro remains
  prohibited where no entitlement is evidenced. DESIGN.md was treated as
  non-blocking; the potential global-token collision is recorded as a risk.
- Commands:
  - `rg --files apps/web/src/components/ui apps/web/src/components/wm apps/web/src/components/shell apps/web/src/components/charts` and the task-specified `rg -n "from [\"']@/components/(ui|wm|shell|charts)" apps/web/src --glob '*.tsx' --glob '*.ts'` — 82 total files including colocated tests; 241 matches in 120 files (one match was an alias rendered as `apps/...` in condensed output).
  - Read `apps/web/components.json`, `apps/web/package.json`, approved migration spec, Arc public `catalog.json` (2026-10-04 generated metadata), `llms.txt`, and candidate Markdown references for required primitives, controls, and charts. Catalog reports 234 items / 127 free; all minimum requested candidates inspected are free. One Scroll area markdown fetch failed; catalog marks it free with no dependencies and the map records that limitation.
  - Completeness checker (Python inline): enumerate non-test files in the four target directories, resolve row paths relative to `apps/web/src/components`, and reject missing/extra/duplicate paths or empty candidate/decision/risk and invalid decisions — `production_files=65 mapped_rows=65 missing=0 extra=0 duplicate=0 invalid_or_empty=0`.
  - `git diff --check` — pending final pre-commit run.
- Evidence: `docs/architecture/uiarc-component-map.md`; local Arc metadata/docs cached under `/tmp/uiarc-*` for this inventory only.
- Follow-up: Arc compatibility adapters require separate batch implementation and focused tests/browser checks; no product code was changed in this inventory task.

Append one compact entry per bounded loop. Keep evidence, not narration.

Template:

```md
## YYYY-MM-DD — task name

- Checks: `checks/approved/<task>.md`
- Round: 1/2
- Result: PASS | FAIL | BLOCKED
- Commands: `<command>`
- Evidence: <short output or artifact path>
- Follow-up: <next action>
```

## 2026-10-05 — P0 mobile dock reachability (audit finding P0-1)

- Checks: `checks/approved/p0-mobile-dock-reachability.md`
- Round: 1/2
- Result: PASS (Checks 1-3 live-verified; Check 4 verified by code review)
- Change: `apps/web/src/app/bento.css` — `.wm-dock[data-hidden]` no longer
  translates fully off-screen (`translateY(calc(100% + 24px))` +
  `pointer-events: none`). Root cause: the dock pill is 60px tall, too short
  to clip-and-reveal a 44px touch target while still "tucking away," so the
  fix dims it (`opacity: 0.45`, restored to `1` on hover/focus-within) while
  leaving position, size, and `pointer-events: auto` unchanged. No change to
  `mobile-bars.tsx` — the existing scroll-direction JS logic was already
  correct; only the CSS consequence of `data-hidden` was the bug.
- Commands:
  - `playwright-cli -s=audit` live session, mobile 390×844, authenticated as
    `demo@wealthme.id`, on `/laporan` (scrollHeight 2008 vs clientHeight 844).
  - Check 1/2: `.wm-main`.scrollTop = 500 → `.wm-dock` rect
    `{top:770, bottom:830, innerHeight:844, hidden:true, pointerEvents:"auto",
opacity:"0.45"}` — top stays well inside viewport, pointer-events never
    disabled.
  - Check 3: scrollTop = 0 → `{hidden:false, opacity:"1"}` — hide/show
    pattern intact.
  - Check 4: code review — opacity transition is independent of the
    existing `useReducedMotion` branch in `mobile-bars.tsx`, which still
    only gates the spring/blob motion; no regression.
  - `bash scripts/qa.sh` (lint gate): **1 pre-existing error** in
    `apps/web/src/app/layout.tsx:71` (`no-sync-scripts`) — confirmed via
    `git status` to predate this task (already modified before this
    session started, not touched by this change). No lint issues in
    `bento.css`. 21 other pre-existing warnings in unrelated files,
    untouched by this task.
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target apps/web/src/app/bento.css`
    — 3 pre-existing advisory findings at lines 3437/3451/3494 (unrelated
    font-size steps); none introduced at the edited lines (469-481).
- Evidence: see commands above; playwright session screenshots not retained
  (ephemeral scratchpad), numeric `getBoundingClientRect()`/computed-style
  evidence captured inline above.
- Follow-up: `scripts/qa.sh` lint failure in `layout.tsx` is a pre-existing,
  unrelated blocker for a clean full-gate run — flag to the user separately
  (it was already dirty at session start); does not block this task. Next
  backlog item per `docs/agentic/checkpoints/ui-restyle-backlog.md`: #2
  (`Sfmono-Regular` token fix in `masterdata.css`).

## 2026-10-05 — IAM access matrix a11y labeling (audit finding P2-2)

- Checks: `checks/approved/p2-iam-matrix-a11y-labeling.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/app/(app)/iam/_components/page-access-matrix.tsx` —
  each page-group's "Semua: Tidak / Lihat / Kelola" bulk-set button now
  gets `aria-label={`Set semua ${title} ke ${o.label}`}`; visible text is
  unchanged. Root cause (confirmed via live accessibility snapshot on
  `/iam` → "Buat role"): the **per-row** radiogroups were already
  correctly labeled (`aria-label="Akses {page}"` per row), but the 6
  page-groups each render 3 bulk-set buttons with only the bare level
  label as their accessible name — 18 buttons collapsing to 3 repeated
  names ("Tidak"/"Lihat"/"Kelola") with no indication of which resource
  group each one bulk-applies to, exactly the "which permission, for
  which resource" ambiguity the audit (P2-2) flagged.
- Commands:
  - `pnpm --filter web exec jest iam` → 6 suites, 34/34 tests passed
    (Check 3).
  - `playwright-cli` live session, authenticated, `/iam` → "Buat role":
    accessibility snapshot before showed 18 buttons named only
    `"Tidak"`/`"Lihat"`/`"Kelola"`; after the fix each is uniquely named,
    e.g. `"Set semua Umum ke Tidak"`, `"Set semua Kekayaan ke Kelola"`
    (Check 2).
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/iam/_components/page-access-matrix.tsx"`
    → `[]`, no findings (Check 4).
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #9 (required-field
  indicators + inline validation on Tambah Transaksi — check whether the
  modal is foundation or page-local before scoping).

## 2026-10-05 — Account card default color differentiation (audit finding P2-1)

- Checks: `checks/approved/p2-account-card-color-differentiation.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/components/wm/account-card.tsx` — `defaultLook(type)`
  (a protected foundation file, narrow justified change: single shared
  source used by Rekening, Dana, and both Beranda card surfaces) now takes
  an optional `id` and picks a skin from a small per-type pool
  (`bank`: lime/sky/coral/lilac, `ewallet`: forest/midnight/sand, `cash`:
  sand/graphite/lime) via a deterministic string hash of the account id,
  instead of always returning the same single skin per type. `lookFor` in
  `useCardLooks` now passes `id` through. A user's manually-saved look
  (localStorage) still always wins — `defaultLook` is only the fallback
  when nothing is saved. Pattern selection (`hatch`/`plain` by type)
  unchanged, out of scope. Root cause: every un-customized bank account
  collapsed onto the same "lime" default, which is what the audit observed
  as BCA/Mandiri/BNI reading as visually similar in the Rekening scroller.
- Commands:
  - Scratch script confirms three different bank-account ids resolve to
    three different skins (`lime`/`sky`/`lilac`) and the same id is stable
    across repeated calls (Checks 1-2).
  - Code review of `lookFor`: `looks[id] ?? defaultLook(type, id)` (Check 3).
  - `pnpm --filter web exec jest rekening dana beranda account-card` →
    12 suites, 54/54 tests passed (Check 4).
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/components/wm/account-card.tsx"`
    → `[]`, no findings (Check 5).
  - `pnpm --filter web exec tsc --noEmit` → clean.
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #8 (IAM access matrix
  a11y labeling).

## 2026-10-05 — Tujuan contradictory goal status signal (audit finding P1-5)

- Checks: `checks/approved/p1-tujuan-status-contradiction.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/app/(app)/tujuan/page.tsx` — the "Perlu perhatian"
  ("Needs attention") panel's `attentionGoals` no longer pads in every
  other goal (`restGoals`, sorted by progress) when nothing actually needs
  attention; it now lists only `needs_boost`/`at_risk` goals (capped at
  `MAX_ATTENTION_ROWS`), falling back to the existing `attAllGood` empty
  state when none. Root cause: an EPIC-033 revision intentionally padded
  the panel with on-track goals to match a prototype's "always show every
  goal" layout, but that meant a card titled "needs attention" could show
  an `on_track` goal's "Sesuai rencana" status in the same row — the exact
  two-conflicting-signals bug the audit (P1-5/AC-5) flagged live. The
  i18n copy (`attCaption: "Tujuan yang tertinggal dari rencana"`,
  `attAllGood`) already matched the single-signal design; only the padding
  logic had drifted from it. Also updated the one existing test
  (`tujuan.test.tsx`) that asserted the old padded (contradictory)
  behavior to assert the corrected single-signal behavior.
- Commands:
  - `pnpm --filter web exec jest tujuan.test.tsx` → 16/16 passed, including
    the rewritten "shows the all-good state when every goal is on track"
    test and the pre-existing "lists a goal that needs a push" test
    (Checks 1-4).
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/tujuan/page.tsx"`
    → `[]`, no findings (Check 5).
  - `pnpm --filter web exec tsc --noEmit` → clean.
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #7 (account card color
  differentiation defaults — touches the `wm/` foundation path, needs a
  narrow justification note before scoping).

## 2026-10-05 — profile "Penghasilan Bulanan" field missing thousand-separator formatting (user-flagged, backlog #10)

- Checks: `checks/approved/p1-profile-income-formatting.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/app/(app)/akun/page.tsx` — the `monthlyIncome` field now
  follows the established `formatAmountInput`/`parseRupiah` round trip (same
  pattern as `donation/page.tsx`): import `formatAmountInput` alongside the
  already-imported `parseRupiah`; initial form state formats an existing
  `profile.monthlyIncome` on load; the `onChange` handler live-formats via
  `formatAmountInput`; the input gained `type="text"`/`inputMode="numeric"`;
  the submit payload now sends `String(parseRupiah(form.monthlyIncome))`
  instead of a raw trimmed string, so the API still receives a plain digit
  string (no backend shape change). Root cause: this was the only Rupiah
  input in the codebase not using the established formatting round trip.
- Commands:
  - `playwright-cli` live session, authenticated as `demo@wealthme.id`, on
    `/akun?tab=profil` → "Edit profil": filled `1000000` into "Penghasilan
    Bulanan" → field value read back as `"1.000.000"` (Check 1, live format).
  - Saved, reopened "Edit profil" → field pre-filled with `"1.000.000"`
    (Check 2, persisted value loads formatted).
  - Code review: submit payload builds `String(parseRupiah(form.monthlyIncome))`
    (Check 3 — unchanged digit-string shape for the API).
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/akun/page.tsx"`
    → pre-existing advisory color/font-size findings at unrelated lines
    (4223, 4249, 4332, 4393); none at the edited lines (Check 4).
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #6 (Tujuan goal status
  contradiction), the next item in the original ordered sequence.

## 2026-10-05 — card "Gelombang" (waves) pattern invisible (user-flagged, backlog #11)

- Checks: `checks/approved/p1-card-waves-pattern.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/app/bento.css` — `.wm-plate[data-pattern="waves"]::before`'s
  two radial-gradients repositioned from centers at `110% 120%`/`110% 150%` (both
  entirely below/outside the card's `overflow: hidden` box — center y minus the
  ellipse's vertical radius still exceeded 100%, so nothing ever painted) to
  `18% 115%`/`82% 125%` with a larger `90% 90%` ellipse size, so the visible arc
  reaches up to ~70% from the top — a genuine scalloped wave silhouette along the
  bottom edge, confirmed distinct from "Polos" (plain, no `::before` rule by design).
  `hatch`/`dots` rules untouched.
- Commands:
  - `playwright-cli` live session, authenticated, Rekening → BCA card → "Ubah
    tampilan kartu": screenshot confirms "Gelombang" swatch now shows a clear
    wave shape, visually distinct from "Polos" (flat).
  - `grep -n "wm-plate\[data-pattern" bento.css` → only `waves` values changed.
  - `impeccable detect --json --target bento.css` → no findings at the edited
    lines.
- Evidence: screenshot at
  `/tmp/claude-1000/.../scratchpad/card-panel-after.png` (ephemeral scratchpad,
  not retained in repo).
- Follow-up: still pending — backlog #10 (profile income field thousand-separator)
  and original backlog #6 (Tujuan status contradiction).

## 2026-10-05 — P1 Dana money formatting consistency (audit finding P1-4)

- Checks: `checks/approved/p1-dana-money-formatting.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/app/(app)/dana/page.tsx:289` — account row balance
  className changed from `"dn-row-amt num"` to `"dn-row-amt wm-num"`. `num`
  was a dead class (not defined anywhere in `dana.css`/`bento.css`/
  `globals.css`); `wm-num` is the shared class (`bento.css:17`,
  `font-variant-numeric: tabular-nums`) every other money-showing page uses
  (Beranda, Laporan, Transaksi). Dana's hero/KPI figures already had tabular
  numerals built into `components/wm/bento.tsx`'s `.wm-big`/`.wm-kpi-v` —
  only this page-local row amount was missing the shared class.
- Commands:
  - `grep -n "dn-row-amt" page.tsx` → `className="dn-row-amt wm-num"`.
  - `playwright-cli` live session, authenticated, on `/dana`:
    `getComputedStyle(.dn-row-amt).fontVariantNumeric` → `"tabular-nums"`.
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target page.tsx`
    → pre-existing advisory font-size findings at other lines (747/825/830
    etc., unrelated); none at line 289.
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #6 (Tujuan goal status
  contradiction). User also flagged live (mid-session, with screenshot) a
  related but separate bug: the "Penghasilan Bulanan" field in the profile
  modal has no thousand-separator live-formatting — tracked as new backlog
  item #10.

## 2026-10-05 — P1 TanStack Query queryFn warning fix (audit finding P1-3)

- Checks: `checks/approved/p1-tanstack-queryfn-warning.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/hooks/use-my-access.ts` — `useBalancesHidden()`'s
  cache-read-only `useQuery` now passes `queryFn: skipToken` instead of
  omitting `queryFn` entirely (previously only `enabled: false`). TanStack
  Query v5 validates for a `queryFn` at observer-creation time regardless of
  `enabled`, so the omission logged "No queryFn was passed... " on every
  mount; `skipToken` is TanStack's documented sentinel for "intentionally
  never fetch, cache-read only" and silences the warning without changing
  behavior — `useMyAccess()`'s own fetching query (same queryKey) is
  untouched.
- Commands:
  - `playwright-cli` live session, authenticated as `demo@wealthme.id`:
    before fix, 6 identical `[ERROR] [...] No queryFn was passed...` on
    `/beranda` load; after fix (hot-reloaded), 0 such errors — only an
    unrelated pre-existing `ERR_CONNECTION_REFUSED` on a local dev-tool
    endpoint (`localhost:8400/live.js`, not part of this app).
  - `pnpm --filter web exec tsc --noEmit` → clean, no errors.
  - Code review: `skipToken` only affects the eager-fetch validation: the
    query still reads the shared cache entry `useMyAccess()` fills via the
    identical `queryKey`, so `data?.balancesHidden` resolves exactly as
    before.
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #5 (consistent money
  formatting on Dana).

## 2026-10-05 — P1 beranda carousel dots transition fix (audit finding P1-2)

- Checks: `checks/approved/p1-beranda-dots-transition.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/app/(app)/beranda/_components/beranda.css:409-419` —
  `.beranda-mh-dots i` no longer animates `width` (a layout property). Base
  rule is now a fixed 16×6px pill at `transform: scaleX(0.375)` (visually a
  6px dot), and `[data-on]` sets `transform: scaleX(1)` (visually a 16px
  pill) — same visual states as before, now GPU-composited via `transform`
  only, per `ui-ux-pro-max`'s `transform-performance` rule. No JS change;
  `data-on` toggle logic untouched.
- Commands:
  - `grep -n "transition" beranda.css` → `transition: transform 0.2s;` at
    line 415 — no `width`/`height`/`top`/`left` transitioned.
  - `playwright-cli` live session, authenticated as `demo@wealthme.id`, on
    `/beranda`: dots' computed rects/transforms —
    `{on:true, width:16, transform:"matrix(1,0,0,1,0,0)"}` and 5×
    `{on:false, width:6, transform:"matrix(0.375,0,0,1,0,0)"}` — matches
    pre-fix visual sizes exactly, now driven by `transform`.
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target beranda.css`
    → 16 pre-existing advisory findings (colors/radii/font-size, all
    unrelated lines); the one at the edited line (`border-radius: 3px`,
    line 411) is the same value that already existed pre-edit in the
    `[data-on]` rule (confirmed via `git diff` — not newly introduced).
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #4 (trace/fix the
  missing TanStack Query `queryFn` console error).

## 2026-10-05 — P1 masterdata.css mono token fix (audit finding P1-1)

- Checks: `checks/approved/p1-masterdata-mono-token.md`
- Round: 1/2
- Result: PASS
- Change: `apps/web/src/app/(app)/masterdata/masterdata.css:112` — `.md-cat-code`
  now uses `font-family: var(--font-mono)` instead of a hardcoded
  `ui-monospace, SFMono-Regular, Menlo, monospace` stack. The element itself
  (a category code) is a legitimate mono use per DESIGN.md ("mono is
  reserved for codes and IDs") — the bug was bypassing the project's DM Mono
  token (`globals.css:21`), not misuse of mono.
- Commands:
  - `grep -n "font-family" apps/web/src/app/\(app\)/masterdata/masterdata.css`
    → `font-family: var(--font-mono);` — literal `SFMono-Regular` gone.
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/masterdata/masterdata.css"`
    → 2 pre-existing advisory findings (radius at lines 93/174, unrelated);
    none at line 112.
  - PostToolUse design hook on the edit: "No deterministic design-quality
    issues found."
- Evidence: see commands above.
- Follow-up: next backlog item per
  `docs/agentic/checkpoints/ui-restyle-backlog.md`: #3 (`transition: width`
  layout-thrash in `beranda.css`).

## 2026-10-05 — P2 Tambah Transaksi required-field indicators + inline validation (audit P2-4/AC-7)

- Checks: `checks/approved/p2-tambah-transaksi-required-fields.md`
- Round: 1/2
- Result: PASS
- Change:
  - `apps/web/src/components/shell/transaction-dialog.tsx` — `Field`/`TileField`
    gained `required`/`error` props (a `*` label marker + inline `.error-text`
    under the control). `saveTxn`'s existing per-check `toast.error(...)` calls
    now also `setFieldErrors({...})`/`setFieldErrors({})` a single-key object
    (amount, account, destAccount, card, date — date gained a new required
    check, previously silently allowed empty). Wired onto amount (`AmountHero`),
    account/destAccount (`TileField`), card (`Field`), and date (`Field`).
    Also fixed an unrelated hardcoded `"Simpan"` fallback → `t.common.save`,
    found while in this file (same file, same justification).
  - `apps/web/src/components/shell/tx-pickers.tsx` — `AmountHero` gained the
    same `required`/`error` props/rendering. Its currency picker was also
    rebuilt per a user-supplied uiarc.dev `money-input` reference screenshot:
    native `<select>` → a Base UI `DropdownMenu` trigger pill + row list
    (flag, bold code, muted full name, checkmark on the selected row) — reuses
    existing `CURRENCIES`/`t.akun.pengaturan.currencies` data, not a wholesale
    uiarc component adoption (see backlog's "uiarc.dev decision" note).
  - `apps/web/src/i18n/{id,en,types}.ts` — new `shell.transactionDialog.dateRequiredError`
    key, and new shared `common.pay`/`common.saving` keys (used below).
  - Separate, same-session i18n-consistency sweep (user-flagged live: "masih
    ada button yang hardcode menggunakan bahasa") — real hardcoded strings
    that bypassed the dict, found while auditing `transaction-dialog.tsx`'s
    neighborhood: `components/crud/row-actions.tsx` ("Edit"/"Hapus"/"Bayar" →
    `t.common.edit`/`delete`/`pay`), `components/crud/crud-modal.tsx`
    ("Simpan"/"Menyimpan..." → `t.common.save`/`saving`), and 4 IAM dialogs'
    `DialogClose aria-label="Tutup"` → `t.common.close`
    (`member-email-dialog.tsx`, `role-editor-dialog.tsx`,
    `family-handle-card.tsx`, `member-access-dialog.tsx` — the latter two
    needed a new `useLocale()` wire-up). Each reused an existing `t.common.*`
    key except `pay`/`saving`, which were net-new.
- Commands:
  - `pnpm --filter web exec tsc --noEmit` → clean.
  - `pnpm --filter web exec jest` → 153/153 suites, 1458/1460 tests passed (2
    pre-existing skips). Fixed along the way: `transaction-dialog.test.tsx`'s
    `getByLabelText(dict.dateLabel/amountLabel)` needed `{exact:false}` (the
    label text now includes the `*` marker) and the USD-currency test needed
    to drive the new DropdownMenu (click trigger → click "USD" menuitem)
    instead of `selectOptions`; `row-actions.tsx`'s `edit: "Ubah"` (an
    existing id.ts value, previously unreachable behind the hardcoded "Edit"
    bug) broke 7 unrelated suites whose tests hardcoded `name: "Edit"` —
    updated each to the real translated name; `akun/profil-body.test.tsx`
    expected the pre-formatting-era raw string `"Rp 30.000.000"` as the save
    payload — updated to the `parseRupiah`-normalized `"30000000"` the
    component has actually sent since task #10;
    `transaksi/txrow-detail.test.tsx` needed two assertions reverted to
    `"Edit"` — that dialog's footer uses a _different_, pre-existing dict key
    (`t.transaksi.detailEditButton`, itself "Edit") from RowActions' now-fixed
    `t.common.edit` ("Ubah"), scoped via `within(dialog)` to avoid colliding
    with the row's own button.
  - `pnpm exec eslint` on all touched files → 0 errors (pre-existing unused-var
    warnings on untouched lines only).
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target <file>`
    on every touched file → `[]` except `transaction-dialog.tsx` (3
    pre-existing advisories, confirmed via `git diff` not on edited lines) and
    `role-editor-dialog.tsx` (1 pre-existing advisory, same confirmation).
  - `bash scripts/security-check.sh` → secret-scan clean after removing an
    unrelated `impeccable-live` dev-preview `<script>` tag that had been
    injected into `apps/web/src/app/layout.tsx` (not part of this task,
    reverted to match the committed version); remaining failure is
    pre-existing `apps/api` transitive dependency advisories
    (socket.io/engine.io), unrelated to this frontend-only session and out of
    scope per "jangan sentuh api dulu" — flagged, not fixed.
- Evidence: see commands above.
- Follow-up: this was the last item in the original ordered backlog
  (`docs/agentic/checkpoints/ui-restyle-backlog.md` #1-11, all done). The
  `apps/api` dependency advisories above are a separate, pre-existing,
  backend-scoped finding for a future task, not this frontend restyle backlog.

## 2026-10-05 — uiarc.dev component adoption: money-input currency picker + context-menu (user request)

- Checks: none drafted (direct implementation per standing authorization +
  live user feedback mid-session, not a task-loop item).
- Round: 1/2 (one live bug found and fixed during verification)
- Result: PASS
- Change:
  - `apps/web/src/components/shell/tx-pickers.tsx` — `AmountHero`'s currency
    picker moved from a collapsed "Currency (optional)" disclosure below the
    amount to an inline pill to the right of the amount input (user-flagged:
    "harusnya ada di section kanan text input angka bukan di bawah lagi"),
    matching the uiarc.dev `money-input` reference screenshot. Added
    `QuickAddChips` (+10.000/+50.000/+100.000, IDR-only — round increments
    aren't meaningful to guess for an arbitrary foreign currency), adapted
    from the same reference onto `MoneyField`'s existing string/IDR-first
    model rather than adopting uiarc's minor-units/no-FX value model, which
    would have silently discarded WealthMe's live ECB-rate FX conversion
    (`resolved.canonical`/`withFxInputs`/the "1 USD = Rp X" hint) — a real
    financial feature uiarc's generic component has no concept of.
  - `apps/web/src/components/ui/context-menu.tsx` (new) — Base UI
    `@base-ui/react/context-menu` wrapper, same structure/conventions as the
    existing `dropdown-menu.tsx`.
  - `apps/web/src/components/wm/context-menu.tsx` (new) — `ContextMenu`
    component with the uiarc.dev `context-menu` reference's `items` API
    (`{id, label, icon?, onSelect?, disabled?, destructive?}[]`), adapted
    onto the Base UI primitive above instead of uiarc's own `motion` +
    hand-rolled positioning/long-press code — Base UI's own
    `ContextMenuTrigger` already opens on right-click _or_ long-press
    natively, so there was nothing left to reimplement. Exported from
    `components/wm/index.tsx`.
  - Wired onto `apps/web/src/app/(app)/transaksi/page.tsx`'s `HistoryRow`
    (the actual rendered row component — `TxRow`/`TxTableRow` in the same
    file are exported+tested but never rendered anywhere in the app;
    ContextMenu was added there too for consistency, but the live fix is on
    `HistoryRow`) as a supplementary right-click/long-press path to the same
    Detail/Ubah/Hapus actions, honoring the same `canModify`/obligation-link
    locks as the row's own dialog buttons. Added to `TxTableRow` via Base
    UI's `render` prop (`ContextMenuTrigger` can't default to a `<div>`
    inside a `<table>`).
  - `apps/web/src/components/ui/dropdown-menu.tsx` — **live bug fix**,
    found during verification: `DropdownMenuContent`/`ContextMenuContent`
    used `z-50`, while `Dialog`'s own overlay/content use `z-[60]`, so a
    currency picker (or any dropdown/context menu) opened from inside a
    Dialog had its clicks intercepted by the dialog's own backdrop —
    exactly the "pilih currencies jadi ngebug gabisa diklik" the user
    reported live. Bumped both menu primitives' popup/positioner to
    `z-[70]` so they always render above a Dialog.
  - `apps/web/jest.setup.ts` — new `DOMRect`/`DOMRect.fromRect` polyfill;
    jsdom doesn't implement `DOMRect`, and Base UI's `ContextMenuTrigger`
    calls `getBoundingClientRect()` on mount (before any interaction), so
    every test rendering a `ContextMenu` crashed without it.
  - `apps/web/src/components/wm/context-menu.test.tsx` (new) — 3 tests:
    opens + fires `onSelect` on right-click, skips `onSelect` when
    `disabled`, and renders via the `render` prop as a non-`<div>` element
    (`<tr>`) with children projected inside it.
- Commands:
  - `pnpm --filter web exec tsc --noEmit` → clean throughout.
  - `pnpm --filter web exec jest` → 154/154 suites, 1461/1463 tests passed
    (2 pre-existing skips).
  - `pnpm exec eslint` on every touched/new file → 0 errors/warnings.
  - `.agents/skills/impeccable/scripts/impeccable detect --json --target <file>`
    on every touched/new file → `[]` except `tx-pickers.tsx` (1) and
    `transaksi/page.tsx` (4), all pre-existing per `git diff` (not on edited
    lines).
  - Live verification via `playwright-cli` against the running dev server
    (`localhost:3000`, demo account): confirmed the currency picker is now
    inline and clickable (caught the z-index bug here, fixed, re-verified
    clean), the IDR/USD selection + "1 USD = Rp ..." hint still round-trips
    correctly, the +50.000 quick-add chip sets the amount and updates the
    converted-currency preview, and a real right-click on a Transaksi row
    opens "Detail Transaksi / Ubah / Hapus" and each item works (clicked
    "Detail Transaksi", confirmed the real dialog opens with correct data).
- Evidence: see commands above; screenshots taken via playwright-cli during
  the session (not retained as repo artifacts).
- Follow-up: user separately asked about porting uiarc.dev's full 148-
  component catalog; confirmed via `AskUserQuestion` the scope is "genuinely
  missing primitives only," explicitly excluding anything already covered by
  `components/ui`/`wm` and the DESIGN.md-banned Charts/Tables/Donut/Data Grid
  categories. Context Menu (this entry) is the first. Other candidates
  mentioned but not yet built: Hold to confirm, Swipe actions, Signature pad,
  Tag input, Shortcut recorder — pick up on request.

## 2026-10-05 — ui-ux-pro-max audit loop, task 1/N: menu item touch-target size (44x44 WCAG 2.2 AA)

- Checks: none drafted (audit-driven loop per user request, not a task-loop item).
- Round: 1/1
- Result: PASS
- Change: `apps/web/src/components/ui/dropdown-menu.tsx` and
  `apps/web/src/components/ui/context-menu.tsx` — every item variant
  (`DropdownMenuItem`, `DropdownMenuSubTrigger`, `DropdownMenuCheckboxItem`,
  `DropdownMenuRadioItem`, `ContextMenuItem`, `ContextMenuCheckboxItem`)
  gained `[@media(pointer:coarse)]:min-h-11` (44px). These were plain
  Tailwind utility classes (`px-1.5 py-1 text-sm`, ~28px tall) with no touch
  override, unlike `.btn`/`.btn--sm` in `design-system.css`, which already
  has the identical `@media (pointer: coarse) { min-height: 44px }` pattern
  for the exact same reason (see that file's own "Hardening batch G3"
  comment). `ui-ux-pro-max`'s `ux` domain flags sub-44px touch targets as
  High severity / WCAG 2.2 AA. Directly relevant to the new `ContextMenu`
  (components/wm/context-menu.tsx) shipped this session, reachable via
  long-press — a touch-only gesture — but also fixes every other
  `DropdownMenu` consumer in the app (rekening/liabilitas/asuransi pages)
  for free, mouse/desktop sizing untouched (`@media (pointer: coarse)` only
  matches real touchscreens).
- Commands:
  - `pnpm --filter web exec tsc --noEmit` → clean.
  - `pnpm --filter web exec jest` → 154/154 suites, 1461/1463 passed.
  - `pnpm exec eslint` on both files → 0 errors/warnings.
  - Live verification via `playwright-cli` (iPhone 15 emulation): long-pressed
    the Transaksi "Cicilan KPR BTN" row via a real CDP touch event (matching
    the earlier long-press verification), then measured each menu item's
    `getBoundingClientRect().height` directly — "Detail Transaksi"/"Ubah"/
    "Hapus" all measured exactly 44px.
- Evidence: see commands above.
- Follow-up: `impeccable detect` across `src/` found 727 pre-existing
  advisory-severity findings (font-size/radius/color drift), all predating
  this session and spread across the whole app — not something a bounded
  loop can responsibly clear item-by-item without a separate, explicitly
  scoped design-token-reconciliation project. Continuing the loop with
  `ui-ux-pro-max`'s other priority checks (animation timing, forms/feedback,
  navigation) against this session's own additions instead.

## 2026-10-05 — ui-ux-pro-max audit loop, task 2/N: currency picker touch target

- Result: PASS for the scoped regression; broader gates are environment-blocked.
- Finding: `CurrencyPicker`'s inline trigger in
  `apps/web/src/components/shell/tx-pickers.tsx` was a ~34px pill on coarse
  pointers (`py-1.5`) even though its dropdown items had been raised to 44px
  in task 1. This violated `ui-ux-pro-max`'s high-severity touch-target rule
  for the new mobile transaction flow.
- Change: added `[@media(pointer:coarse)]:min-h-11` to the trigger only;
  desktop sizing and the picker/menu behavior remain unchanged. Added
  `apps/web/src/components/shell/tx-pickers.test.tsx` to lock the contract.
- Commands:
  - RED: targeted Jest initially failed because the expected coarse-pointer
    utility was absent; after mocking the unrelated `MoneyHint` auth-heavy
    import, the failure was the intended missing-class assertion.
  - GREEN: `pnpm --filter web exec jest src/components/shell/tx-pickers.test.tsx --runInBand`
    → 1/1 suite, 1/1 test passed.
  - `pnpm --filter web exec eslint src/components/shell/tx-pickers.tsx src/components/shell/tx-pickers.test.tsx`
    → clean.
  - `pnpm --filter web exec tsc --noEmit` → blocked by pre-existing install
    state: `motion/react` is missing from `node_modules` for existing animate-ui,
    mobile-bars, and use-is-in-view files.
  - `pnpm --filter web exec jest --runInBand` → blocked by the same missing
    `motion/react` module in multiple existing suites; the focused suite passes.
  - `.agents/skills/impeccable/scripts/impeccable detect ...` → tool path is
    absent from this checkout; no global/local executable was available to run.
  - Mobile live check: `cross-page-ux.mobile.spec.ts` ran at 390×844 with
    touch enabled but stopped at demo login (`waitForURL` timeout; page stayed
    on `/login`), before it could reach the transaction dialog. No code change
    was made for that external auth failure.
- Scope: the known 727 pre-existing `impeccable` advisory findings remain
  untouched. User-owned dirty files were preserved.
- Follow-up: next audit pass should continue with the concrete forms/feedback,
  animation, or navigation finding once the verification environment is
  repaired/available.

## 2026-10-05 — ui-ux-pro-max audit loop, task 3/N: ContextMenu animation timing

- Result: PASS for the scoped regression; broader gates remain environment-blocked.
- Finding: `apps/web/src/components/ui/context-menu.tsx` used
  `duration-100` for the ContextMenu popup. The `ui-ux-pro-max` animation
  timing rule recommends 150–300ms for micro-interactions; 100ms was below
  that range on the new long-press/right-click menu.
- Change: changed only the ContextMenu popup to `duration-200`, preserving its
  existing transform/opacity animation and reduced-motion global overrides.
  Added a regression assertion in `apps/web/src/components/wm/context-menu.test.tsx`.
- Commands:
  - RED: `pnpm --filter web exec jest src/components/wm/context-menu.test.tsx --runInBand`
    → 3 passed, 1 failed exactly because `duration-200` was absent.
  - GREEN: same command → 4/4 tests passed.
  - `pnpm --filter web exec eslint src/components/ui/context-menu.tsx src/components/wm/context-menu.test.tsx`
    → clean.
  - `pnpm --filter web exec tsc --noEmit` → blocked by missing `motion/react`
    in existing animate-ui/mobile-bars/use-is-in-view imports.
  - `pnpm --filter web exec jest --runInBand` → 82 passed, 73 failed, 2
    skipped; failures are the same missing `motion/react` module in existing
    suites (plus existing console warnings).
  - `.agents/skills/impeccable/scripts/impeccable detect ...` → executable
    unavailable in the checkout.
  - Mobile live check: Playwright Chromium at 390×844 with touch enabled ran
    but timed out during demo login on `/login` before reaching the app/menu.
- Hook diagnosis: daemon logs show the old `rtk hook codex` PreToolUse command
  was rejected as an unknown RTK subcommand. Commit `add8b580` had already
  replaced that invalid hook with the portable `.codex/hooks/guardrail.sh`;
  current guardrail probe exits 0 and the current session no longer emits the
  old error. No additional hook change was needed for this task.
- Scope: the 727 pre-existing `impeccable` advisory findings remain untouched;
  user-owned dirty files remain preserved.
- Follow-up: continue with the next concrete forms/feedback or navigation
  finding after the `motion/react`, impeccable, and demo-auth verification
  prerequisites are restored.

## 2026-10-05 — ui-ux-pro-max audit loop, task 4/N: AmountHero validation semantics

- Checks: audit-driven loop; no approved task-loop checks were drafted.
- Round: 1/1
- Result: PASS for the scoped regression; broader gates remain environment-blocked.
- Finding: `AmountHero` rendered its field-level error below the amount input,
  but the input had no `aria-invalid` state or `aria-describedby` link to that
  error. This violated the `ui-ux-pro-max` Forms/Feedback rules for inline
  error placement and accessible field feedback.
- Change: `apps/web/src/components/shell/tx-pickers.tsx` now sets
  `aria-invalid` when `error` is present, links the input to a stable
  `${id}-error` element, and gives the alert paragraph that id. Added the
  contract test in `apps/web/src/components/shell/tx-pickers.test.tsx`.
- Commands:
  - `python .agents/skills/ui-ux-pro-max/scripts/search.py "animation timing forms feedback navigation patterns" --domain ux --max-results 30 --format markdown` → returned the prioritized UX rules; selected the High/Medium forms feedback finding above.
  - `pnpm --filter web exec jest src/components/shell/tx-pickers.test.tsx --runInBand` → 1/1 suite, 2/2 tests passed.
  - `pnpm exec eslint src/components/shell/tx-pickers.tsx src/components/shell/tx-pickers.test.tsx` → clean.
  - `pnpm --filter web exec jest --runInBand` → 82 passed, 73 failed, 2 skipped; all failures are pre-existing `Cannot find module 'motion/react'` dependency-state failures. The new suite passed.
  - `pnpm --filter web exec tsc --noEmit` → blocked by the same pre-existing missing `motion/react` module in animate-ui/mobile-bars/use-is-in-view.
  - `.agents/skills/impeccable/scripts/impeccable detect ...` → executable unavailable in this checkout; no global/local executable found.
  - `pnpm --filter web exec playwright test tests/e2e/audit/a11y.spec.ts --project=chromium --workers=1` → `/login` loaded, but failed on 2 pre-existing serious contrast findings; authenticated pages timed out at demo login.
  - Mobile live check → blocked: `playwright-cli` is not installed and Playwright config exposes only `chromium` (no `mobile` project); the prior mobile/auth limitation remains.
- Scope: the 727 pre-existing `impeccable` advisory findings (font-size/radius/color) remain untouched. No contrast or dependency cleanup was attempted.
- Follow-up: continue with the next concrete navigation or feedback finding once `motion/react`, impeccable executable, and demo auth/mobile browser prerequisites are restored.
