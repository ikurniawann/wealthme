import {
  Plus,
  Landmark,
  ArrowUpDown,
  Briefcase,
  BarChart3,
  ReceiptText,
  ShieldCheck,
  ClipboardList,
  BookOpen,
  LineChart,
  Bot,
  type LucideIcon,
} from "lucide-react";

export type TourStep = {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** CSS selector for the element to spotlight; omit for a centered card. */
  target?: string;
  /** Route to navigate to before locating the target. */
  route?: string;
  actionLabel?: string;
  actionHref?: string;
  /**
   * When true, `target` is a real "Tambah"/add trigger on the page (not just
   * a sidebar nav link) — the card's primary CTA clicks it for real (opening
   * that page's own add-modal) instead of only navigating.
   */
  directAction?: boolean;
};

// Walks a new user through recording activity, building out every net-worth
// category (rekening/aset/investasi/liabilitas/asuransi), planning a budget,
// then reviewing reports and the AI advisor. The full feature set — every
// page, in detail — lives at /panduan.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "add-transaction",
    icon: Plus,
    title: "Catat transaksi kapan saja",
    body: 'Tombol "+" ini selalu ada di sidebar — klik untuk mencatat pemasukan, pengeluaran, atau transfer dalam hitungan detik.',
    target: '[data-tour="add-transaction"]',
    route: "/beranda",
    directAction: true,
    actionLabel: "Catat Transaksi Sekarang",
  },
  {
    id: "transaksi",
    icon: ArrowUpDown,
    title: "Pantau semua transaksi",
    body: "Semua transaksi yang kamu catat muncul di sini — bisa difilter, diurutkan, diedit, atau dihapus kapan saja.",
    target: '[data-tour="nav-transaksi"]',
    actionLabel: "Buka Transaksi",
    actionHref: "/transaksi",
  },
  {
    id: "rekening",
    icon: Landmark,
    title: "Tambahkan rekening & dompetmu",
    body: "Mulai dari sini: tambahkan rekening bank supaya WealthMe bisa menghitung kekayaan bersihmu secara otomatis. Klik tombol di bawah untuk langsung menambahkannya.",
    target: '[data-tour="add-rekening"]',
    route: "/rekening",
    directAction: true,
    actionLabel: "Tambah Rekening Sekarang",
  },
  {
    id: "aset",
    icon: Briefcase,
    title: "Catat aset fisikmu",
    body: "Properti, kendaraan, elektronik — semua aset fisik ikut dihitung dalam kekayaan bersihmu. Tambahkan yang pertama sekarang.",
    target: '[data-tour="add-aset"]',
    route: "/aset",
    directAction: true,
    actionLabel: "Tambah Aset Sekarang",
  },
  {
    id: "investasi",
    icon: BarChart3,
    title: "Lacak investasimu",
    body: "Saham, reksa dana, obligasi, emas, sampai kripto — harga dan untung/rugi terupdate real-time begitu kamu tambahkan.",
    target: '[data-tour="add-investasi"]',
    route: "/investasi",
    directAction: true,
    actionLabel: "Tambah Investasi Sekarang",
  },
  {
    id: "liabilitas",
    icon: ReceiptText,
    title: "Catat utang & cicilanmu",
    body: "KPR, kartu kredit, cicilan kendaraan — supaya kekayaan bersihmu akurat, WealthMe mengurangkannya dari total asetmu.",
    target: '[data-tour="add-liabilitas"]',
    route: "/liabilitas",
    directAction: true,
    actionLabel: "Tambah Liabilitas Sekarang",
  },
  {
    id: "asuransi",
    icon: ShieldCheck,
    title: "Simpan data polis asuransimu",
    body: "Jiwa, kesehatan, kendaraan, properti — simpan detail polis dan premi supaya rencana proteksimu tercatat lengkap.",
    target: '[data-tour="add-asuransi"]',
    route: "/asuransi",
    directAction: true,
    actionLabel: "Tambah Asuransi Sekarang",
  },
  {
    id: "anggaran",
    icon: ClipboardList,
    title: "Buat anggaran bulanan",
    body: "Tetapkan batas pengeluaran per kategori. WealthMe otomatis memberi peringatan saat kamu mendekati batas.",
    target: '[data-tour="add-anggaran"]',
    route: "/anggaran",
    directAction: true,
    actionLabel: "Tambah Anggaran Sekarang",
  },
  {
    id: "mastercoa",
    icon: BookOpen,
    title: "Kenali Master COA (Chart of Accounts)",
    body: "COA menentukan arah pemasukan/pengeluaran tiap kategori supaya laporan laba-rugi dan neracamu akurat. Sudah ada 78 akun standar — tambahkan akun baru kalau perlu.",
    target: '[data-tour="add-mastercoa"]',
    route: "/mastercoa",
    directAction: true,
    actionLabel: "Tambah Akun COA Sekarang",
  },
  {
    id: "laporan",
    icon: LineChart,
    title: "Lihat laporan keuanganmu",
    body: "Setelah ada data, jelajahi belasan jenis laporan — dari ringkasan bulanan sampai laba-rugi dan neraca keuangan keluarga.",
    target: '[data-tour="nav-laporan"]',
    actionLabel: "Buka Laporan",
    actionHref: "/laporan",
  },
  {
    id: "ai",
    icon: Bot,
    title: "Tanya AI Advisor",
    body: "Punya pertanyaan soal keuanganmu? AI Advisor siap membantu menganalisis pengeluaran dan memberi saran.",
    target: '[data-tour="nav-ai"]',
    actionLabel: "Coba AI Advisor",
    actionHref: "/ai",
  },
];
