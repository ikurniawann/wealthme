// Universal CRUD form definitions, ported from the demo's crudConfig
// (docs/WealthMe_Demo.html — "UNIVERSAL CRUD ENGINE").

import { formatRupiah, parseRupiah } from "@/lib/format";
import type { ReferenceItemGroup } from "@wealthme/contracts";

/**
 * Whole months from today until `deadline` (yyyy-mm-dd), floored at 1 — a
 * deadline inside the current month still needs one contribution.
 */
function monthsUntil(deadline: string): number {
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime())) return 0;
  const now = new Date();
  const months =
    (end.getFullYear() - now.getFullYear()) * 12 +
    (end.getMonth() - now.getMonth());
  return months <= 0 ? 1 : months;
}

export type CrudFieldType =
  | "text"
  | "email"
  | "number"
  | "amount"
  | "date"
  | "select"
  | "textarea"
  | "iconpick"
  | "toggle";

export interface CrudField {
  key: string;
  label: string;
  type: CrudFieldType;
  placeholder?: string;
  options?: string[];
  /** Sub-copy shown under the label — used by the "toggle" field type. */
  helperText?: string;
  /**
   * Computed helper line rendered under the field, derived from the current
   * form values (e.g. the per-month saving suggestion on tujuan.autodebit).
   * Return null to hide. Must be pure — it is called on every render.
   */
  helper?: (values: Record<string, string>) => string | null;
  /**
   * EPIC-021 #21 — an "amount" field that may hold a negative value (only
   * `cash.saldo` today: physical cash can run short with no external floor).
   * Every other "amount" field keeps stripping "-" like before.
   */
  allowNegative?: boolean;
  /**
   * EPIC-022 F6 — `rekening.jenis` ("Tabungan"/"Giro"/"Deposito") has no
   * backing `Account` column: it only ever fed the auto-generated display
   * name at CREATE time (`${bank} ${jenis}`), so on EDIT it was rendered
   * pre-filled to its first option regardless of the account's real data
   * and silently dropped from every PATCH — a dead field with nothing real
   * behind it. Rather than fabricate a persisted value, it's hidden once
   * there's nothing for it to represent.
   */
  hideOnEdit?: boolean;
  /** Select options come from this Master Data group; static `options` stay as the fallback. */
  referenceGroup?: ReferenceItemGroup;
  /** Render the field only while this returns true for the current values. */
  visibleWhen?: (values: Record<string, string>) => boolean;
  /**
   * E2E round 1, bug 1 — CrudModal blocks Simpan and shows an inline error
   * when this field is blank/whitespace-only. Only `tujuan.nama` opts in
   * today; every other entity's own `handleSubmit` (asuransi, warisan,
   * masterdata, anggaran) already does its own required-name toast, so
   * flipping this on for them too would double-validate the same field.
   */
  required?: boolean;
  /**
   * Field-level rule run by CrudModal on Simpan, alongside `required`.
   * Return the inline error, or null when the value is fine. Receives the
   * raw form string (amounts still grouped: "1.250.000").
   */
  validate?: (value: string, values: Record<string, string>) => string | null;
}

/** Today as yyyy-mm-dd in local time, for date rules. */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export interface CrudEntityConfig {
  title: string;
  fields: CrudField[];
}

export type CrudEntity =
  | "rekening"
  | "ewallet"
  | "cash"
  | "investasi"
  | "aset"
  | "liabilitas"
  | "asuransi"
  | "tujuan"
  | "mdbank"
  | "mdkategori"
  | "mdewallet"
  | "mdlembaga";

