// Shared mock data used across multiple pages.

export const USER = {
  name: "Irfan Arsandi",
  email: "irfan.arsandi@wealthme.id",
  initials: "IA",
  family: "Arsandi Family",
};

export const NET_WORTH = 1_256_780_000;

// Monthly cashflow (used by Beranda + several Laporan tabs)
export const CASHFLOW = {
  months: ["Nov", "Des", "Jan", "Feb", "Mar", "Apr"],
  income: [18, 20, 17, 22, 21, 25.85], // in juta (millions)
  expense: [14, 16, 15, 17, 18, 18.34],
  max: 30,
};

// 30-day wealth trend for the dashboard sparkline (in juta)
export const SPARKLINE_POINTS = [
  920, 925, 928, 922, 930, 938, 945, 940, 950, 955, 960, 958, 968, 972, 978, 970, 982, 988, 995,
  990, 1000, 1010, 1005, 1015, 1020, 1018, 1030, 1038, 1045, 1056,
];

export type SearchEntry = {
  label: string;
  sub: string;
  href: string;
  /** lucide icon name resolved in the search component */
  icon: string;
  color: string;
};

export const SEARCH_DATA: SearchEntry[] = [
  { label: "Beranda", sub: "Dashboard utama", href: "/beranda", icon: "Home", color: "var(--primary)" },
  { label: "Transaksi", sub: "Daftar semua transaksi", href: "/transaksi", icon: "ArrowUpDown", color: "var(--primary)" },
  { label: "Investasi", sub: "Portofolio saham, reksa dana, emas", href: "/investasi", icon: "BarChart3", color: "var(--success)" },
  { label: "Laporan", sub: "Ringkasan keuangan bulanan", href: "/laporan", icon: "LineChart", color: "var(--warning)" },
  { label: "Tujuan Keuangan", sub: "Dana darurat, DP rumah, pensiun", href: "/tujuan", icon: "Target", color: "var(--destructive)" },
  { label: "Anggaran", sub: "Budget per kategori", href: "/anggaran", icon: "ClipboardList", color: "var(--primary)" },
  { label: "Dana", sub: "Dompet & e-wallet", href: "/dana", icon: "Wallet", color: "var(--success)" },
  { label: "Rekening Bank", sub: "BCA, Mandiri, BNI", href: "/rekening", icon: "Landmark", color: "#1D4ED8" },
  { label: "Aset", sub: "Dana, rekening, investasi, properti", href: "/aset", icon: "Briefcase", color: "var(--brand-purple)" },
  { label: "Liabilitas", sub: "Kartu kredit & pinjaman", href: "/liabilitas", icon: "ReceiptText", color: "var(--destructive)" },
  { label: "Asuransi", sub: "Jiwa, kendaraan, properti", href: "/asuransi", icon: "ShieldCheck", color: "var(--success)" },
  { label: "AI Advisor", sub: "Analisa & rekomendasi AI", href: "/ai", icon: "Bot", color: "var(--foreground)" },
  { label: "Kalkulator", sub: "Investasi, KPR, pensiun, tabungan", href: "/kalkulator", icon: "Calculator", color: "var(--muted-foreground)" },
  { label: "Akun", sub: "Profil, pengaturan, bantuan", href: "/akun", icon: "User", color: "var(--primary)" },
  { label: "Notifikasi", sub: "Alert & pengingat", href: "/notifikasi", icon: "Bell", color: "var(--warning)" },
  { label: "BCA Tahapan ···9010", sub: "Rp 128.450.000 · Rekening Tabungan", href: "/rekening", icon: "Landmark", color: "#0061AF" },
  { label: "Mandiri ···5586", sub: "Rp 85.000.000 · Tabungan Rupiah", href: "/rekening", icon: "Landmark", color: "#F9A01B" },
  { label: "GoPay", sub: "Rp 45.000.000 · e-Wallet", href: "/dana", icon: "Wallet", color: "#00AED6" },
  { label: "BBCA - Bank Central Asia", sub: "Saham · +24,6% return", href: "/investasi", icon: "BarChart3", color: "#0061AF" },
  { label: "Reksa Dana Bibit", sub: "Campuran · +24,8% return", href: "/investasi", icon: "BarChart3", color: "var(--brand-purple)" },
  { label: "Dana Darurat", sub: "80% tercapai · Rp 24 jt / 30 jt", href: "/tujuan", icon: "Target", color: "var(--success)" },
  { label: "Dana Pensiun", sub: "25% tercapai · Rp 250 jt / 1 M", href: "/tujuan", icon: "Target", color: "var(--brand-purple)" },
];

