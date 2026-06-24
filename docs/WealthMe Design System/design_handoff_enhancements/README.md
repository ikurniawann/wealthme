# Handoff: Terapkan WealthMe Design System (lapisan enhancement) ke `wealthme-web`

## Ringkasan

Design system di proyek ini **diturunkan 1:1 dari `apps/web/src/app/globals.css`** milik repo `andrsrjld/wealthme-web`. Artinya **fondasi brand sudah identik** dengan kode kamu sekarang — warna, Sora/DM Mono, radius 14px, gradient (`gradient-wealth/profile/ai`), token semantic & chart, dark mode, dan preset `data-theme`. **Tidak ada yang perlu dipasang ulang di lapisan token.**

Yang baru adalah **lapisan enhancement** (hasil iterasi UI/UX yang kamu setujui):

1. **Count-up** pada angka besar (net worth, total investasi).
2. **Hover-lift** pada kartu KPI / aset / liabilitas / goal.
3. **Ikon Lucide ber-tint** menggantikan emoji glyph kategori (chip warna soft).
4. **Stagger entrance** (fade-up berurutan) saat halaman masuk.
5. **Progress fill-on-mount** (bar mengisi dari 0).
6. **Strip status** tipis di atas kartu goal (bukan border kiri).

> ⚠️ File HTML di `ui_kits/wealthme-app/*` adalah **referensi desain (prototipe)**, bukan kode produksi untuk disalin mentah. File `.tsx`/`.css` di folder handoff ini **memang ditulis dalam idiom repo-mu** (Tailwind + `cn()` + lucide-react) dan bisa langsung ditempel.

**Fidelity: high.** Warna, ukuran, weight, easing semuanya final.

---

## Cara menerapkan (urутан yang disarankan)

### Langkah 0 — Tidak perlu menyentuh token

`globals.css` kamu sudah = design system ini. Lewati.

### Langkah 1 — Tambahkan keyframes motion ke `globals.css`

Tempel isi `globals-additions.css` ke akhir `apps/web/src/app/globals.css`. Ini menambah `@keyframes wm-rise / wm-pop`, util `.animate-rise`, dan guard `prefers-reduced-motion`. (Catatan: `globals.css` ada di daftar "Never modify" pada CLAUDE.md — ini satu-satunya pengecualian yang perlu kamu setujui; hanya menambah keyframes, tidak mengubah token apa pun.)

### Langkah 2 — Drop primitive baru ke `components/wm/`

> Catatan: file kode di bundel ini berakhiran `.txt` (`wm-motion.tsx.txt`, dst.) agar tidak ikut dikompilasi oleh design-system ini. **Buang akhiran `.txt`** saat menaruhnya di repo.

- `wm-motion.tsx.txt` → `apps/web/src/components/wm/motion.tsx`
  - `useCountUp(target, durationMs)` — hook angka naik dari 0.
  - `<CountUpRupiah value formatter />` — pembungkus siap pakai (pakai `formatRupiah` kamu).
  - `<AnimatedProgress value color />` — membungkus `ProgressBar` kamu, mengisi dari 0 saat mount.
  - `<Rise index>` — wrapper stagger entrance.
- `wm-icon-chip.tsx.txt` → `apps/web/src/components/wm/icon-chip.tsx`
  - `<IconChip icon={LucideIcon} className iconClassName size />` — chip ikon ber-tint.

Lalu re-export dari `components/wm/index.tsx`:

```ts
export * from "./motion";
export { IconChip } from "./icon-chip";
```

### Langkah 3 — Util Tailwind untuk hover-lift & status strip

Pakai class langsung (tanpa file baru):

```tsx
// Hover-lift kartu
className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1
           hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]"

// Strip status di atas kartu (kartu butuh overflow-hidden)
<div className="h-[3px]" style={{ background: statusColor }} />
```

### Langkah 4 — Terapkan per halaman (lihat tabel di bawah)

Lakukan satu halaman per PR. Mulai dari **Beranda** (paling terlihat), lalu Investasi, Aset, Tujuan, Liabilitas, Anggaran, Transaksi.

---

## Pemetaan enhancement → file kode nyata

