"use client";

import { Eye, Lock, ShieldCheck, WalletCards } from "lucide-react";
import { IconChip, ProgressBar, StatusBadge } from "@/components/wm";

const permissions = [
  {
    title: "Rekening Ditugaskan",
    value: "Kas Operasional",
    description: "Boleh mencatat transaksi keluar dan melihat mutasi terkait.",
    icon: WalletCards,
    tone: "success",
    progress: 76,
  },
  {
    title: "Saldo Keluarga",
    value: "Tidak terlihat",
    description: "Saldo global, investasi, dan aset keluarga disembunyikan.",
    icon: Lock,
    tone: "danger",
    progress: 0,
  },
  {
    title: "Laporan",
    value: "Ringkasan pribadi",
    description: "Hanya laporan dari rekening dan transaksi yang ditugaskan.",
    icon: Eye,
    tone: "info",
    progress: 42,
  },
] as const;

const toneClass = {
  success: "bg-emerald-500/12 text-emerald-600",
  danger: "bg-red-500/12 text-red-600",
  info: "bg-cyan-500/12 text-cyan-600",
} as const;

export default function MyAccessPage() {
  return (
    <div className="page stack">
      <section className="hero gradient-profile">
        <div className="row row--between row--wrap">
          <div>
            <div className="hero__label">Akun Anak / Staff</div>
            <h1 className="hero__value">Akses Saya</h1>
            <p className="text-white/80">
              Lihat data apa saja yang bisa kamu akses di WealthMe keluarga.
            </p>
          </div>
          <StatusBadge variant="success">Role: Staff Operasional</StatusBadge>
        </div>
      </section>

      <section className="auto-grid auto-grid--wide">
        {permissions.map((item) => {
          const Icon = item.icon;
          return (
            <article className="card" key={item.title}>
              <div className="card__body stack">
                <div className="row row--between">
                  <IconChip icon={Icon} className={toneClass[item.tone]} />
                  <StatusBadge variant={item.tone}>{item.value}</StatusBadge>
                </div>
                <div>
                  <h2 className="t-md">{item.title}</h2>
                  <p className="t-sm text-muted">{item.description}</p>
                </div>
                <ProgressBar value={item.progress} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Aktivitas yang Diizinkan</h2>
            <p className="text-muted">
              Semua aksi di bawah ini tetap tercatat dan bisa ditinjau Master.
            </p>
          </div>
          <StatusBadge variant="info">Read + Input terbatas</StatusBadge>
        </div>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Aktivitas</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Input transaksi operasional</td>
                  <td>
                    <StatusBadge variant="success">Diizinkan</StatusBadge>
                  </td>
                  <td>Hanya rekening Kas Operasional.</td>
                </tr>
                <tr>
                  <td className="font-semibold">Melihat laporan keluarga</td>
                  <td>
                    <StatusBadge variant="danger">Dikunci</StatusBadge>
                  </td>
                  <td>Perlu approval Master.</td>
                </tr>
                <tr>
                  <td className="font-semibold">Mengubah role anggota</td>
                  <td>
                    <StatusBadge variant="danger">Dikunci</StatusBadge>
                  </td>
                  <td>Hanya Master yang bisa mengubah IAM.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="notice notice--info">
        <ShieldCheck size={16} />
        Kalau butuh akses tambahan, ajukan dari halaman ini dan tunggu persetujuan
        Master.
      </div>
    </div>
  );
}