// AI Advisor canned responses
export const AI_RESPONSES: Record<string, string> = {
  "analisa keuangan":
    "Bulan April 2025, keuanganmu sangat sehat! 💪\n\n• Pemasukan: Rp 25,85 jt\n• Pengeluaran: Rp 18,34 jt\n• Surplus: Rp 7,51 jt (Savings rate 29%)\n\nSavings rate 29% sudah bagus, namun pengeluaran gaya hidup naik 18% perlu diperhatikan.",
  "dp rumah":
    "Untuk DP Rumah Rp 300 jt, saat ini sudah 40% (Rp 120 jt). 🏠\n\nRekomendasi:\n1. Tingkatkan setoran dari Rp 5 jt → Rp 8 jt/bln\n2. Manfaatkan surplus Rp 7,5 jt bulanan\n3. Estimasi tercapai: 14 bulan lagi (Juli 2026)",
  portofolio:
    "Berdasarkan profil keuanganmu saat ini: 📊\n\n• Saham Blue Chip 35% (BBCA, TLKM)\n• Reksa Dana Campuran 30%\n• Obligasi Pemerintah 20%\n• Emas 10%\n• Crypto (optional) 5%\n\nPortofoliomu sudah terdiversifikasi dengan return 12,4% YTD! 👍",
  hemat:
    "Pengeluaran gaya hidupmu naik 18% → Rp 4,58 jt 💡\n\nTips:\n1. Set budget Rp 3,5 jt/bln untuk lifestyle\n2. Meal prep 3x seminggu → hemat ±Rp 300rb\n3. Batasi belanja online 1x seminggu\n4. Manfaatkan cashback kartu kredit",
  "kartu kredit":
    "Utang kartu kredit Rp 15,17 jt vs kekayaan Rp 1,256 M = rasio 1,2%. Sangat aman! ✅\n\nDebt-to-Asset ratio: 3,2% (ideal <30%). Pastikan bayar lunas setiap bulan untuk hindari bunga 2,25%/bulan.",
  proyeksi:
    "Proyeksi kekayaan dengan growth 8-12%/tahun: 📈\n\n• 2025: ~Rp 1,35 M\n• 2026: ~Rp 1,52 M\n• 2027: ~Rp 1,72 M\n• 2028: ~Rp 1,96 M\n• 2029: ~Rp 2,24 M\n\nPotensi capai Rp 2 Miliar pada 2028! 🎯",
};

export const AI_CHIPS = [
  "📊 Analisa keuangan bulan ini",
  "🏠 Strategi DP rumah",
  "📈 Rekomendasi portofolio",
  "💡 Tips hemat pengeluaran",
  "💳 Cek rasio utang",
  "🎯 Proyeksi kekayaan 5 tahun",
];

/** Resolve an AI response from free text, mirroring the demo's keyword logic. */
export function resolveAiResponse(text: string): string {
  const low = text.toLowerCase();
  if (low.includes("analisa")) return AI_RESPONSES["analisa keuangan"];
  if (low.includes("dp") || low.includes("rumah")) return AI_RESPONSES["dp rumah"];
  if (low.includes("portofolio") || low.includes("investasi")) return AI_RESPONSES["portofolio"];
  if (low.includes("hemat") || low.includes("tips")) return AI_RESPONSES["hemat"];
  if (low.includes("kredit") || low.includes("utang")) return AI_RESPONSES["kartu kredit"];
  if (low.includes("proyeksi") || low.includes("tahun")) return AI_RESPONSES["proyeksi"];
  return "Pertanyaan bagus! Berdasarkan data keuanganmu, saya sedang menganalisa. Coba lengkapi profil risiko untuk hasil lebih akurat ya! 😊";
}
