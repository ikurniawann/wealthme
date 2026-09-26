# Indonesian Personal/Household Tax Rules — Research Note

Scope: individual taxpayers (employees, freelancers, small business owners, investors), for a family personal-finance app. Period covered: Prabowo administration (from 20 Oct 2024) through **26 Sep 2026** ("today"). Marks changes vs pre-Oct-2024 baseline and anything announced but not yet effective. Access date for all sources below: **2026-09-26**, via web search (search-result snippets, not always full primary-document fetch — flagged per item).

> **Disclaimer**: This was compiled via web search summaries of primary/secondary sources, not full verbatim reading of every gazetted PDF. Anything not confirmed against an actual `.pdf`/`peraturan.bpk.go.id` full text is marked **UNVERIFIED** and should be double-checked before being hard-coded into tax logic used for real filings.

---

## 1. PPh 21 — Employees (TER monthly withholding + December true-up)

- **Legal basis**: PP 58/2023 (27 Dec 2023) + PMK 168/2023 (29 Dec 2023). Effective **1 Jan 2024** (pre-Prabowo, still in force).
  - https://pajak.go.id/sites/default/files/2024-02/PMK%20168%20Tahun%202023%20Tentang%20PPh%20Pasal%2021%20TER.pdf
  - https://jdih.kemenkeu.go.id/dok/pmk-168-tahun-2023/summary
- **TER categories → PTKP mapping**:
  - **Kategori A**: PTKP TK/0 (Rp54jt/yr), TK/1 & K/0 (Rp58.5jt/yr). Monthly rate 0% up to Rp5.4jt gross/month, scaling to 34% above ~Rp1.4B/month.
  - **Kategori B**: PTKP TK/2 & K/1 (Rp63jt/yr), TK/3 & K/2 (Rp67.5jt/yr). ~40 rate bands, max 34%.
  - **Kategori C**: PTKP K/3 (Rp72jt/yr). 0% up to Rp6.6jt/month, up to 34% above ~Rp1.419B/month.
  - (Two independent search passes gave slightly different TK/K pairings for category B — cross-checked, treated as reliable at the category level, but exact clause number **UNVERIFIED**.)
- **December true-up**: Monthly withholding uses TER (a flat lookup rate per category/income band); this is NOT the final tax. In December (or the last month of employment in a tax year), the employer recalculates PPh 21 for the full year using the **Pasal 17 progressive brackets** on annual net income (gross − biaya jabatan − pension/JHT contributions − PTKP), then subtracts tax already withheld Jan–Nov via TER. The difference (positive or negative) is settled in the December payroll run. Exact PMK 168/2023 article number for this mechanism **UNVERIFIED** — corroborated only via secondary tax-advisory sites, not the primary PDF text itself.
- **2025/2026 change — PPh 21 DTP (Ditanggung Pemerintah) incentive** (Prabowo-era stimulus, no pre-Oct-2024 equivalent at this scale):
  - **2025**: PMK 10/2025 — covers footwear, textile & apparel, furniture, leather/leather-goods sectors (56 KLU/business classifications). Eligibility: permanent employees with fixed gross income ≤ Rp10,000,000/month; non-permanent/daily employees with average daily wage ≤ Rp500,000. Period: Jan–Dec 2025. Mechanism: employer pays the withheld PPh 21 amount in cash to the employee alongside wages (i.e., employee take-home is NOT reduced by PPh 21); amount is not counted as employee's taxable income. Later expanded by **PMK 72/2025** (~Oct 2025) to include the **tourism sector**.
    - https://www.pajak.go.id/en/node/115043
    - https://www.pajak.go.id/en/node/115484
  - **2026 continuation**: **PMK 105/2025** — same sectors (footwear, textile/apparel, furniture, leather, + tourism), same caps (permanent ≤ Rp10jt/month; non-permanent ≤ Rp500rb/day or ≤ Rp10jt/month), period Jan–Dec 2026. Requires employee NIK/NPWP validated & integrated with DJP's Coretax system. **Confirmed currently in force as of Sep 2026**, not merely proposed.
    - https://www.pajak.go.id/en/node/118927

## 2. Pasal 17 UU HPP — Progressive Brackets (Pajak Orang Pribadi)

