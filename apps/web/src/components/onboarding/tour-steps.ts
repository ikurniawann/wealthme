import {
  Plus,
  Landmark,
  ArrowUpDown,
  ClipboardList,
  LineChart,
  Bot,
  type LucideIcon,
} from "lucide-react";

export type TourStep = {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** CSS selector for the sidebar element to spotlight; omit for a centered card. */
  target?: string;
  /** Route to navigate to before locating the target. */
  route?: string;
  actionLabel?: string;
  actionHref?: string;
};

// Critical-path only (~1 minute) — the full feature set lives at /panduan.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "add-transaction",
    icon: Plus,
    title: "Catat transaksi kapan saja",
    body: 'Tombol "+" ini selalu ada di sidebar — klik untuk mencatat pemasukan, pengeluaran, atau transfer dalam hitungan detik.',
    target: '[data-tour="add-transaction"]',
    route: "/beranda",
  },
  {
    id: "rekening",
    icon: Landmark,
    title: "Tambahkan rekening & dompetmu",
    body: "Mulai dari sini: tambahkan rekening bank, e-wallet, atau kas supaya WealthMe bisa menghitung kekayaan bersihmu secara otomatis.",
    target: '[data-tour="nav-rekening"]',
    actionLabel: "Buka Rekening",
    actionHref: "/rekening",
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
    id: "anggaran",
    icon: ClipboardList,
    title: "Buat anggaran bulanan",
    body: "Tetapkan batas pengeluaran per kategori. WealthMe otomatis memberi peringatan saat kamu mendekati batas.",
    target: '[data-tour="nav-anggaran"]',
    actionLabel: "Buka Anggaran",
    actionHref: "/anggaran",
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
