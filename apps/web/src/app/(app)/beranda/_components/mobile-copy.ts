import type { Locale } from "@/i18n";

/**
 * Copy for the phone Beranda (2026-10-20 references). Kept page-local so the
 * phone pass does not touch the shared dictionaries another agent is editing;
 * Indonesian first with English parity, picked by `useLocale().locale`.
 */
const COPY = {
  id: {
    netWorth: "Kekayaan bersih",
    netWorthDetail: "Lihat detail kekayaan bersih",
    asOf: "Posisi per {date}",
    sparkAria: "Tren kekayaan bersih {from} sampai {to}",
    spendMonth: "Pengeluaran bulan ini",
    recent: "Terakhir dicatat",
    seeAll: "Semua",
    seeAllAria: "Semua transaksi",
    reminders: "{n} pengingat",
    hidden: "Saldo disembunyikan",
  },
  en: {
    netWorth: "Net worth",
    netWorthDetail: "Open net worth detail",
    asOf: "As of {date}",
    sparkAria: "Net worth trend {from} to {to}",
    spendMonth: "Spending this month",
    recent: "Recently recorded",
    seeAll: "All",
    seeAllAria: "All transactions",
    reminders: "{n} reminders",
    hidden: "Balances hidden",
  },
} as const;

export function berandaMobileCopy(locale: Locale) {
  return locale === "en" ? COPY.en : COPY.id;
}