| Halaman    | File repo                       | Ubah                                                                                                                                            |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- | ---- | ----------------------------------------------------------------------------------------------------- |
| Beranda    | `app/(app)/beranda/page.tsx`    | Hero `formatRupiah(netWorth)` → `<CountUpRupiah value={netWorth} />`; `SummaryCard` bungkus hover-lift + emoji → `<IconChip icon={Landmark      | Wallet                                                    | TrendingUp | Home | CreditCard} .../>`; bungkus kartu dengan `<Rise index={i}>`; `ProgressBar`goal →`<AnimatedProgress>`. |
| Investasi  | `app/(app)/investasi/page.tsx`  | `totalCurrentValue` → `<CountUpRupiah>`; baris tabel tetap.                                                                                     |
| Aset       | `app/(app)/aset/page.tsx`       | Emoji jenis aset → `IconChip`; KPI hover-lift.                                                                                                  |
| Tujuan     | `app/(app)/tujuan/page.tsx`     | Ganti `border-2` berwarna penuh → kartu `overflow-hidden` + strip 3px atas; emoji → `IconChip`; `ProgressBar` → `AnimatedProgress`; hover-lift. |
| Liabilitas | `app/(app)/liabilitas/page.tsx` | Emoji 💳/📋 → `IconChip icon={CreditCard                                                                                                        | FileText}`; `ProgressBar`→`AnimatedProgress`; hover-lift. |
| Anggaran   | `app/(app)/anggaran/page.tsx`   | Emoji kategori → `IconChip`; `ProgressBar` → `AnimatedProgress`.                                                                                |
| Transaksi  | `app/(app)/transaksi/page.tsx`  | Emoji 📥/💳/↗️ → `IconChip` bulat (`rounded-full`); `<Rise>` per grup hari.                                                                     |

### Peta emoji → ikon Lucide (kelas tint)

| Kategori        | Lucide           | Chip class                      |
| --------------- | ---------------- | ------------------------------- |
| Bank / rekening | `Landmark`       | `bg-blue-100 text-blue-600`     |
| E-wallet / kas  | `Wallet`         | `bg-green-100 text-green-600`   |
| Investasi       | `TrendingUp`     | `bg-violet-100 text-violet-600` |
| Properti        | `Home`           | `bg-yellow-100 text-yellow-600` |
| Liabilitas      | `CreditCard`     | `bg-red-100 text-red-600`       |
| Pemasukan       | `ArrowDownLeft`  | `bg-green-100 text-green-600`   |
| Pengeluaran     | `CreditCard`     | `bg-red-100 text-red-600`       |
| Transfer        | `ArrowLeftRight` | `bg-violet-100 text-violet-600` |
| Goal pendidikan | `GraduationCap`  | `bg-blue-100 text-blue-600`     |

---

## Design tokens (sudah ada di `globals.css`)

Indigo `--primary #4F46E5`; success `#10B981`; warning `#F59E0B`; destructive `#EF4444`; brand-purple `#8B5CF6`. Radius base 14px. Font Sora / DM Mono. Chart `--chart-1..5`. Semua **sudah ada** — referensikan, jangan tulis ulang.

## Interaksi & motion (final)

- Entrance: `wm-rise .5s cubic-bezier(.22,.61,.36,1) both`, delay `index * 70ms`.
- Count-up: easing `1 - (1-p)^3`, durasi 1200ms.
- Hover-lift: `translateY(-4px)` + shadow `0 12px 28px rgba(15,23,42,.10)`, 180–200ms.
- Progress: transisi width 700ms, isi dari 0 saat mount.
- Semua dibungkus `@media (prefers-reduced-motion: reduce)` → nonaktif.

## File referensi (prototipe HTML)

- `reference-screen-beranda-enhanced.jsx.txt` (logika enhanced Beranda)
- `reference-kit-helpers.jsx.txt` (hook count-up / AnimatedBar / IconChip versi prototipe)
- `ui_kits/wealthme-app/index.html` + `screen-*.jsx` — di proyek design system.

## Menerapkan via Claude Code

Repo kamu sudah punya workflow Claude Code. Unduh skill design system ini (root `SKILL.md`) atau folder ini, taruh di repo, lalu jalankan per-halaman:

> "Terapkan enhancement dari `design_handoff_enhancements/README.md` ke `app/(app)/beranda/page.tsx` — pakai komponen `components/wm/motion.tsx` dan `icon-chip.tsx`. Satu PR."