export const CRUD_CONFIG: Record<CrudEntity, CrudEntityConfig> = {
  rekening: {
    title: "Rekening Bank",
    fields: [
      {
        key: "bank",
        label: "Nama Bank",
        type: "select",
        referenceGroup: "bank",
        options: [
          "BCA",
          "Mandiri",
          "BRI",
          "BNI",
          "CIMB",
          "OCBC",
          "Bank Lainnya",
        ],
      },
      {
        key: "nama",
        label: "Nama Rekening",
        type: "text",
        placeholder: "cth: BCA Tahapan",
      },
      {
        key: "norek",
        label: "Nomor Rekening",
        type: "text",
        placeholder: "cth: 1234567890",
      },
      { key: "saldo", label: "Saldo Saat Ini", type: "amount" },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: ["Tabungan", "Giro", "Deposito"],
        hideOnEdit: true,
      },
      {
        key: "isPrivate",
        label: "Rekening Privat",
        type: "toggle",
        helperText: "Hanya Master & Co-Master.",
      },
      {
        // EPIC-019 Task A — options injected at runtime via CrudModal
        // `dynamicOptions` (the family's members + a "Keluarga (bersama)"
        // option for null/family-shared). See rekening/page.tsx.
        key: "ownerUserId",
        label: "Pemilik",
        type: "select",
        options: [],
      },
    ],
  },
  ewallet: {
    title: "E-Wallet",
    fields: [
      {
        key: "nama",
        label: "E-Wallet",
        type: "select",
        referenceGroup: "ewallet",
        options: ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"],
      },
      {
        key: "phone",
        label: "Nomor Terdaftar",
        type: "text",
        placeholder: "08xxxxxxxxxx",
      },
      { key: "saldo", label: "Saldo Saat Ini", type: "amount" },
      {
        // EPIC-033 R3 — options injected via CrudModal `dynamicOptions`.
        key: "ownerUserId",
        label: "Pemilik",
        type: "select",
        options: [],
      },
    ],
  },
  // EPIC-021 #3 — cash accounts are real, plural master data (AccountType
  // "cash"), not a single hardcoded "Kas Tunai" row. Free-text name so a
  // family can hold more than one cash account (e.g. "Kas Tunai", "Dompet
  // Kerja").
  cash: {
    title: "Kas Tunai",
    fields: [
      {
        key: "nama",
        label: "Nama Kas",
        type: "text",
        placeholder: "cth: Kas Tunai, Dompet Kerja",
      },
      // EPIC-021 #21 — "Data Kas bisa minus": physical cash may go negative,
      // so this is the one "amount" field across every entity that keeps a
      // typed/displayed "-" sign instead of stripping it.
      {
        key: "saldo",
        label: "Saldo Saat Ini",
        type: "amount",
        allowNegative: true,
      },
      {
        // EPIC-033 R3 — options injected via CrudModal `dynamicOptions`.
        key: "ownerUserId",
        label: "Pemilik",
        type: "select",
        options: [],
      },
    ],
  },
  investasi: {
    title: "Investasi",
    fields: [
      {
        key: "nama",
        label: "Nama Instrumen",
        type: "text",
        placeholder: "cth: Bank Central Asia",
      },
      {
        key: "ticker",
        label: "Kode / Ticker",
        type: "text",
        placeholder: "cth: BBCA",
      },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: ["Saham", "Reksa Dana", "Obligasi", "Emas", "Crypto"],
      },
      { key: "modal", label: "Modal Awal", type: "amount" },
      { key: "nilai", label: "Nilai Sekarang", type: "amount" },
    ],
  },
  aset: {
    title: "Aset",
    fields: [
      {
        key: "nama",
        label: "Nama Aset",
        type: "text",
        placeholder: "cth: Apartemen Kelapa Gading",
      },
      {
        key: "kategori",
        label: "Kategori",
        type: "select",
        options: [
          "Properti",
          "Kendaraan",
          "Elektronik",
          "Perhiasan",
          "Emas",
          "Lainnya",
        ],
      },
      { key: "nilai", label: "Nilai Estimasi", type: "amount" },
      {
        key: "dokumen",
        label: "No. Dokumen",
        type: "text",
        placeholder: "cth: SHM No. 1234",
      },
    ],
  },
  liabilitas: {
    title: "Liabilitas",
    fields: [
      {
        key: "nama",
        label: "Nama Liabilitas",
        type: "text",
        placeholder: "cth: KTA Bank Mandiri",
      },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: [
          "Kartu Kredit",
          "KTA",
          "KPR",
          "Cicilan Kendaraan",
          "Pinjaman Lain",
        ],
      },
      { key: "total", label: "Total Utang", type: "amount" },
      { key: "cicilan", label: "Cicilan / Bulan", type: "amount" },
      { key: "tenor", label: "Sisa Tenor (bulan)", type: "number" },
    ],
  },
  asuransi: {
    title: "Asuransi",
    fields: [
      {
        key: "nama",
        label: "Nama Polis",
        type: "text",
        placeholder: "cth: Asuransi Jiwa Prudential",
      },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: ["Jiwa", "Kesehatan", "Kendaraan", "Properti", "Pendidikan"],
      },
      { key: "premi", label: "Premi / Bulan", type: "amount" },
      { key: "pertanggungan", label: "Uang Pertanggungan", type: "amount" },
      { key: "jatuhtempo", label: "Jatuh Tempo", type: "date" },
    ],
  },
  tujuan: {
    title: "Tujuan Keuangan",
    fields: [
      {
        key: "nama",
        label: "Nama Tujuan",
        type: "text",
        placeholder: "cth: Dana Liburan",
        // E2E round 1, bug 1 — a blank/whitespace name used to save
        // silently (201, success toast); CrudModal now blocks Simpan.
        required: true,
      },
      {
        key: "target",
        label: "Target Jumlah",
        type: "amount",
        validate: (v) =>
          parseRupiah(v) > 0 ? null : "Target jumlah harus lebih dari 0.",
      },
      { key: "terkumpul", label: "Sudah Terkumpul", type: "amount" },
      {
        key: "deadline",
        label: "Target Tanggal",
        type: "date",
        validate: (v) =>
          v && v < todayIso()
            ? "Target tanggal tidak boleh sebelum hari ini."
            : null,
      },
      {
        key: "autodebit",
        label: "Auto-debit / Bulan",
        type: "amount",
        // EPIC-021 #30 — "hitungan pecahan pembagi": suggest the per-month
        // contribution needed to close the gap by the target date.
        helper: (v) => {
          if (
            [v.target__currency, v.terkumpul__currency].some(
              (c) => c && c !== "IDR",
            )
          )
            return null;
          const remaining =
            parseRupiah(v.target ?? "0") - parseRupiah(v.terkumpul ?? "0");
          if (remaining <= 0 || !v.deadline) return null;
          const months = monthsUntil(v.deadline);
          if (months <= 0) return null;
          return `Saran: ${formatRupiah(Math.ceil(remaining / months))} / bulan · ${months} bulan tersisa`;
        },
      },
      {
        // EPIC-033 group 5 (p27) — day of month the auto-debit runs.
        key: "autodebitDay",
        label: "Tanggal Auto-debit (1-28)",
        type: "number",
        placeholder: "cth: 25",
        validate: (v) => {
          if (!v.trim()) return null;
          const day = Number(v);
          return Number.isInteger(day) && day >= 1 && day <= 28
            ? null
            : "Tanggal auto-debit harus antara 1 dan 28.";
        },
      },
      {
        // Revisi F — label comes from i18n via CrudModal `labelOverrides`; options via `dynamicOptions`.
        key: "sourceAccountId",
        label: "Rekening Sumber",
        type: "select",
        options: [],
        visibleWhen: (v) => parseRupiah(v.autodebit ?? "") > 0,
      },
      {
        key: "icon",
        label: "Ikon",
        type: "iconpick",
        options: ["🛡️", "✈️", "🏠", "🏖️", "🚗", "🎓", "💍", "👶"],
      },
    ],
  },
  // EPIC-024 A2 (D2, item 18) — the "member" entity (email invite-link UI)
  // was removed here. Backend invitation endpoints (`CreateInvitationDto`,
  // `POST /family-groups/:id/invitations`) are UNTOUCHED — the invite
  // feature is hidden in the UI only. Family members are now added
  // directly (dependant/operational via `AddDependantMemberDialog`, istri
  // as a second owner via the same dialog per A1).
  // EPIC-024 Task J (D14) — the `ReferenceItem` model backing mdbank/mdewallet/
  // mdlembaga only stores a `label`; the demo's extra fields had nothing real to
  // persist to, so they are dropped rather than shown and silently discarded.
  mdbank: {
    title: "Bank",
    fields: [
      {
        key: "nama",
        label: "Nama Bank",
        type: "text",
        placeholder: "cth: Bank Jago",
      },
    ],
  },
  mdkategori: {
    title: "Kategori",
    fields: [
      {
        key: "nama",
        label: "Nama Kategori",
        type: "text",
        placeholder: "cth: Pendidikan",
      },
      {
        key: "tipe",
        label: "Tipe",
        type: "select",
        options: ["Pengeluaran", "Pemasukan"],
      },
      {
        // Options are injected at runtime via CrudModal `dynamicOptions`
        // (the family's COA accounts). EPIC-017: category → COA mapping.
        key: "coaAccountId",
        label: "Akun COA",
        type: "select",
        options: [],
      },
      {
        key: "isPrivate",
        label: "Kategori Privat",
        type: "toggle",
        helperText: "Sembunyikan dari anggota keluarga lain",
      },
      {
        key: "icon",
        label: "Ikon",
        type: "iconpick",
        options: ["🍽️", "🚗", "🏥", "🎮", "🛒", "💡", "📱", "🎓", "🏠", "✈️"],
      },
    ],
  },
  mdewallet: {
    title: "E-Wallet",
    fields: [
      {
        key: "nama",
        label: "Nama E-Wallet",
        type: "text",
        placeholder: "cth: Jenius",
      },
    ],
  },
  mdlembaga: {
    title: "Lembaga Donasi",
    fields: [
      {
        key: "nama",
        label: "Nama Lembaga",
        type: "text",
        placeholder: "cth: ACT, Kitabisa",
      },
    ],
  },
};