**Confirmed unchanged** through Sep 2026:

| Bracket                           | Rate |
| --------------------------------- | ---- |
| Up to Rp60,000,000                | 5%   |
| > Rp60,000,000 – Rp250,000,000    | 15%  |
| > Rp250,000,000 – Rp500,000,000   | 25%  |
| > Rp500,000,000 – Rp5,000,000,000 | 30%  |
| > Rp5,000,000,000                 | 35%  |

- **Legal basis**: UU No. 7 Tahun 2021 (UU HPP), Pasal 17 (amended the base PPh law, UU 36/2008; the 60jt/250jt/500jt/5M/35% structure replaced the old 50jt/250jt/500jt/30%-top 4-bracket structure).
- No amending PP/PMK found for 2025 or 2026 — brackets remain current as of 2026-09-26. Confirmed consistent across multiple 2026-dated secondary sources (pajakku.com, talenta.co).
- **UNVERIFIED at primary-text level**: did not pull the full UU 7/2021 text from peraturan.bpk.go.id directly; recommend doing so before hard-coding for production use.

## 3. PTKP (Penghasilan Tidak Kena Pajak)

| Component                               | Amount/year      |
| --------------------------------------- | ---------------- |
| Base (WP orang pribadi)                 | Rp54,000,000     |
| + Married (kawin)                       | Rp4,500,000      |
| + Per dependent (max 3)                 | Rp4,500,000 each |
| + Wife's income combined with husband's | Rp54,000,000     |

- **Legal basis**: PMK No. 101/PMK.010/2016, signed 22 Jun 2016, enacted 27 Jun 2016. (Raised PTKP base from Rp36,000,000 under the prior PMK 122/PMK.010/2015.)
- **No change found for 2025/2026.** The TER categories (item 1) are simply a re-bundling of these same PTKP amounts into withholding lookup tables — PTKP itself has not been revised since 2016.
- https://setkab.go.id/penghasilan-sampai-rp-54-jutatahun-kini-tidak-kena-pajak/ (secondary, summarizing the PMK)
- Primary PDF (not directly fetched — **UNVERIFIED** at that level): https://jdih.kemenkeu.go.id/api/download/fulltext/2016/101~PMK.010~2016Per.pdf

## 4. Deductions from Gross Income (PPh 21 / PPh OP)

- **Biaya jabatan**: 5% of gross income, capped at **Rp500,000/month** or **Rp6,000,000/year**.
- **Biaya pensiun** (for pension recipients): 5% of gross, capped at **Rp200,000/month** or **Rp2,400,000/year**.
  - Attributed to PMK 168/2023 by secondary sources; exact article number **UNVERIFIED**.
- **Iuran pensiun / JHT (BPJS)**: only the **employee's own contribution portion** is deductible from gross income (e.g. for JHT, employee pays 2% of the combined 3.7%+2% split — that 2% is deductible; the employer's 3.7% portion is not, since it isn't the employee's income to begin with). **UNVERIFIED against a primary PMK/PP** — sourced from secondary tax-advisory content only.
- **Zakat / sumbangan keagamaan wajib**: deductible from gross income **if channeled through a government-recognized amil zakat body** (BAZNAS or an officially registered LAZ). Legal basis: **PP No. 60 Tahun 2010** + implementing **PMK 254/PMK.03/2010**. Proof of payment (receipt) must be attached to the SPT Tahunan. No 2025/2026 change found — long-standing rule, still current.
- **NPPN (Norma Penghitungan Penghasilan Neto)** — for freelancers/professionals/business owners who don't keep full books (or won't disclose them): net income = NPPN% × gross turnover. Legal basis: **PER-17/PJ/2015** (Dirjen Pajak regulation). Percentages vary by (a) business/profession type and (b) region tier: (i) 10 provincial capitals (Jakarta, Medan, Palembang, Bandung, Semarang, Surabaya, Denpasar, Manado, Makassar, Pontianak), (ii) other provincial capitals, (iii) other regions. **The actual percentage table (Lampiran I/II/III) was NOT retrieved — UNVERIFIED, needs a direct PDF pull**: https://www.pajak.go.id/sites/default/files/2019-03/PER%20-%2017.PJ_.2015.pdf. No 2025/2026 replacement regulation found.

