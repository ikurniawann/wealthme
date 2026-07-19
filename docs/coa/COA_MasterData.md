# Master COA — Chart of Accounts WealthMe

### Dokumentasi Struktur & Integrasi ke Aplikasi

**Sumber:** `Asset.xlsx` (sheet Budgeting) → dirapikan jadi `COA_Rapih.xlsx`
**Diterapkan di:** `WealthMe_Demo.html` → menu **Master COA**

---

## 1. Apa itu COA di WealthMe

Chart of Accounts (COA) / Bagan Akun adalah daftar terstruktur semua akun keuangan. Di WealthMe, COA berfungsi sebagai **master data referensi** yang menghubungkan setiap transaksi ke akun yang benar — sehingga laporan PNL, Balance Sheet, dan Cashflow akurat.

**Prinsip koneksi:** setiap akun COA punya **arah transaksi** yang menentukan perlakuannya:

| Arah                | Simbol | Perlakuan                                |
| ------------------- | ------ | ---------------------------------------- |
| Pemasukan (Kredit)  | ↓      | Menambah saldo / income                  |
| Pengeluaran (Debit) | ↑      | Mengurangi saldo / expense               |
| Transfer / Netral   | ↔      | Pemindahan antar akun (alokasi kekayaan) |

---

## 2. Struktur 6 Grup COA

Penomoran konsisten berdasarkan grup (digit pertama = grup):

| Kode    | Grup                   | Arah Default  | Fungsi                       |
| ------- | ---------------------- | ------------- | ---------------------------- |
| `1xxxx` | **Income**             | ↓ Pemasukan   | Sumber pendapatan            |
| `2xxxx` | **Expense**            | ↑ Pengeluaran | Beban & biaya                |
| `3xxxx` | **Wealth Allocation**  | ↔ Transfer    | Alokasi ke aset/investasi    |
| `4xxxx` | **Account Receivable** | ↓ Pemasukan   | Piutang (uang akan diterima) |
| `5xxxx` | **Account Payable**    | ↑ Pengeluaran | Utang (kewajiban bayar)      |
| `6xxxx` | **Tax**                | ↑ Pengeluaran | Pajak                        |

---

## 3. Koreksi Penting yang Dilakukan

### 3.1 Account Receivable ↔ Account Payable (diperbaiki)

**Masalah di file asli:** section "4 Account Receivable" berisi `401 Office` (Snacks, Office Supplies, Gadget, Subscription, Equipment) — ini **salah** secara akuntansi.

- **Account Receivable (Piutang)** = uang yang akan _diterima_ (orang lain berutang ke kita)
- **Account Payable (Utang)** = uang yang harus _dibayar_ (kita berutang ke orang lain)

Pengeluaran kantor yang sifatnya reimbursement (ditalangin dulu) = **kewajiban bayar** → dipindahkan ke **Account Payable**.

**Setelah koreksi:**

```
4 Account Receivable (PIUTANG - uang akan diterima)
  401 Reimbursement → Pending Reimbursement
  402 Loan to Others → Personal Loan, Business Receivable
  403 Deposits → Refundable Deposit

5 Account Payable (UTANG - kewajiban bayar)
  501 Office → Snacks, Supplies, Gadget, Subscription, Equipment  ← pindahan
  502 Credit Card → Credit Card Bill
  503 Loans → Bank Loan, Personal Debt
```

### 3.2 Section kosong diisi

`Account Payable` dan `Pajak/PPH` yang tadinya kosong di file asli sekarang lengkap:

```
6 Tax
  601 Income Tax → PPh 21, PPh 25/29
  602 Investment Tax → PPh Final Dividen, PPh Bunga/Deposito
  603 Property Tax → PBB, PKB
```

---

## 4. Detail Akun per Grup

### 1 · Income (↓ Pemasukan)

- **101 Salary** — Salary Dax, Salary Meta
- **102 Dividend** — Dividen Dax, Dividen Meta
- **103 Passive Income**
- **104 Other Income**

### 2 · Expense (↑ Pengeluaran)

