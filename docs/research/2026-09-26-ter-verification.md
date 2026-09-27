# PPh 21 TER Table Verification (PP 58/2023 Lampiran)

## Source

- **Peraturan Pemerintah Nomor 58 Tahun 2023** — "Tarif Pemotongan Pajak Penghasilan
  Pasal 21 Atas Penghasilan Sehubungan Dengan Pekerjaan, Jasa, Atau Kegiatan Wajib
  Pajak Orang Pribadi", official copy from BPK JDIH:
  `https://peraturan.bpk.go.id/Download/332609/PP%20Nomor%2058%20Tahun%202023.pdf`
  (SHA/local snapshot: `pp58.pdf`, 25 pages, downloaded and text-extracted for this check).
- Cross-checked page numbers refer to the Lampiran huruf A/B/C (PP 58/2023, pp. 11–14
  of the printed PDF / "SK No 190042A" etc. watermark range).
- Secondary corroborating download: **PMK 168 Tahun 2023** (`pajak.go.id`,
  `https://pajak.go.id/sites/default/files/2024-02/PMK%20168%20Tahun%202023%20Tentang%20PPh%20Pasal%2021%20TER.pdf`)
  — not needed for the table numbers since PP 58/2023 Lampiran itself contains the
  authoritative band table; downloaded but not required for this verification.
- Access date: **2026-09-26**.

## Method

Downloaded the PP 58/2023 PDF via `curl`, extracted text with `pypdf` (no `pdftotext`
binary available in this environment), located `LAMPIRAN` → `A. TARIF EFEKTIF BULANAN
KATEGORI A` / `B. ...KATEGORI B` / `C. ...KATEGORI C`, and manually reconstructed every
`di atas X sampai dengan Y → tarif Z%` row (OCR output has character-substitution noise —
e.g. "O" for "0", "l" for "1" — but the numeric intent is unambiguous from the
parenthetical Indonesian-words restatement of each amount). Compared every row's
upper bound and rate against the plan's `TER_A` / `TER_B` / `TER_C` arrays in
`docs/superpowers/plans/2026-09-26-revisi-l-pajak-2026.md` (lines 562–692).

## Result: full match

| Table | Bands in plan | Bands in PP 58/2023 Lampiran | Mismatches |
| ----- | ------------- | ---------------------------- | ---------- |
| A     | 44            | 44                           | 0          |
| B     | 40            | 40                           | 0          |
| C     | 41            | 41                           | 0          |

**Every `upTo` value and every rate (in bps, i.e. %×100) in the plan's `TER_A`,
`TER_B`, and `TER_C` arrays matches the official PP 58/2023 Lampiran huruf A, B, C
exactly**, band for band, including the final open-ended "di atas Rp1.400.000.000 /
Rp1.405.000.000 / Rp1.419.000.000" → 34% row in each table. No corrections are needed;
the plan's `verified: false` label can be changed to `verified: true` (source:
PP 58/2023 Lampiran, not PMK 168/2023 as currently cited — PMK 168/2023 is the
_procedural_ implementing regulation; the _rate tables_ themselves are Lampiran to
PP 58/2023).

No corrected YAML block is included below since no mismatch was found. For
completeness, the verified table (band shape identical to the plan's) is:

```yaml
ter_tables:
  source: "PP 58/2023, Lampiran huruf A, B, C"
  verified: true
  A: *unchanged_from_plan_TER_A*   # 44 bands, matches exactly
  B: *unchanged_from_plan_TER_B*   # 40 bands, matches exactly
  C: *unchanged_from_plan_TER_C*   # 41 bands, matches exactly
```

## PTKP-status → category mapping

Confirmed against PP 58/2023 Pasal 2 ayat (4):

- **Kategori A**: TK/0 (tidak kawin tanpa tanggungan), TK/1 (tidak kawin, 1 tanggungan),
  K/0 (kawin tanpa tanggungan).
- **Kategori B**: TK/2, TK/3, K/1, K/2.
- **Kategori C**: K/3.

This matches the plan's mapping exactly (`A = TK/0, TK/1, K/0; B = TK/2, TK/3, K/1,
K/2; C = K/3`) — **mapping confirmed**.

## TER harian (daily/non-permanent table)

Not checked in detail: the plan explicitly puts "TER harian (daily-wage TER table)"
in its out-of-scope list (line 169: "Pension recipients' biaya pensiun, TER harian
(daily-wage TER table), founder-share 0,5% surcharge, koperasi/PT UMKM time limits,
the pre-2022 Pasal 17 structure."), so the plan does not transcribe or rely on a daily
TER table anywhere in `pph21.rules.ts`. No verification needed for this task. (For the
record, PP 58/2023 Pasal 2 ayat (6) points to "Lampiran huruf D" for the daily rate
table, confirming it exists as a separate table not touched by this plan.)
