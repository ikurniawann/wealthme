# WealthMe bento prototype: build guide for page agents

Goal: turn every page of the real app (source: `/home/wit/WORK/vibes/wealthme-web-j5/apps/web/src`, READ-ONLY) into a
static HTML page in this folder. Each page must carry **every feature, form, field, validation, popup/dialog, empty state,
tab and action** of the real page, redesigned in the new bento language. It must feel alive: forms save into the shared
store, lists update, toasts confirm, destructive actions ask first and offer undo.

## Rules

- Write ONLY your assigned files in `docs/design/proto/`. Never edit `wm.css`, `wm.js`, other pages, or anything in git.
  No git commands that write. If the foundation lacks something, add page-local code/CSS and mention it in your report.
- Start from `_template.html` (head, fonts, `wm.css`, `<main data-page="id">`, `wm.js`, `WM.shell`, `if(!WM.allowed)return;`).
- Read `/home/wit/.claude/skills/impeccable/reference/craft-floor.md` and `operate.md` first and follow them (this is Operate mode).
  Read `index.html`/`laporan.html` if they exist, plus `../dashboard-concept.html` and `../laporan-concept.html`, for the visual language.
- Language: Indonesian, casual-polite "kamu", minimal text (client mandate "anti slop, tidak banyak tulisan"). Helper text max one
  line. No eyebrow/kicker labels, no em dashes, no decorative pills, no emoji. Optional fields say "(opsional)".
  Errors are plain and non-technical. Estimates labelled "Perkiraan" or "≈". Never fake live data: prices from a source say so.
- Honest UI: a control does what it says. Things that truly need a server (email sending, bank sync, file OCR) are simulated
  with a clear, short note, e.g. toast "Undangan terkirim (simulasi)".
- Visual language: tokens only (no new hex except data-viz categorical colours already in wm.css vars). Cards 18px radius,
  dark `.cover` band for the page's headline answer/number, hatched bars, lime = the one accent. Avoid identical card grids:
  vary spans (`.grid` + `.s3..s12`), give each page one clear hero. Tabular numbers everywhere (`.num`).
- Responsive: must work at 1440, 1024 and 390 px with no horizontal page scroll (tables may scroll inside `.tw`).
  Touch targets ≥44px on mobile. Keyboard focus visible. Dialogs become bottom sheets on phones automatically.

## Foundation API (window.WM)

- Shell: `WM.shell({page})` renders sidebar, topbar (search Ctrl K, theme, notifications, role switcher), mobile nav, AI button.
  `WM.allowed` false = page blocked for current role (shell shows a lock state; your script must `return`).
- Store (localStorage, shared by all pages): `WM.store.get(k)`, `.set(k,v)`, `.find(k,id)`, `.add(k,obj)`, `.update(k,id,patch)`,
  `.remove(k,id)`, `.ensure(k,seed)` for NEW collections your page owns (seed once, then read with get).
  Core collections: members, accounts, categories, tx, budgets, goals, investments, assets, liabilities, insurances,
  requests (fund requests), notifications, profile. Inspect seeds at the top of wm.js.
- Helpers: `WM.member(id)`, `WM.account(id)`, `WM.cat(id)`, `WM.me()`, `WM.isOwner()`, `WM.visibleAccounts()`, `WM.canModifyTx(t)`,
  `WM.addTx/updateTx/removeTx/restoreTx` (adjust balances), `WM.monthTx(ym)`, `WM.spent(catId)`, `WM.income()`, `WM.totals()`.
- Format: `WM.rp(n, sign)`, `WM.short(n)` (Rp 1,2 jt), `WM.pct`, `WM.date(iso,long)`, `WM.dayLabel`, `WM.parseMoney`, `WM.today`.
- UI: `WM.icon(name,size)` (names in wm.js `P`), `WM.avatar(member,size)`, `WM.modal({title,sub,body,size:"sm"|"lg",submit,danger,onOpen(d,body),onSubmit(form,values,d) -> string error keeps open})`,
  `WM.confirm({title,text,confirm,danger}).then(ok)`, `WM.toast(msg,{undo,bad})`, `WM.popover(anchor,html)`, `WM.closePop()`.
- Forms: `WM.field({name,label,type:text|money|number|percent|date|select|textarea|email|password|tel,required,optional,value,options:[[v,l]],hint,placeholder,min,max,attrs})`,
  `WM.validate(form)`, `WM.setError(form,name,msg)`, `WM.readForm(form)` (money parsed to int), button radio groups:
  `<div data-radio="name" role="radiogroup"><button role="radio" data-v="x" aria-checked="true">` + `WM.radio(root)`; `WM.wire(root)` for money inputs outside modals.
- Transactions: `WM.openTx(editId?, preset?)`, `WM.openTxDetail(id)`, `WM.txRow(t)` (click opens detail automatically).
- Charts: `WM.chart.bars|area|waterfall|donut(box,opts)` (see wm.js comments), `WM.strip(items)`, `WM.legend(items)`,
  `WM.onResize(el,fn)`, `WM.onChange(keys,fn)`, `WM.download(name,text)`, `WM.csv(rows)`, `WM.copy(text,label)`, `WM.hscroll(wrap)`.
- CSS components: `.ph` page head, `.card`, `.cover`, `.headline em`, `.stat`, `.btn(.primary|.dark|.danger|.ghost|.sm)`, `.ibtn`,
  `.seg`, `.tabs`, `.chips-f`, `.pill(.good|.warn|.bad)`, `.chg.up/.dn`, `.list .row`, `.ic`, `.tbl` in `.tw`, `.track`, `.strip`,
  `.kv`, `.empty`, `.note(.warn|.bad)`, `.form .field .two .three`, `.affix`, `.check`, `.switch`, `.tiles .tile`, `.drop`,
  `.stepper`, `details.more-opts`, `.chart`, `.legend`, `.enter` (entrance animation).

## Verify (one batched round, then at most one fix round)

`cd docs/design/proto && node _shot.cjs yourpage.html` -> screenshots in /tmp/claude-1000/wm-shots, prints errors/overflow.
Open every dialog once in a quick playwright check or by reasoning; fix all errors. Do not loop on polish.

## Report

Write `docs/design/proto/_reports/<group>.md`: pages built, feature checklist mapped from the real source (feature -> where in
HTML), anything simulated, anything missing and why. Return only a 5-line summary.
