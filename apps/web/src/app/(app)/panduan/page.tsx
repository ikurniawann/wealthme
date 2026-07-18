"use client";

import { useRouter } from "next/navigation";
import {
  Home,
  PieChart,
  ArrowUpDown,
  ClipboardList,
  LineChart,
  Target,
  Wallet,
  Landmark,
  BarChart3,
  Briefcase,
  ReceiptText,
  ShieldCheck,
  Scroll,
  HeartHandshake,
  FileText,
  Receipt,
  GitCompare,
  Bot,
  Calculator,
  Zap,
  BookOpen,
  Database,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { SectionCard, CardLink, IconChip, Rise } from "@/components/wm";

type Feature = {
  icon: LucideIcon;
  chip: string;
  title: string;
  desc: string;
  href?: string;
};

type Journey = {
  title: string;
  subtitle: string;
  items: Feature[];
};

const JOURNEYS: Journey[] = [
  {
    title: "1. Mulai di sini",
    subtitle: "Kenali dashboard utamamu.",
    items: [
      {
        icon: Home,
        chip: "bg-blue-100 text-blue-600",
        title: "Beranda",
        desc: "Buka setiap hari untuk memantau kekayaan bersih, tren bulanan, arus kas, dan aktivitas terbaru dalam satu layar.",
        href: "/beranda",
      },
      {
        icon: PieChart,
        chip: "bg-violet-100 text-violet-600",
        title: "Ringkasan",
        desc: "Butuh versi ringkas? Halaman ini menampilkan komposisi aset dan statistik kunci tanpa detail beranda.",
        href: "/ringkasan",
      },
    ],
  },
  {
    title: "2. Siapkan uangmu",
    subtitle: "Tambahkan rekening & dompet supaya kekayaanmu tercatat lengkap.",
    items: [
      {
        icon: Landmark,
        chip: "bg-blue-100 text-blue-600",
        title: "Rekening",
        desc: 'Klik "Tambah" untuk mendaftarkan rekening bank pertamamu — saldonya otomatis masuk ke kekayaan bersih dan mutasinya tercatat per rekening.',
        href: "/rekening",
      },
      {
        icon: Wallet,
        chip: "bg-green-100 text-green-600",
        title: "Dana",
        desc: "Tambahkan saldo kas tunai atau e-wallet (GoPay, OVO, DANA) yang belum tercatat di rekening bank.",
        href: "/dana",
      },
      {
        icon: Database,
        chip: "bg-gray-100 text-gray-600",
        title: "Setup Master Data",
        desc: "Sesuaikan kategori transaksi (makan, transport, gaji, dll) di sini — dipakai bersama oleh anggaran dan laporan.",
        href: "/masterdata",
      },
    ],
  },
  {
    title: "3. Catat aktivitas",
    subtitle: "Ini yang paling sering kamu pakai sehari-hari.",
    items: [
      {
        icon: Plus,
        chip: "bg-indigo-100 text-indigo-600",
        title: 'Tombol "+" Tambah Transaksi',
        desc: 'Klik ikon "+" di sidebar dari halaman mana pun untuk mencatat pemasukan, pengeluaran, atau transfer dalam hitungan detik.',
      },
      {
        icon: ArrowUpDown,
        chip: "bg-indigo-100 text-indigo-600",
        title: "Transaksi",
        desc: "Gunakan filter tanggal/kategori untuk menelusuri riwayat, atau ketuk satu baris untuk mengubah maupun menghapusnya.",
        href: "/transaksi",
      },
      {
        icon: Zap,
        chip: "bg-amber-100 text-amber-600",
        title: "Quick Input",
        desc: "Tekan tombol ini untuk memilih jenis data (transaksi, rekening, aset, dll), lalu langsung isi formulirnya tanpa pindah halaman.",
        href: "/quickinput",
      },
      {
        icon: Search,
        chip: "bg-slate-100 text-slate-600",
        title: "Pencarian (Ctrl/Cmd+K)",
        desc: "Tekan Ctrl/Cmd+K kapan saja untuk melompat ke halaman atau mencari transaksi, rekening, dan kategori.",
      },
    ],
  },
  {
    title: "4. Rencanakan",
    subtitle: "Beri arah pada uangmu.",
    items: [
      {
        icon: ClipboardList,
        chip: "bg-indigo-100 text-indigo-600",
        title: "Anggaran",
        desc: 'Klik "Tambah Kategori", tentukan batas bulanan per kategori — WealthMe otomatis memperingatkanmu saat mendekati batas.',
        href: "/anggaran",
      },
      {
        icon: Target,
        chip: "bg-cyan-100 text-cyan-600",
        title: "Tujuan Keuangan",
        desc: "Buat target (misal dana darurat), atur nominal & tenggat, lalu aktifkan auto-debit bulanan agar progressnya naik sendiri.",
        href: "/tujuan",
      },
    ],
  },
  {
    title: "5. Tumbuh & lindungi kekayaan",
    subtitle: "Lengkapi gambaran kekayaanmu — opsional, isi sesuai kebutuhan.",
    items: [
      {
        icon: BarChart3,
        chip: "bg-violet-100 text-violet-600",
        title: "Investasi",
        desc: 'Klik "+ Tambah Investasi", pilih jenis aset (saham, reksa dana, emas, kripto) — harga & untung/rugi terupdate real-time.',
        href: "/investasi",
      },
      {
        icon: Briefcase,
        chip: "bg-yellow-100 text-yellow-600",
        title: "Aset",
        desc: 'Klik "Tambah Aset" untuk mencatat properti, kendaraan, atau elektronik beserta estimasi nilainya saat ini.',
        href: "/aset",
      },
      {
        icon: ReceiptText,
        chip: "bg-red-100 text-red-600",
        title: "Liabilitas",
        desc: 'Klik "Tambah Liabilitas" untuk mencatat KPR, kartu kredit, atau cicilan — kekayaan bersihmu otomatis dikurangi sisa utang.',
        href: "/liabilitas",
      },
      {
        icon: ShieldCheck,
        chip: "bg-purple-100 text-purple-600",
        title: "Asuransi",
        desc: 'Klik "Tambah" untuk menyimpan polis jiwa, kesehatan, kendaraan, atau properti beserta premi dan masa berlakunya.',
        href: "/asuransi",
      },
    ],
  },
  {
    title: "6. Laporan & alat bantu",
    subtitle: "Ambil manfaat dari data yang sudah kamu catat.",
    items: [
      {
        icon: LineChart,
        chip: "bg-indigo-100 text-indigo-600",
        title: "Laporan",
        desc: "Pilih jenis laporan (laba-rugi, neraca, arus kas, performa investasi) dan rentang tanggal untuk analisis mendalam.",
        href: "/laporan",
      },
      {
        icon: Calculator,
        chip: "bg-emerald-100 text-emerald-600",
        title: "Kalkulator",
        desc: "Pilih kalkulator yang kamu butuhkan (zakat, PPh 21, kredit, pensiun, dll), isi angkanya, hasilnya langsung muncul.",
        href: "/kalkulator",
      },
      {
        icon: FileText,
        chip: "bg-emerald-100 text-emerald-600",
        title: "Tax Center",
        desc: "Isi penghasilan bulananmu untuk menghitung PPh 21 progresif, lalu tandai status pelaporan SPT tahunanmu.",
        href: "/tax",
      },
      {
        icon: GitCompare,
        chip: "bg-sky-100 text-sky-600",
        title: "Rekonsiliasi Bank",
        desc: "Unggah file mutasi bank (CSV) — WealthMe mencocokkannya otomatis dengan transaksi yang sudah kamu catat.",
        href: "/rekonsiliasi",
      },
    ],
  },
  {
    title: "7. Keluarga & berbagi",
    subtitle: "Kelola keuangan bersama.",
    items: [
      {
        icon: HeartHandshake,
        chip: "bg-green-100 text-green-600",
        title: "Donasi & Zakat",
        desc: "Hitung zakat maal dari total asetmu, lalu catat infaq, sedekah, atau wakaf yang sudah kamu keluarkan.",
        href: "/donation",
      },
      {
        icon: Receipt,
        chip: "bg-amber-100 text-amber-600",
        title: "Split Bill",
        desc: "Buat tagihan bersama, tambahkan peserta, lalu lacak siapa yang sudah dan belum membayar bagiannya.",
        href: "/splitbill",
      },
      {
        icon: Scroll,
        chip: "bg-purple-100 text-purple-600",
        title: "Warisan",
        desc: "Catat daftar aset dan ahli waris untuk merencanakan pembagian warisan keluarga.",
        href: "/warisan",
      },
    ],
  },
  {
    title: "8. Konfigurasi lanjutan",
    subtitle: "Untuk kebutuhan akuntansi & multi-user — opsional.",
    items: [
      {
        icon: BookOpen,
        chip: "bg-blue-100 text-blue-600",
        title: "Master COA",
        desc: "Untuk kebutuhan akuntansi lanjutan: kelola struktur akun (COA) yang dipakai laporan laba-rugi & neraca.",
        href: "/mastercoa",
      },
    ],
  },
  {
    title: "9. Asisten AI",
    subtitle: "Tanya kapan saja.",
    items: [
      {
        icon: Bot,
        chip: "bg-slate-100 text-slate-600",
        title: "AI Advisor",
        desc: "Ketik pertanyaan seputar keuanganmu — AI menganalisis data transaksimu dan memberi saran konkret.",
        href: "/ai",
      },
    ],
  },
];

export default function PanduanPage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="mb-1">
        <div className="text-[15px] font-bold">📖 Panduan Fitur WealthMe</div>
        <div className="text-[12px] text-muted-foreground">
          Semua fitur, dikelompokkan berdasarkan alur pemakaian — jelajahi
          sesuai kebutuhanmu.
        </div>
      </div>

      {JOURNEYS.map((journey, ji) => (
        <Rise key={journey.title} index={ji}>
          <SectionCard title={journey.title}>
            <div className="-mt-2 mb-3 text-[12px] text-muted-foreground">
              {journey.subtitle}
            </div>
            <div className="space-y-1">
              {journey.items.map((f) => (
                <div
                  key={f.title}
                  className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-accent/50"
                >
                  <IconChip icon={f.icon} className={f.chip} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{f.title}</div>
                    <div className="text-[12px] leading-relaxed text-muted-foreground">
                      {f.desc}
                    </div>
                  </div>
                  {f.href && (
                    <CardLink
                      onClick={() => router.push(f.href as string)}
                      className="shrink-0 rounded-md border bg-card px-3 py-1.5 text-[11.5px] no-underline shadow-sm transition-colors hover:border-primary hover:no-underline"
                    >
                      Buka →
                    </CardLink>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </Rise>
      ))}
    </div>
  );
}