- **201 Household** — Needs, Staff, Pets, Utilities, Maintenance
- **202 Food** — Dining Out, Groceries, Snacks, Online Food
- **203 Personal** — Clothing, Grooming, Gadgets, Stationary, Impulse
- **204 Medical** — Treatment, Preventive, Diagnostics, Supplies
- **205 Transport** — Fuel/Parking/Toll, Public/Ride-hailing, Service, Legal/Admin
- **206 Family Education** — School, Private Class, Therapy, Competition, Workshop
- **207 Entertainment** — Experiences, Hobbies, Sports
- **208 Holiday** — Couple Trip, Family Trip
- **209 Events & Gifts** — Family, Seasonal, Social
- **211 Insurance Expense** — Health, Asset & Other
- **212 Donation** — Education, Religious/Ministry, Research, Social
- **213 Misc** — Bank, Subscription, Unclassified

### 3 · Wealth Allocation (↔ Transfer)

Bank Savings, Emergency Fund, Gold, Forex, Property, Business, Stocks, Crypto, Education Insurance, Life Insurance

### 4 · Account Receivable (↓ Pemasukan)

Pending Reimbursement, Personal Loan (to others), Business Receivable, Refundable Deposit

### 5 · Account Payable (↑ Pengeluaran)

Office (Snacks, Supplies, Gadget, Subscription, Equipment), Credit Card Bill, Bank Loan, Personal Debt

### 6 · Tax (↑ Pengeluaran)

PPh 21, PPh 25/29, PPh Final Dividen, PPh Bunga/Deposito, PBB, PKB

---

## 5. Integrasi ke Aplikasi (Master COA)

### Lokasi

Menu **Master COA** di sidebar bawah (grup Tools), badge "New".

### Komponen halaman

1. **Summary cards** — Total Akun (6 grup · 115 akun), Terhubung ke Transaksi (98), Belum Dimapping (17)
2. **Filter tab** — Semua / Income / Expense / Wealth Allocation / Account Receivable / Account Payable / Tax
3. **Tabel COA** dengan kolom:
   - Kode (10101, 20101, dst)
   - Nama Akun
   - Tipe / Grup
   - **Arah Transaksi** (↓ Pemasukan / ↑ Pengeluaran / ↔ Transfer) — kolom kunci koneksi
   - Budget Type (Fixed / Variable / Reimbursement)
   - Aksi (Edit / Hapus)

### Form Tambah/Edit Akun

Field yang bisa diatur:

- **Kode Akun** (cth: 20106)
- **Nama Akun**
- **Tipe / Grup** (1 Income … 6 Tax)
- **Arah Transaksi** (Pemasukan/Pengeluaran/Transfer) ← menentukan kemana COA menuju
- **Budget Type** (Fixed/Variable/Reimbursement)
- **Kategori Induk** (cth: 201 Household)

### Cara kerja koneksi ke transaksi

```
Transaksi baru  →  pilih kategori  →  kategori ter-mapping ke akun COA
                                       ↓
                    Arah COA menentukan: pemasukan / pengeluaran / transfer
                                       ↓
              Laporan PNL, Balance Sheet, Cashflow terisi otomatis & akurat
```

---

## 6. Budget Type

| Type              | Arti                                                 |
| ----------------- | ---------------------------------------------------- |
| **Fixed**         | Nilai tetap tiap periode (gaji, cicilan, sekolah)    |
| **Variable**      | Nilai berubah-ubah (belanja, hobi, dining)           |
| **Reimbursement** | Ditalangin dulu, ditagih balik (subscription kantor) |

---

## 7. File Terkait

| File                 | Isi                                                                  |
| -------------------- | -------------------------------------------------------------------- |
| `COA_Rapih.xlsx`     | COA bersih siap pakai (6 grup, hierarki 3 level, format profesional) |
| `WealthMe_Demo.html` | Aplikasi dengan menu Master COA terintegrasi                         |
| `COA_MasterData.md`  | Dokumen ini                                                          |

---

_COA ini diadaptasi untuk konteks personal/family wealth — memetakan Dana/Rekening/Investasi/Aset ke grup yang benar, sehingga seluruh transaksi terhubung ke akun yang tepat dan laporan keuangan akurat._
