# How Indonesian KPR (mortgage) interest actually works — for app modeling

Research date: 2026-09-26. All web sources accessed 2026-09-26 unless noted. Figures are
"latest available 2026" where stated; several bank product pages did not expose full
tables to the fetch tool, so some numbers are **secondary-source (news/aggregator)
figures, not directly verified against the bank's own page** — flagged inline as
"(unverified primary)".

## 1. Common rate structures

Indonesian KPR (konvensional) is sold in four recurring shapes:

- **Single fixed period → floating.** E.g. fixed 1–5 years at a promo rate, then floats
  for the remaining tenor at the bank's prevailing floating/KPR rate. This is described as
  the most common combination scheme in the market. Source: [panduankeuangan.id — kombinasi fixed+floating](https://panduankeuangan.id/kpr/kpr-bunga-fixed-vs-floating) (accessed 2026-09-26).
- **Tiered/berjenjang fixed ("fixed berjenjang").** Rate steps up across several
  fixed-length blocks before floating, e.g. "5% year 1–2, 7% year 3–5, floating after."
  Bank Mandiri markets a named product "KPR Bunga Fixed Berjenjang" with tiers running up
  to 10 years, offered through 31 Mar 2026 for disbursement cut-off (exact per-year rate
  table did not render via fetch — **unverified primary**, page:
  [bankmandiri.co.id/en/kpr-bunga-fixed-berjenjang](https://www.bankmandiri.co.id/en/kpr-bunga-fixed-berjenjang), accessed 2026-09-26). Generic description of the "tahun 1–3 rendah,
  tahun 4–5 naik" pattern: [banksinarmas.com — fix berjenjang vs floating](https://www.banksinarmas.com/id/artikel/perbedaan-kpr-fix-berjenjang-floating) (accessed 2026-09-26).
- **Fixed for the (near) full tenor.** Rare/expensive commercially; the closest common
  full-tenor-fixed product in the market is the **FLPP subsidized loan at a flat 5%** (see
  §4) and some sharia murabahah contracts (see §5).
- **"Fixed + cap" floating** — not confirmed as a distinct named retail product at any
  major bank in the 2026 search results; Indonesian retail KPR floating is uncapped in the
  contracts surfaced. Treat as **uncommon/unconfirmed** for this market; do not assume caps
  exist unless a specific bank's contract states one.
- **Promo teaser rates.** BCA's 2026 promotional table (fetched directly) shows
  sub-market teaser fixed rates for a limited period, contingent on minimum tenor:
  - Fixed 1 year: 1.23% p.a. (min. tenor 6 years)
  - Fixed 2 years: 2.35% p.a. (min. tenor 6 years)
  - Fixed 3 years: 2.75% p.a. (min. tenor 10 years)
  - Fixed 5 years: 3.81% p.a. (min. tenor 12 years)
  - Regular (non-promo) fixed rates run 7.00–8.50% p.a. for 1–5 year fixed periods, with
    current floating quoted at ~11%.
  - Promo validity: "hingga 31 Oktober 2026"; KPR Sejahtera / take-over discount benefits
    through 31 Dec 2026.
    Source: [rumahsaya.bca.co.id — Suku Bunga KPR](https://rumahsaya.bca.co.id/id/info-kpr/Sukubunga-kpr) (accessed 2026-09-26, fetched directly).

**Typical fixed-period lengths across the market:** 1, 2, 3, or 5 years is standard;
tiered products can run structured blocks out to 8–20 years before floating.
Source: same BCA page + [banksinarmas.com](https://www.banksinarmas.com/id/artikel/perbedaan-kpr-fix-berjenjang-floating) (accessed 2026-09-26).

## 2. Floating rate mechanics

- **Basis:** Bank-set floating KPR rate, disclosed via each bank's **SBDK (Suku Bunga
  Dasar Kredit) KPR/KPA** category, which OJK requires banks to publish under **POJK No.
  37/2019 on Transparency and Publication of Bank Reports**. SBDK = cost of funds +
  overhead + margin, but **excludes the individual credit-risk premium** — so the actual
  rate offered to a borrower (SBDK + risk premium/spread) is higher than the published
  SBDK. Sources: [OJK — Suku Bunga Dasar Kredit](https://ojk.go.id/id/kanal/perbankan/Pages/Suku-Bunga-Dasar.aspx); [Bank Mandiri — SBDK Rupiah](https://www.bankmandiri.co.id/en/suku-bunga-dasar-kredit) (accessed 2026-09-26).
- **Latest 2026 SBDK KPR figures found:**
  - BCA: SBDK KPR/KPA **8.10%** effective 30 Jun 2026.
  - BTN: SBDK KPR/KPA **8.50%** effective 1 Jul 2026.
    (Both via aggregator summary, not the raw bank table — **unverified primary**; the BTN
    own page at [btn.co.id/SBDK](https://www.btn.co.id/SBDK) did not return content to the
    fetch tool.) Source for both figures: [peruriproperty.co.id — Suku Bunga KPR 2026 Terbaru](https://peruriproperty.co.id/suku-bunga-kpr-2026-terbaru-bi-rate-btn-mandiri-bca-bni-dan-bri/) (accessed 2026-09-26).
  - As of Nov 2025, OJK moved primary SBDK disclosure to a unified portal:
    [data.ojk.go.id/SJKPublic](https://data.ojk.go.id/SJKPublic) — the authoritative current
    source going forward; not independently queried in this pass.
  - Actual retail floating rate offered can run well above SBDK — BCA's own page quotes a
    current effective floating rate around **11%** (vs. its 8.10% SBDK), consistent with
    the "SBDK excludes risk premium" caveat above.
- **Change frequency / notification:** Not pinned to a fixed calendar cycle by regulation;
  banks review/republish SBDK periodically (observed cadence in these two examples:
  quarterly-ish — BCA end-Jun, BTN start-Jul). No explicit customer-notification-lead-time
  rule was found in this pass (e.g. "X days advance notice") — **mark as uncertain**;
  Indonesian KPR contracts typically reserve the bank's right to adjust the floating rate
  unilaterally with notice via statement/SMS, but the exact standard lead time was not
  confirmed from a primary source in this session.

## 3. Rate-change recalculation and interest accrual basis

- **Yes — re-annuitized on remaining balance and remaining tenor.** Multiple consistent
  descriptions: when the fixed period ends or a floating rate changes, the bank
  recalculates the installment using the **current outstanding principal and the
  remaining tenor** at the new applicable rate (annuity method), not a fresh full-tenor
  amortization. Sources: [skorlife.com — Cara Menghitung Bunga Floating KPR](https://skorlife.com/blog/kpr/cara-menghitung-bunga-floating-kpr/); [panduankeuangan.id](https://panduankeuangan.id/kpr/kpr-bunga-fixed-vs-floating) (both accessed 2026-09-26).
- **Amortization method:** Standard KPR uses the **annuity method** — nominal monthly
  installment is level, but the interest/principal split shifts over time (interest-heavy
  early, principal-heavy late). This is the near-universal method described across sources
  for both fixed and floating KPR. Source: [skorlife.com](https://skorlife.com/blog/kpr/cara-menghitung-bunga-floating-kpr/) (accessed 2026-09-26).
- **Interest accrual "rest" (harian/bulanan/tahunan):** Not directly confirmed with a
  primary bank source in this pass. Indonesian consumer-lending practice generally
  computes interest **monthly** on the outstanding balance within the annuity schedule
  (i.e., effective monthly compounding consistent with the annuity table), rather than a
  simple annual-rest or daily-rest scheme. **Treat as the standard assumption but mark
  uncertain** — no OJK/bank page in this session stated "bunga dihitung bulanan" explicitly
  for KPR; this should be verified against an actual bank amortization-schedule sample
  before hard-coding.

## 4. FLPP (subsidized KPR) and KPR Tapera — 2026

- **Rate:** Fixed **5% p.a.** for landed subsidized houses ("rumah tapak"), fixed **6%
  p.a.** for subsidized apartments ("rumah susun"), held flat for the **entire tenor** (not
  just an intro period). Sources: [Kementerian PKP via Antara](https://m.antaranews.com/amp/berita/5626232/kementerian-pkp-pastikan-bunga-flpp-tetap-5-persen-hingga-akhir-tenor); [medcom.id — Rumah Subsidi 2026](https://www.medcom.id/properti/news-properti/4KZQOZ6k-rumah-subsidi-2026-bunga-5-dan-syarat-terbaru-flpp) (both accessed 2026-09-26).
- **Max tenor:** Historically capped at 20 years; **raised to up to 40 years** via
  Ministerial Decree (Kepmen PKP) **No. 1722/KPTS/M/2026**, signed 6 Aug 2026, approved by
  Komite Tapera. Rate stays 5% regardless of tenor length. As of this research date,
  implementation details (max borrower age, debt-capacity formula, whether all banks apply
  40-year uniformly) were still pending BP Tapera's technical guidelines ("petunjuk
  pelaksanaan"). Source: [receh.in — BTN Sambut KPR Subsidi 40 Tahun](https://www.receh.in/2026/09/btn-sambut-kpr-subsidi-40-tahun-bunga.html) (accessed 2026-09-26).
- **Down payment:** From 1% (with government SBUM — Subsidi Bantuan Uang Muka — topping
  up the down payment). Source: [medcom.id](https://www.medcom.id/properti/news-properti/4KZQOZ6k-rumah-subsidi-2026-bunga-5-dan-syarat-terbaru-flpp) (accessed 2026-09-26).
- **Eligibility:** MBR (low-income) with max monthly income **Rp 8,000,000** (general) or
  **Rp 10,000,000** (Papua/Papua Barat region), min. 12 months Tapera participation, never
  previously received government housing assistance. Source: [propertibagus/Linktown summary via search](https://www.linktown.co.id/blog/simulasi-kpr-tapera-2026-gaji-umr-bisa-punya-rumah-tipe-apa/); cross-checked with medcom.id (accessed 2026-09-26).
- **Price caps (2026), per Kepmen PKP No. 23/2026, signed 5 Apr 2026** — max subsidized
  house price by zone:
  - Java (ex-Jabodetabek) & Sumatra (ex-Riau Islands, Bangka Belitung, Mentawai Islands): **Rp 166,000,000**
  - Kalimantan (ex-Murung Raya, Mahakam Ulu): **Rp 182,000,000**
  - Sulawesi, Bangka Belitung, Mentawai Islands, Riau Islands (ex-Anambas): **Rp 173,000,000**
  - Maluku, North Maluku, Bali, Nusa Tenggara, Jabodetabek, Anambas Islands, Murung Raya, Mahakam Ulu: **Rp 185,000,000**
  - Papua, West Papua, Central Papua, Papua Highlands, Southwest Papua, South Papua: **Rp 240,000,000**
    Source: [Kompas — Cicilan Rumah Subsidi (batas harga 2026)](https://www.kompas.com/properti/read/2026/07/30/130000521/cicilan-rumah-subsidi-cuma-rp-500.000-sebulan-cek-batas-harga-2026) (accessed 2026-09-26).
- **2026 program scale (context, not modeling-critical):** target ~350,000 units, budget
  ~Rp 37.1 trillion. Source: same medcom.id article (accessed 2026-09-26).
- **KPR Tapera vs FLPP:** From the sources gathered, "KPR Tapera" in 2026 discourse is
  effectively **the same 5%/6% fixed-rate, BP-Tapera-administered subsidized scheme** as
  FLPP (BP Tapera manages FLPP disbursement); no distinct non-FLPP "KPR Tapera" commercial
  product with different terms was found. **Treat FLPP and "KPR Tapera" as the same
  scheme for modeling purposes** unless a later source distinguishes them. Source:
  [kumparan.com — KPR 40 Tahun Disetujui Komite Tapera](https://kumparan.com/kumparanbisnis/kpr-40-tahun-disetujui-komite-tapera-bunga-untuk-rumah-subsidi-tetap-5-persen-27ey3rd3fV4) (accessed 2026-09-26).

## 5. KPR Syariah — murabahah vs. MMQ/ijarah

- **Murabahah (fixed-margin, most common structure marketed):** Bank buys the property and
  resells to the customer at cost **plus an agreed profit margin fixed from day one to
  final payoff** → **flat installment for the entire tenor**, closest analog to a
  full-tenor fixed conventional loan. BSI markets promotional murabahah-style margins
  around **3.3% in year 1**, with typical fixed-margin ranges quoted at **4.5%–6% p.a.**
  for the initial 1–5 year period (**unverified primary** — pulled from search snippet, not
  BSI's own page directly). Source: [kalkulatorkpr.id — Simulasi KPR BSI Syariah 2026](https://kalkulatorkpr.id/simulasi-kpr-bsi-syariah/) (accessed 2026-09-26).
- **MMQ (Musyarakah Mutanaqisah) / ijarah, floating-like structure:** Bank and customer
  co-own the property; customer buys out the bank's share gradually while paying rent
  (ijarah) on the bank's remaining share. After an initial period the bank can **reset the
  profit-sharing ratio / rental rate** based on market funding costs — behaviorally similar
  to conventional floating: the installment can rise materially depending on market
  conditions. Source: [BSI — Edukasi Pembiayaan KPR Sesuai Prinsip Syariah](https://www.bankbsi.co.id/news-update/edukasi/pembiayaan-kpr-sesuai-prinsip-syariah); cross-checked via search summary (accessed 2026-09-26).
- **Modeling implication:** murabahah = model as a single fixed-rate period covering the
  full tenor (rate never changes). MMQ/ijarah = model as fixed period(s) followed by a
  "floating-like" reset period, functionally identical to the conventional
  fixed→floating case even though it's legally profit-sharing/rent rather than interest.

## 6. Other money-relevant features

- **Early repayment penalty (pelunasan dipercepat):** Commonly **1–3% of remaining
  principal**, with a wider cited range of **1–7%** depending on the bank and where in the
  fixed/floating lifecycle the payoff happens — penalties are typically **stricter during
  the fixed-rate period** and many banks **waive or reduce the penalty once the loan has
  moved into the floating period**. The exact percentage is contract-specific and must be
  read from the individual credit agreement. Source: [idscore.id — Hitung Biaya Penalti KPR](https://www.idscore.id/articles/hitung-biaya-penalti-kpr-jika-pelunasan-dipercepat); [panduankeuangan.id — Penalti Pelunasan Dipercepat KPR](https://panduankeuangan.id/kpr/penalti-pelunasan-dipercepat-kpr) (both accessed 2026-09-26).
- **Full-payoff cost components:** remaining principal + penalty + "biaya administrasi
  pengakhiran" (closing admin fee) + "biaya roya" (collateral/mortgage-release
  deregistration fee at the land office). Source: same idscore.id article (accessed 2026-09-26).
- **Partial prepayment — reduce tenor vs. reduce installment:** Not explicitly confirmed
  with a bank source in this pass; general Indonesian retail-lending practice (per the
  early-repayment articles surveyed) frames partial prepayment mechanics as
  negotiable/bank-policy-dependent (some let the customer choose to shorten tenor or lower
  the installment). **Mark as uncertain / needs a direct bank-contract confirmation** —
  no page explicitly stated the default choice or whether the customer can pick.
- **Provisi (origination) fee:** Commonly **1% of the approved loan amount** across BCA,
  Mandiri, and BRI per one aggregator comparison (**unverified primary** — not confirmed
  against each bank's own fee schedule individually). Source: [search-engine synthesis, sourced from rumatemu.com / rooma21.com / rumah123.com comparison pages] (accessed 2026-09-26).
- **Admin fee:** BCA admin fee **Rp 500,000–1,000,000**; BCA appraisal fee
  **Rp 1,100,000–1,500,000** (general market appraisal fee range cited elsewhere as
  Rp 350,000–750,000, so BCA appears above the generic range — **unverified primary**,
  pulled from a search snippet rather than BCA's fee-schedule page directly).
- **2026 promo:** BCA is running **75% provisi discount + free admin fee** for applications
  realized by **31 Dec 2026**. Source: same search synthesis as above (accessed 2026-09-26,
  **unverified primary** — could not confirm on BCA's own page in this pass).
- **Grace periods:** No specific 2026 Indonesian-bank KPR grace-period terms were found in
  this research pass — **not confirmed either way**; do not assume a standard grace period
  exists without a specific contract reference.

## 7. Recommended data model for the app

Minimal shape to represent every scheme above without hard-coding bank-specific logic:

```ts
type RatePeriod = {
  startMonth: number; // 1-indexed month of the loan, inclusive
  endMonth: number | null; // null = runs to end of tenor (or until superseded)
  rate: number; // annual nominal rate, e.g. 0.05 for 5%
  rateType: "fixed" | "floating";
  // for floating periods only — how the rate is sourced/updated:
  floatingBasis?:
    | "sbdk_plus_margin"
    | "manual_user_entry"
    | "reference_rate_plus_margin";
  margin?: number; // spread added to the basis, if applicable
};

type FloatingRateEvent = {
  effectiveMonth: number; // month the new rate takes effect
  newRate: number; // annual nominal rate at that point
  source: "bank_notice" | "user_entered" | "sbdk_published";
  recordedAt: string; // ISO date the user/app logged this change
};

type Loan = {
  principal: number;
  tenorMonths: number;
  startDate: string;
  scheme: "konvensional" | "flpp" | "syariah_murabahah" | "syariah_mmq_ijarah";
  ratePeriods: RatePeriod[]; // ordered, covers the whole tenor (last entry's
  // endMonth = null or = tenorMonths)
  floatingRateHistory: FloatingRateEvent[]; // actual rate changes the user has recorded
  recomputeRule: "re_annuitize_remaining_balance_and_tenor"; // the only rule observed;
  // keep as an explicit field in case a
  // fixed-installment/extend-tenor variant is confirmed
  prepayments: {
    date: string;
    amount: number;
    effect: "reduce_tenor" | "reduce_installment"; // user-chosen or bank default; expose
    // as a choice since default is unconfirmed
  }[];
  earlyPayoffPenaltyPct?: number; // % of remaining principal, user/contract-entered
  provisionFeePct?: number; // one-time, % of principal at disbursement
  adminFee?: number; // flat IDR
};
```

Computation rule: at loan start and at every `ratePeriods` boundary or
`floatingRateHistory` entry, **re-run annuity amortization on the current outstanding
principal over the remaining number of months**, using the rate effective as of that
month. This single rule reproduces: plain fixed-then-floating, tiered/berjenjang fixed,
full-tenor fixed (murabahah, FLPP — one `RatePeriod` covering the whole tenor), and
MMQ/ijarah (model its rental resets as `floating` periods).

**Sensible presets to ship:**

- **FLPP preset:** one fixed `RatePeriod` at 5% (landed) or 6% (apartment) for the full
  tenor (up to 480 months / 40 years), no floating segment, `provisionFeePct` and
  `adminFee` defaulted to 0 (commonly subsidized/waived — **not independently confirmed in
  this pass, verify before shipping as a hard default**).
- **Konvensional preset:** fixed period 12/24/36/60 months at a user-entered promo rate,
  followed by one open-ended `floating` period seeded with the bank's published SBDK +
  a default margin (start with the observed ~3 pp gap between BCA's SBDK 8.10% and its
  quoted floating ~11% as a rough default margin — **treat as a rough heuristic, not a
  verified rule**, and let the user override).
  - Berjenjang preset: same shape, just multiple sequential `fixed` `RatePeriod`s before
    the floating tail.
- **Murabahah preset:** one fixed `RatePeriod` for the full tenor.
- **MMQ/ijarah preset:** one fixed `RatePeriod` for an initial period, then `floating`
  periods the user updates manually (no published index equivalent to SBDK was found for
  Islamic financing in this pass).

## Uncertainties to resolve before hard-coding

1. Exact floating-rate change notification lead time / channel (regulatory or standard
   contract term) — not found.
2. Interest accrual "rest" convention (daily/monthly/annual) for KPR specifically — assumed
   monthly-within-annuity, not confirmed against a primary bank amortization table.
3. Default behavior of partial prepayment (reduce tenor vs. reduce installment) — likely
   bank-policy/customer-choice, not confirmed.
4. Whether "KPR Tapera" is fully identical to FLPP or has any distinct commercial variant.
5. Several fee figures (provisi %, BCA admin/appraisal ranges, MMQ/ijarah reset mechanics)
   came from search-engine synthesis rather than a directly fetched bank page — flagged
   "unverified primary" inline; re-verify against the bank's own fee schedule page before
   using as a shipped default.