## 5. PPh Final UMKM 0.5% (PP 55/2022 → amended by PP 20/2026)

- **Turnover ceiling for the regime**: Rp4,800,000,000/year (unchanged since PP 23/2018).
- **Individual-taxpayer exemption**: turnover up to **Rp500,000,000/year is NOT taxed at all**; only turnover exceeding Rp500jt is subject to the 0.5% final rate. Legal basis: Pasal 60 PP No. 55 Tahun 2022. This exemption did not exist under the earlier PP 23/2018 — it was added by PP 55/2022 (issued pre-Prabowo, Dec 2022).
- **MAJOR Prabowo-era change — removal of the 7-year time limit for individuals**:
  - **PP No. 20 Tahun 2026**, reportedly signed by President Prabowo Subianto on **22 April 2026**, amends PP 55/2022.
  - Deletes Pasal 59 of PP 55/2022 (which set the time limits: 7 years for individuals, 4 years for CV/partnership/cooperative, 3 years for corporations/PT).
  - Under PP 20/2026: **individual taxpayers and single-shareholder PT (PT Perorangan) can use the 0.5% final rate with NO time limit** (still subject to the Rp4.8B turnover ceiling). **Cooperatives (koperasi)** are newly capped at **4 years** from registration. Ordinary corporations/PT (non-single-shareholder) are implied to no longer be eligible at all under the final-UMKM regime per this revision (would need separate verification).
  - **This is confirmed in force as of Sep 2026** (not merely proposed) per DJP's own site and IKPI (Indonesian tax consultants association), but the exact primary gazetted PDF of PP 20/2026 was **not directly fetched — UNVERIFIED at primary-document level**, high confidence given DJP corroboration.
  - Sources: https://www.pajak.go.id/en/node/119953 ; https://ortax.org/resmi-wp-op-dan-pt-perorangan-kini-bisa-pakai-tarif-0-5-persen-tanpa-batas-waktu ; https://ikpi.or.id/en/pp-20-tahun-2026-akhir-era-pph-final-umkm-berbasis-batas-waktu/

## 6. Investment Taxes

