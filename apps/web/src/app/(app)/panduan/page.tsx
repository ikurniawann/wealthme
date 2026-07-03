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
        desc: "Ringkasan kekayaan bersih, tren, arus kas, dan aktivitas terbaru dalam satu layar.",
        href: "/beranda",
      },
      {
        icon: PieChart,
        chip: "bg-violet-100 text-violet-600",
        title: "Ringkasan",
        desc: "Versi ringkas dashboard — komposisi aset dan statistik kunci.",
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
        desc: "Kelola rekening bank — saldo, mutasi, dan detail per rekening.",
        href: "/rekening",
      },
      {
        icon: Wallet,
        chip: "bg-green-100 text-green-600",
        title: "Dana",
        desc: "Kas tunai dan e-wallet (GoPay, OVO, DANA, dll).",
        href: "/dana",
      },
      {
        icon: Database,
        chip: "bg-gray-100 text-gray-600",
        title: "Setup Master Data",
        desc: "Kelola kategori transaksi yang dipakai di seluruh aplikasi.",
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
        desc: "Selalu ada di sidebar — catat pemasukan, pengeluaran, atau transfer dalam beberapa detik dari halaman mana pun.",
      },
      {
        icon: ArrowUpDown,
        chip: "bg-indigo-100 text-indigo-600",
        title: "Transaksi",
        desc: "Lihat, filter, urutkan, edit, dan hapus semua transaksi tercatat.",
        href: "/transaksi",
      },
      {
        icon: Zap,
        chip: "bg-amber-100 text-amber-600",
        title: "Quick Input",
        desc: "Launcher pintasan untuk menambah data apa pun dengan cepat.",
        href: "/quickinput",
      },
      {
        icon: Search,
        chip: "bg-slate-100 text-slate-600",
        title: "Pencarian (Ctrl/Cmd+K)",
        desc: "Cari halaman atau data keuangan (transaksi, rekening, kategori) dari mana saja.",
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
        desc: "Set batas pengeluaran per kategori, dengan peringatan otomatis saat mendekati batas.",
        href: "/anggaran",
      },
      {
        icon: Target,
        chip: "bg-cyan-100 text-cyan-600",
        title: "Tujuan Keuangan",
        desc: "Buat target menabung dengan progress bar dan opsi auto-debit bulanan.",
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
        desc: "Lacak saham, reksa dana, obligasi, emas, kripto dengan harga real-time.",
        href: "/investasi",
      },
      {
        icon: Briefcase,
        chip: "bg-yellow-100 text-yellow-600",
        title: "Aset",
        desc: "Catat properti, kendaraan, elektronik, dan aset fisik lain.",
        href: "/aset",
      },
      {
        icon: ReceiptText,
        chip: "bg-red-100 text-red-600",
        title: "Liabilitas",
        desc: "Kelola utang — KPR, kartu kredit, cicilan kendaraan — dan progress pelunasannya.",
        href: "/liabilitas",
      },
      {
        icon: ShieldCheck,
        chip: "bg-purple-100 text-purple-600",
        title: "Asuransi",
        desc: "Simpan data polis jiwa, kesehatan, kendaraan, properti.",
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
        desc: "Belasan jenis laporan — ringkasan, laba-rugi, neraca, arus kas, performa investasi, dan lainnya.",
        href: "/laporan",
      },
      {
        icon: Calculator,
        chip: "bg-emerald-100 text-emerald-600",
        title: "Kalkulator",
        desc: "Kalkulator zakat, PPh 21, investasi, kredit, pensiun, tabungan, dan split bill.",
        href: "/kalkulator",
      },
      {
        icon: FileText,
        chip: "bg-emerald-100 text-emerald-600",
        title: "Tax Center",
        desc: "Hitung PPh 21 progresif dan kelola status pelaporan SPT.",
        href: "/tax",
      },
      {
        icon: GitCompare,
        chip: "bg-sky-100 text-sky-600",
        title: "Rekonsiliasi Bank",
        desc: "Unggah mutasi bank, cocokkan otomatis dengan transaksi tercatat.",
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
        desc: "Hitung zakat maal, catat infaq/sedekah/wakaf.",
        href: "/donation",
      },
      {
        icon: Receipt,
        chip: "bg-amber-100 text-amber-600",
        title: "Split Bill",
        desc: "Buat tagihan bersama dan lacak siapa sudah/belum bayar.",
        href: "/splitbill",
      },
      {
        icon: Scroll,
        chip: "bg-purple-100 text-purple-600",
        title: "Warisan",
        desc: "Rencanakan warisan — catat aset dan ahli waris.",
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
        desc: "Chart of Accounts — kelola struktur akun akuntansi keluarga.",
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
        desc: "Chat dengan asisten AI untuk analisis pengeluaran dan saran keuangan.",
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
                  className="flex items-start gap-3 rounded-lg py-2.5 transition-colors hover:bg-accent/50"
                >
                  <IconChip icon={f.icon} className={f.chip} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{f.title}</div>
                    <div className="text-[12px] leading-relaxed text-muted-foreground">
                      {f.desc}
                    </div>
                  </div>
                  {f.href && (
                    <CardLink onClick={() => router.push(f.href as string)}>
                      Buka
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
