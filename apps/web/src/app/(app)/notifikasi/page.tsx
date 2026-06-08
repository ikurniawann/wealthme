"use client";

import { toast } from "sonner";

import { SectionCard, CardLink, StatusBadge } from "@/components/wm";

type Notif = {
  icon: string;
  iconBg: string;
  title: string;
  desc: string;
  time: string;
  badge?: { variant: "success" | "danger"; label: string };
  dimmed?: boolean;
  noBorder?: boolean;
};

const NOTIFS: Notif[] = [
  {
    icon: "📥",
    iconBg: "#DCFCE7",
    title: "Transfer masuk dari BCA",
    desc: "+Rp 5.000.000 berhasil diterima di BCA Tahapan",
    time: "09:21 · Hari ini",
    badge: { variant: "success", label: "Baru" },
  },
  {
    icon: "🎯",
    iconBg: "#FEF9C3",
    title: "Dana Darurat hampir tercapai!",
    desc: "80% dari target Rp 30.000.000 sudah terkumpul",
    time: "08:00 · Hari ini",
    badge: { variant: "success", label: "Baru" },
  },
  {
    icon: "⚠️",
    iconBg: "#FEE2E2",
    title: "Anggaran Gaya Hidup melebihi batas",
    desc: "115% dari budget Rp 4.000.000 sudah terpakai",
    time: "07:30 · Hari ini",
    badge: { variant: "danger", label: "Alert" },
  },
  {
    icon: "📊",
    iconBg: "#EDE9FE",
    title: "Laporan April siap",
    desc: "Ringkasan keuangan April 2025 tersedia",
    time: "3 hari lalu",
    dimmed: true,
  },
  {
    icon: "📈",
    iconBg: "#DCFCE7",
    title: "Dividen BBCA masuk",
    desc: "+Rp 750.000 dari dividen saham BBCA",
    time: "1 Mei 2025",
    dimmed: true,
  },
  {
    icon: "💳",
    iconBg: "#FEF9C3",
    title: "Tagihan kartu kredit jatuh tempo",
    desc: "Kartu Kredit Mandiri — 5 hari lagi",
    time: "28 Apr 2025",
    dimmed: true,
    noBorder: true,
  },
];

export default function NotifikasiPage() {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          Notifikasi <StatusBadge variant="danger">3 Baru</StatusBadge>
        </span>
      }
      action={
        <CardLink onClick={() => toast.success("✅ Semua ditandai dibaca")}>
          Tandai semua dibaca
        </CardLink>
      }
      bodyClassName="flex flex-col"
    >
      {NOTIFS.map((n, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 py-3.5 ${
            n.noBorder ? "" : "border-b"
          } ${n.dimmed ? "opacity-60" : ""} ${i === 0 ? "pt-0" : ""}`}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]"
            style={{ background: n.iconBg }}
          >
            {n.icon}
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold text-foreground">{n.title}</div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">{n.desc}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{n.time}</div>
          </div>
          {n.badge && (
            <StatusBadge variant={n.badge.variant} className="text-[10px]">
              {n.badge.label}
            </StatusBadge>
          )}
        </div>
      ))}
    </SectionCard>
  );
}