- **Deposit/savings interest**: **20% final** PPh 4(2), on interest from deposits/savings where principal > Rp7,500,000 (small savings below this threshold reportedly exempt per long-standing rule — **UNVERIFIED**, not independently confirmed this session). Legal basis referenced by secondary sources as PP 131/2000 + SE-01/PJ.43/2001, effective 1 Jan 2001 — **UNVERIFIED**, long predates Prabowo, no changes found.
- **Dividends**: for resident individual taxpayers, dividends are **exempt from PPh** if reinvested in Indonesia within **3 years** (per UU HPP amendments to Pasal 4(3) UU PPh, with implementing PP 9/2021 & PMK 18/2021); if **not** reinvested, dividends are subject to **10% final** tax. No 2025/2026 change found.
- **IDX (Bursa Efek Indonesia) share sales**: **0.1% final** PPh on gross transaction value for ordinary shareholders. **Founder shareholders (pendiri)** face an **additional 0.5%** one-time charge (on the share value at end-1996 IPO listing, a legacy provision), i.e. effectively 0.6% total for founder shares specifically. Legal basis cited by a secondary source as **Pasal 244 PMK 81/2024** for the 0.1% general rate (note: PMK 81/2024's crypto provisions were later repealed by PMK 54/2025 — the stock-transaction article may be separate/unaffected, but this needs verification) — **UNVERIFIED**, older basis is PP 14/1997.
- **Bonds/SBN coupon**: reported as **10% final** in current secondary sources (a reduction from a historical 15%, reportedly via PP 91/2021) — **UNVERIFIED this session**, not independently re-confirmed against a primary source in this pass; treat as likely-correct but re-check.
- **Mutual funds (reksa dana)**: not independently researched this session — **UNVERIFIED / GAP**. General understanding (not confirmed): interest/dividend income embedded in NAV is typically taxed at the underlying instrument's final rate before flowing to the fund; capital gain on redemption for individuals is generally not separately taxed. Needs dedicated follow-up research.
- **P2P lending interest income**: not independently researched this session — **UNVERIFIED / GAP**. Needs dedicated follow-up (whether treated as ordinary interest income subject to withholding, and at what rate).
- **Crypto assets — PMK 50/2025** (major Prabowo-era change):
  - Enacted 28 Jul 2025, **effective 1 Aug 2025**.
  - **PPN removed**: crypto asset sales are **no longer subject to VAT/PPN** from 1 Aug 2025 (crypto reclassified as a digital financial asset akin to securities, which are excluded from PPN under Pasal 4A(2)(d) UU PPN).
  - **PPh 22 final rate increased**: domestic/local exchange sellers pay **0.21%** final PPh 22 on transaction value (up from the prior rate under the repealed PMK 68/2022 / PMK 81/2024 regime). Foreign/unregistered exchanges, if appointed as a withholder, must withhold **1%** final PPh 22 — a materially higher rate meant to disincentivize using unregistered foreign platforms.
  - PMK 50/2025 repealed crypto provisions of PMK 81/2024 (itself repealed via PMK 54/2025 for other content).
  - https://www.pajak.go.id/en/node/117234 ; https://ortax.org/tarif-naik-penjualan-kripto-kini-dipungut-pph-pasal-22-0-21-persen
- **Gold bullion**: PMK 48/2023 governs PPh 22 on gold sales — not independently re-verified this session for rate/threshold detail or any 2025/2026 update — **UNVERIFIED / GAP**, needs dedicated follow-up (prior general knowledge: 0.25%–0.45% PPh 22 on gold bullion sales depending on NPWP status of buyer, but not confirmed this session).
- **Rental income (property)**: reported as **10% final** on gross rental value; legal basis commonly cited as **PP 34/2017**. **UNVERIFIED this session** (not independently re-confirmed via search this pass — carried over from task brief description, treat as needing confirmation).

## 7. PPN (VAT)

- **Nominal rate**: 12%, effective 1 Jan 2025 per UU HPP (statutory rate).
- **Effective rate held at 11% via DPP adjustment**: **PMK 131/2024** (PMK No. 131/PMK.03/2024) sets the DPP (Dasar Pengenaan Pajak / tax base) for **non-luxury** goods/services at **11/12 of the transaction price**. So: PPN payable = 12% × (11/12 × price) = **11% of price**, i.e., the pre-2025 effective burden is preserved for ordinary goods/services.
- **Luxury goods** (barang mewah, also subject to PPnBM): full 12% nominal rate applies on the full price for supplies **to end consumers**. There was a one-month transition: for Jan 2025, even luxury-goods supplies used the 11/12 DPP mechanism (effective 11%); the full 12% on luxury goods to end consumers only started **1 Feb 2025**.
- Confirmed still in effect through 2026 (no reversal found — DPP 11/12 mechanism for non-luxury goods remains in force as of Sep 2026; **not independently re-confirmed for a 2026-specific renewal regulation** — **UNVERIFIED** whether PMK 131/2024 itself needed a 2026 extension or continues automatically).
- https://www.pajak.go.id/en/node/113453 ; https://ortax.org/resmi-pmk-131-2024-atur-ppn-12-persen-hanya-untuk-barang-mewah

## 8. Property Taxes

- **PBB-P2** (Pajak Bumi dan Bangunan Perdesaan dan Perkotaan): confirmed as a **regional/local tax**, framework set by **UU No. 1 Tahun 2022 (UU HKPD)**, with maximum rate ceilings set nationally and actual rates set locally via Perda (regional regulation). Exact max-rate figures **not independently verified this session — GAP**.
- **BPHTB** (Bea Perolehan Hak atas Tanah dan Bangunan): **5%** rate confirmed by multiple secondary sources as the standard rate; **NPOPTKP** (non-taxable acquisition value threshold) is **set locally per region** (varies by regency/city) — no single national default confirmed; e.g., Jakarta and other regions each set their own NPOPTKP via local regulation. **UNVERIFIED specific current NPOPTKP figures** — needs region-specific lookup if the app needs exact numbers.
- **PPh final on sale of land/building**: **2.5%** of gross transfer value for ordinary transfers (non-simple-housing) by taxpayers whose main business is land/building transfer, per **PP No. 34 Tahun 2016** (this PP reduced the rate from a prior 5%). Reduced rates exist for simple housing: **1%** for simple houses/simple flats (rumah sederhana/rusun sederhana), and **0%** in certain conditions (e.g. transfers to government for public infrastructure, certain grants/inheritance — not itemized here, **UNVERIFIED** exact 0% trigger list).
- **PPN DTP for house purchases** (major recurring stimulus, Prabowo-era, extended repeatedly):
  - Applies to houses/apartments (rumah tapak & rumah susun) priced **up to Rp5 billion**, with the DTP subsidy applying to **the first Rp2 billion** of that price.
  - **2025**: 100% PPN DTP for Jan–Jun 2025; reduced to 50% for Jul–Dec 2025 initially, but **PMK 60/2025** (dated 15 Aug 2025) reinstated **100%** DTP for Jul–Dec 2025.
  - **2026**: Government officially extended the incentive to cover **all of 2026** at **100%** DTP, with no split periods (per Ortax reporting).
  - There is also reporting of a further extension **through end-2027** — this appears to be a later/newer policy layer; exact regulation number for the 2027 extension **UNVERIFIED this session** — flag as "announced, verify before relying on."
  - https://www.pajak.go.id/en/node/114188 ; https://www.pajak.go.id/en/node/117181 ; https://ikpi.or.id/en/pemerintah-perpanjang-insentif-bebas-ppn-rumah-hingga-akhir-2027/ ; https://ortax.org/tahun-anggaran-2026-pemerintah-kembali-berikan-diskon-ppn-rumah

## 9. Vehicles

- **PPnBM (Pajak Penjualan atas Barang Mewah) on vehicles**: general luxury-vehicle sales tax mechanism confirmed to exist; **EV (electric vehicle) incentives** (PPnBM DTP / 0% rate, battery-EV incentive packages) reported to continue under Prabowo-era policy but **not independently re-verified this session with exact rates/regulation numbers — GAP**, needs dedicated follow-up (prior general knowledge: 0% PPnBM for qualifying BEVs with local content requirements under older PP 74/2021 framework, continuation status into 2025/2026 unconfirmed here).
- **PKB (Pajak Kendaraan Bermotor) + Opsen** (Prabowo-era structural change, effective **5 Jan 2025**):
  - Legal basis: **UU No. 1 Tahun 2022 (UU HKPD)**, Pasal 83.
  - **Opsen** = a surcharge ("piggyback tax") collected by the kabupaten/kota (regency/city) government on top of provincially-collected PKB and BBNKB (vehicle transfer duty).
  - **Opsen rate: 66%** of the base PKB (and separately 66% of BBNKB).
  - To offset this new surcharge, the **base PKB maximum rate was lowered**: first-vehicle-ownership PKB max rate reduced from **2% to 1.2%** of vehicle value (NJKB), so that total effective burden (base PKB + opsen) is broadly similar to the pre-2025 total, though this varies by region since local governments can set the base rate anywhere up to the new lower ceiling.
  - Effect: vehicle owners now see **two line items** on their PKB bill (base PKB to province + opsen to regency/city), even though the combined total is designed to be roughly revenue-neutral relative to the old single-rate system — but actual household-level impact depends on each region's chosen rates, so **could increase or hold steady depending on locality — not uniformly "increased," contra a naive reading of the brief**.
  - https://news.ddtc.co.id/berita/nasional/1807830/berlaku-mulai-5-januari-2025-begini-penghitungan-opsen-pajak ; https://www.pajak.go.id/en/node/113659

## 10. Filing / Coretax / NIK-NPWP

- **SPT Tahunan deadline**: individuals (orang pribadi) — **31 March** of the year following the tax year. Legal basis: UU KUP (general provision, unchanged).
- **Coretax DJP**: DJP's new integrated core tax administration system, rolled out **1 Jan 2025** (major Prabowo-era system change), replacing/consolidating the old DJP Online, e-Bupot, e-Faktur, etc.
  - Widely reported severe technical disruptions from launch through much of 2025 (DJP itself acknowledged **at least 22 distinct system issues**: Error 502, login failures, OTP problems, NIK-NPWP data-sync mismatches with Dukcapil population data, server overloads).
  - **Administrative relief given for SPT Tahunan 2025 (filed in 2026)**: DJP waived administrative penalties (sanksi administratif) for individual taxpayers who file and/or pay **after 31 March 2026 but by 30 April 2026 at the latest** — but DJP explicitly stated this does **not** change the formal statutory due date of 31 March 2026; it's a penalty-waiver grace period, not a deadline extension. (This is analogous to — and may recur for — the SPT Tahunan 2024 filing season in early 2025, though this session did not independently confirm whether an equivalent 2025 grace period was granted; **UNVERIFIED for the 2025 filing season specifically**, confirmed for the 2026 filing season covering tax year 2025.)
  - Status as of Sep 2026: reported as still experiencing user-reported issues periodically, but no longer described as in an acute crisis state; no primary DJP policy statement on "full stabilization" was independently found this session — **UNVERIFIED / GAP**.
- **NIK sebagai NPWP**: individuals' national ID number (NIK) serves as their NPWP. Legal basis: **PMK 112/PMK.03/2022**, fully implemented **1 Jan 2024**, continues to be the operative identifier under Coretax through 2025/2026. **Not independently re-verified this session against a primary text — carried over from task brief, treat as UNVERIFIED-but-well-known.**

## 11. Modeling Recommendations for the App

**Calculators/records to support:**

1. **Annual PPh OP estimator** — inputs: gross annual income, PTKP status (TK/K + dependent count 0–3), biaya jabatan (auto-capped), pension/JHT employee contribution, zakat paid (with a yes/no toggle "via recognized amil zakat body"). Output: taxable income → Pasal 17 progressive tax → compare to TER-based withholding already paid → refund/underpayment estimate. This directly mirrors the December true-up DJP performs.
2. **Monthly TER withholding calculator** — separate from #1: given monthly gross salary + PTKP status → map to TER category (A/B/C) → apply lookup table → monthly PPh 21 withheld. Useful for paycheck-level estimates during the year, distinct from the annual true-up.
3. **UMKM 0.5% final tax tracker** — for freelancers/small business owners: track cumulative annual omzet, auto-exempt the first Rp500,000,000 (individuals only), apply 0.5% above that, up to the Rp4.8B ceiling; flag once the taxpayer nears/exceeds Rp4.8B (must switch to normal Pasal 17 regime with bookkeeping). Given PP 20/2026, no need to track a "7-year" countdown for individuals/PT Perorangan anymore — but DO track it for cooperatives (4-year cap) if the app ever serves non-individual entities.
4. **Investment income final-tax auto-deduction per instrument** — a per-instrument rate table applied automatically when the user logs investment income: deposits/savings 20%, non-reinvested dividends 10% (reinvested = 0%, with a 3-year tracking flag), IDX shares 0.1% (+0.5% if user is a "founder shareholder" — rare edge case, maybe skip), SBN coupon ~10% (needs re-verification), crypto 0.21% domestic-exchange / 1% foreign-exchange (post-Aug-2025 rates), rental 10% (needs re-verification), gold bullion (needs dedicated rate lookup).
5. **NPPN-based net income estimator** for freelancers/professionals not doing full bookkeeping — needs the actual PER-17/PJ/2015 percentage table (not yet retrieved) keyed by profession + region tier.
6. **Property transaction calculators**: PPh final 2.5%/1% on sale, BPHTB 5% on purchase (with region-specific NPOPTKP lookup — will need a maintained per-region table or a manual-entry field since it's not nationally uniform), and a toggle for whether a PPN DTP incentive applies (price ≤ Rp5B, subsidy on first Rp2B, currently 100% for all of 2026).
7. **Vehicle tax estimator**: base PKB + opsen (66%) as two line items, since post-Jan-2025 bills legally show them separately even if paid together.

**Data to keep as versioned, effective-dated config** (i.e., NOT hard-coded in logic, because they change yearly/semi-yearly under stimulus policy):

- TER category tables (A/B/C) — stable since 2024, but any future PMK revision would change lookup bands.
- PPh 21 DTP eligibility (sectors, income caps, period) — **changes annually** (PMK 10/2025 → PMK 72/2025 → PMK 105/2025 already 3 revisions in ~18 months).
- PPN DTP housing incentive (%, price cap, subsidized portion, period) — **changes every 6–12 months** (100%→50%→100% within 2025 alone, per-PMK).
- UMKM final-tax time-limit rules — just changed structurally via PP 20/2026; keep as config in case of further revision.
- Crypto PPh 22 / PPN treatment — just changed via PMK 50/2025 (Aug 2025); crypto tax policy has been revised multiple times (PMK 68/2022 → PMK 81/2024 → PMK 50/2025/54/2025) — highly volatile, must be config-driven with an effective date.
- PPN luxury-vs-non-luxury DPP mechanism (currently 11/12 for non-luxury) — could be simplified/removed in a future PMK; treat the "effective 11%" as a computed value, not a hard-coded rate.
- Opsen PKB rate (66%) and base PKB ceiling (1.2%) — regional variation + recency (2025) means this should be config, ideally per-province if the app supports vehicle tax at all.

**Facts that are comparatively stable** (safe closer to hard-coded, but still versioned for safety):

- Pasal 17 progressive brackets (unchanged since UU HPP 2021).
- PTKP amounts (unchanged since 2016).
- Biaya jabatan/pensiun caps (long-standing).
- Zakat deduction mechanism (PP 60/2010, long-standing).
- IDX transaction tax 0.1% (long-standing, PP 14/1997 lineage).
- BPHTB 5% national standard rate (though NPOPTKP is regional).

---

## Machine-Readable Summary (YAML)

```yaml
# Indonesian personal/household tax rates & thresholds
# accessDate: 2026-09-26
# NOTE: entries marked verified: false were not confirmed against a primary-source PDF this session.

pph21_ter:
  legalBasis: "PP 58/2023; PMK 168/2023"
  effectiveFrom: "2024-01-01"
  verified: true
  categories:
    - name: A
      ptkpStatuses: ["TK/0", "TK/1", "K/0"]
      annualPtkp: { TK/0: 54000000, TK/1: 58500000, K/0: 58500000 }
    - name: B
      ptkpStatuses: ["TK/2", "TK/3", "K/1", "K/2"]
      annualPtkp:
        { TK/2: 63000000, K/1: 63000000, TK/3: 67500000, K/2: 67500000 }
    - name: C
      ptkpStatuses: ["K/3"]
      annualPtkp: { K/3: 72000000 }
  source: "https://jdih.kemenkeu.go.id/dok/pmk-168-tahun-2023/summary"

pph21_dtp_incentive:
  "2025":
    legalBasis: "PMK 10/2025 (footwear/textile/furniture/leather); PMK 72/2025 (+tourism, ~Oct 2025)"
    effectiveFrom: "2025-01-01"
    effectiveTo: "2025-12-31"
    eligibility:
      {
        permanentEmployeeMaxMonthlyGross: 10000000,
        nonPermanentMaxDailyWage: 500000,
      }
    verified: true
    source: "https://www.pajak.go.id/en/node/115043"
  "2026":
    legalBasis: "PMK 105/2025"
    effectiveFrom: "2026-01-01"
    effectiveTo: "2026-12-31"
    eligibility:
      {
        permanentEmployeeMaxMonthlyGross: 10000000,
        nonPermanentMaxDailyWage: 500000,
      }
    verified: true
    source: "https://www.pajak.go.id/en/node/118927"

pph_pasal17_brackets:
  legalBasis: "UU 7/2021 (UU HPP), Pasal 17"
  effectiveFrom: "2022-01-01"
  verified: false
  brackets:
    - { upTo: 60000000, rate: 0.05 }
    - { from: 60000000, upTo: 250000000, rate: 0.15 }
    - { from: 250000000, upTo: 500000000, rate: 0.25 }
    - { from: 500000000, upTo: 5000000000, rate: 0.30 }
    - { from: 5000000000, rate: 0.35 }

ptkp:
  legalBasis: "PMK 101/PMK.010/2016"
  effectiveFrom: "2016-06-27"
  verified: false
  base: 54000000
  marriedAddOn: 4500000
  dependentAddOn: 4500000
  maxDependents: 3
  wifeIncomeCombinedAddOn: 54000000

deductions:
  biayaJabatan:
    rate: 0.05
    capMonthly: 500000
    capAnnual: 6000000
    verified: false
  biayaPensiun:
    rate: 0.05
    capMonthly: 200000
    capAnnual: 2400000
    verified: false
  zakat:
    legalBasis: "PP 60/2010; PMK 254/PMK.03/2010"
    condition: "via recognized amil zakat body (BAZNAS/official LAZ)"
    verified: false
  nppn:
    legalBasis: "PER-17/PJ/2015"
    percentageTable: "NOT RETRIEVED - see Lampiran I/II/III"
    verified: false

umkm_final_tax:
  rate: 0.005
  turnoverCeiling: 4800000000
  individualExemptionThreshold: 500000000
  legalBasisBase: "PP 55/2022, Pasal 60 (exemption)"
  timeLimit:
    legalBasis: "PP 20/2026 (effective ~2026-04-22, amends PP 55/2022, deletes Pasal 59)"
    individualAndPTPerorangan: "no time limit"
    koperasi: "4 years from registration"
    verified: false

investments:
  depositSavingsInterest: { rate: 0.20, type: final, verified: false }
  dividendsReinvested: { rate: 0.0, conditionYears: 3, verified: false }
  dividendsNotReinvested: { rate: 0.10, type: final, verified: false }
  idxShareSale:
    { rate: 0.001, type: final, founderSurcharge: 0.005, verified: false }
  sbnCoupon: { rate: 0.10, type: final, verified: false }
  cryptoDomesticExchange:
    legalBasis: "PMK 50/2025"
    effectiveFrom: "2025-08-01"
    pphFinalRate: 0.0021
    ppnRemoved: true
    verified: true
  cryptoForeignExchange:
    legalBasis: "PMK 50/2025"
    effectiveFrom: "2025-08-01"
    pphFinalRate: 0.01
    verified: true
  rentalIncome:
    { rate: 0.10, type: final, legalBasis: "PP 34/2017", verified: false }
  goldBullion:
    {
      legalBasis: "PMK 48/2023",
      verified: false,
      note: "rate not re-confirmed this session",
    }
  mutualFunds: { verified: false, note: "not researched this session" }
  p2pLending: { verified: false, note: "not researched this session" }

ppn:
  nominalRate: 0.12
  effectiveFrom: "2025-01-01"
  legalBasis: "UU HPP + PMK 131/2024"
  nonLuxuryEffectiveRate: 0.11
  nonLuxuryMechanism: "DPP = 11/12 of price"
  luxuryFullRateEffectiveFrom: "2025-02-01"
  verified: true

property:
  pphFinalSale:
    standardRate: 0.025
    simpleHousingRate: 0.01
    legalBasis: "PP 34/2016"
    verified: false
  bphtb:
    rate: 0.05
    npoptkp: "set locally per region, not nationally uniform"
    verified: false
  ppnDtpHousing:
    priceCap: 5000000000
    subsidizedPortion: 2000000000
    "2025":
      janJun: { pct: 1.00 }
      julDec:
        {
          pct: 1.00,
          legalBasis: "PMK 60/2025 (2025-08-15), reinstated 100% after initial 50% plan",
        }
    "2026":
      fullYear: { pct: 1.00 }
    verified: true

vehicles:
  opsenPkb:
    rate: 0.66
    effectiveFrom: "2025-01-05"
    legalBasis: "UU 1/2022 (UU HKPD), Pasal 83"
    basePkbMaxRateFirstVehicle: 0.012
    priorBasePkbMaxRate: 0.02
    verified: true
  opsenBbnkb:
    rate: 0.66
    verified: true
  evPpnbmIncentive:
    verified: false
    note: "not re-confirmed this session"

filing:
  sptTahunanDeadlineIndividual: "March 31"
  legalBasis: "UU KUP"
  coretax:
    effectiveFrom: "2025-01-01"
    majorDisruptionsReported: true
    "2026filingGracePeriod":
      administrativePenaltyWaivedUntil: "2026-04-30"
      formalDeadlineUnchanged: "2026-03-31"
      verified: true
  nikAsNpwp:
    legalBasis: "PMK 112/PMK.03/2022"
    effectiveFrom: "2024-01-01"
    verified: false
```
