# Public group report

Built 9 pages in `docs/design/proto/`: `landing.html`, `login.html`, `register.html`,
`lupa-password.html`, `reset-password.html`, `konfirmasi-email.html`, `ubah-password.html`
(maps to real `ubah-password-wajib`), `join.html` (`?token=`), `legal.html` (`?doc=privasi|syarat|lisensi`).
All include `wm.css`+`wm.js`, use `WM.field/validate/readForm/toast/store`, never call `WM.shell`.
Split layout: dark `.acover` brand/value panel + white form card on `≥960px`, stacked on phone.
Verified with `_shot.cjs` on all 9 files at 1440/390: no console errors, no horizontal overflow.
Also spot-checked `?token=` happy paths for reset-password/join/konfirmasi-email via a throwaway Playwright script (not saved).

## Feature checklist (real source → prototype)

**landing.html** — real `app/page.tsx` is only an auth-redirect splash (no marketing copy in
source), so this page is net-new content in the bento/Persuade visual world per the task brief,
with links to `login.html`/`register.html`. Flagged as simulated/expanded beyond real source.

**login.html** (`app/login/page.tsx`) — Email/Username tabs, demo-account notice
(`demo@wealthme.id`/`demo1234`), family-login-id hint (`budi@arsandi`), password show/hide,
inline error, "Lupa password?" (email mode only), Google button, register link, legal footer
links. Added a quick-account picker (`.quick`, sourced from `WM.store.get("members")`) so every
role (`master/spouse/child/staff`) is reachable — clicking or submitting sets
`wm-proto-v1:me` and routes to `index.html` (owner roles) or `akses-saya.html` (child/staff),
toast "(simulasi)". PIN unlock and "Ingat saya" correctly omitted (dead in real source too).

**register.html** — name/email/password/confirm fields, live password-strength meter (4-level,
same scoring rule as source), password mismatch, ID/EN language tabs (real toggle — swaps this
page's own copy via a small dict, not just cosmetic), "rekening pertama ditambahkan setelah
daftar" notice, consent checkbox correctly omitted (dead control in source), legal footer.

**lupa-password.html** — email form → "Cek email kamu" sent state (honest non-enumerating copy),
username-account hint pointing to IAM Roles, "Coba lagi", back-to-login.

**reset-password.html** — no-token invalid state with "Minta link baru"; token present → new
password + confirm, live 2-rule checklist (min 8 chars, confirm match) matching the source's
trimmed (non-fake) rule set, mismatch inline error, redirects to login on submit.

**konfirmasi-email.html** — loading → done (shows confirmed email) / error states from
`?token=`; no token → "Link tidak lengkap"; `token=invalid` demos the error path.

**ubah-password.html** — forced password change: identity row (avatar+name+role from
`WM.me()`), "tidak bisa dilewati" warning, current/new/confirm fields, 8-char + match validation,
logout button. Head-resets-member-password note correctly omitted (no backend support, same as
source's own comment).

**join.html** — invitation state machine from `?token=`: loading → invalid (no token) → valid
(family name/email/role, simulated from token) with Masuk/Daftar buttons when logged out or
"Terima undangan" when a `wm-proto-v1:me` session exists → accepted state → redirect to login.

**legal.html** — full text of all 3 real legal pages (Kebijakan Privasi, Syarat & Ketentuan,
Lisensi Open Source incl. all 15 libraries), draft banner, cross-links, `?doc=` tab switch.

## Simulated (honest UI notes on-page)

Login/Google/register/reset/confirm/accept-invite all resolve instantly with a toast noting
"(simulasi)" where relevant — no real backend exists in this static prototype.
