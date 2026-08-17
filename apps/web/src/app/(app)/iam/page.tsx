"use client";

import {
  CheckCircle2,
  Crown,
  Eye,
  KeyRound,
  Lock,
  Plus,
  ShieldCheck,
  UserRoundPlus,
  WalletCards,
} from "lucide-react";
import { IconChip, ProgressBar, StatusBadge } from "@/components/wm";

const roles = [
  {
    name: "Master",
    description: "Pemilik utama keluarga, akses penuh ke data, role, dan audit.",
    members: 1,
    icon: Crown,
    tone: "success",
    permissions: ["Kelola role", "Semua rekening", "Export laporan", "Audit log"],
  },
  {
    name: "Co-Master",
    description: "Pasangan atau orang tepercaya yang bisa ikut mengatur keluarga.",
    members: 1,
    icon: ShieldCheck,
    tone: "info",
    permissions: ["Lihat semua", "Setujui dana", "Kelola anggota"],
  },
  {
    name: "Anak",
    description: "Akses terbatas untuk tabungan, tujuan, dan edukasi finansial.",
    members: 2,
    icon: Eye,
    tone: "purple",
    permissions: ["Saldo sendiri", "Tujuan pribadi", "Tidak bisa hapus"],
  },
  {
    name: "Staff Operasional",
    description: "Asisten, supir, atau admin yang hanya mencatat transaksi tertentu.",
    members: 1,
    icon: WalletCards,
    tone: "warning",
    permissions: ["Input transaksi", "Rekening ditugaskan", "Tanpa saldo keluarga"],
  },
] as const;

const permissionRows = [
  ["Lihat kekayaan keluarga", "Ya", "Ya", "Tidak", "Tidak"],
  ["Kelola rekening & saldo", "Ya", "Terbatas", "Tidak", "Tidak"],
  ["Input transaksi", "Ya", "Ya", "Terbatas", "Ya"],
  ["Setujui permintaan dana", "Ya", "Ya", "Tidak", "Tidak"],
  ["Kelola IAM roles", "Ya", "Tidak", "Tidak", "Tidak"],
  ["Export laporan", "Ya", "Ya", "Tidak", "Tidak"],
] as const;

const roleToneClass = {
  success: "bg-emerald-500/12 text-emerald-600",
  info: "bg-cyan-500/12 text-cyan-600",
  purple: "bg-violet-500/12 text-violet-600",
  warning: "bg-amber-500/12 text-amber-600",
} as const;

const activeMembers = [
  {
    name: "Demo User",
    role: "Master",
    scope: "Semua data keluarga",
    status: "Aktif",
    lastSeen: "Hari ini",
  },
  {
    name: "Siti Arsandi",
    role: "Co-Master",
    scope: "Semua rekening keluarga",
    status: "Aktif",
    lastSeen: "Kemarin",
  },
  {
    name: "Aisyah",
    role: "Anak",
    scope: "Tabungan pendidikan",
    status: "Terbatas",
    lastSeen: "12 Agu",
  },
  {
    name: "Pak Dedi",
    role: "Staff Operasional",
    scope: "Kas operasional",
    status: "Terbatas",
    lastSeen: "10 Agu",
  },
];

function RoleCard({ role }: { role: (typeof roles)[number] }) {
  const Icon = role.icon;

  return (
    <article className="card">
      <div className="card__body stack">
        <div className="row row--between">
          <IconChip icon={Icon} className={roleToneClass[role.tone]} />
          <StatusBadge variant={role.tone}>{role.members} anggota</StatusBadge>
        </div>
        <div>
          <h3 className="t-md">{role.name}</h3>
          <p className="t-sm text-muted">{role.description}</p>
        </div>
        <div className="chips">
          {role.permissions.map((permission) => (
            <span className="badge badge--gray" key={permission}>
              {permission}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function PermissionValue({ value }: { value: string }) {
  const variant =
    value === "Ya" ? "success" : value === "Tidak" ? "danger" : "warning";

  return <StatusBadge variant={variant}>{value}</StatusBadge>;
}

export default function IamRolesPage() {
  return (
    <div className="page stack">
      <section className="hero gradient-profile">
        <div className="row row--between row--wrap">
          <div>
            <div className="hero__label">Master Account</div>
            <h1 className="hero__value">IAM Roles</h1>
            <p className="text-white/80">
              Atur siapa yang boleh melihat, mencatat, menyetujui, dan mengubah
              data keluarga.
            </p>
          </div>
          <div className="row">
            <a className="btn btn--outline border-white/40 text-white hover:bg-white/15" href="/akses-saya">
              Preview Anak / Staff
            </a>
            <button className="btn bg-white text-slate-900 hover:bg-white/90" type="button">
              <Plus size={16} />
              Buat Role
            </button>
          </div>
        </div>
      </section>

      <section className="auto-grid auto-grid--wide">
        {roles.map((role) => (
          <RoleCard key={role.name} role={role} />
        ))}
      </section>

      <section className="grid grid--sidebar grid--stack-sm">
        <article className="card">
          <div className="card__header">
            <div>
              <h2>Role Permission Matrix</h2>
              <p className="text-muted">Ringkasan hak akses utama per role.</p>
            </div>
            <button className="btn btn--outline" type="button">
              <KeyRound size={16} />
              Kelola Permission
            </button>
          </div>
          <div className="card__body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    <th>Master</th>
                    <th>Co-Master</th>
                    <th>Anak</th>
                    <th>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map(([permission, master, coMaster, child, staff]) => (
                    <tr key={permission}>
                      <td className="font-semibold">{permission}</td>
                      {[master, coMaster, child, staff].map((value, index) => (
                        <td key={`${permission}-${index}`}>
                          <PermissionValue value={value} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <aside className="stack">
          <article className="card">
            <div className="card__header">
              <h2>Security Defaults</h2>
            </div>
            <div className="card__body stack">
              <div className="notice notice--info">
                <Lock size={16} />
                Anak dan staff tidak bisa melihat saldo keluarga kecuali
                ditugaskan langsung oleh Master.
              </div>
              <div>
                <div className="row row--between">
                  <span className="t-sm font-semibold">Cakupan akses terbatas</span>
                  <span className="mono t-sm">82%</span>
                </div>
                <ProgressBar value={82} />
              </div>
            </div>
          </article>

          <article className="card">
            <div className="card__header">
              <h2>Permintaan Akses</h2>
              <StatusBadge variant="warning">2 pending</StatusBadge>
            </div>
            <div className="card__body stack">
              <div className="list-row">
                <IconChip
                  icon={UserRoundPlus}
                  className="bg-amber-500/12 text-amber-600"
                />
                <div>
                  <div className="font-semibold">Pak Dedi minta akses GoPay</div>
                  <div className="text-muted t-sm">Perlu approval Master</div>
                </div>
              </div>
              <div className="list-row">
                <IconChip icon={Eye} className="bg-cyan-500/12 text-cyan-600" />
                <div>
                  <div className="font-semibold">Aisyah minta lihat tujuan DP</div>
                  <div className="text-muted t-sm">Akses baca saja</div>
                </div>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Anggota & Akses Aktif</h2>
            <p className="text-muted">
              Pantau role, cakupan data, dan aktivitas login terakhir.
            </p>
          </div>
          <button className="btn btn--primary" type="button">
            <UserRoundPlus size={16} />
            Assign Akses
          </button>
        </div>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Role</th>
                  <th>Cakupan</th>
                  <th>Status</th>
                  <th>Terakhir aktif</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((member) => (
                  <tr key={`${member.name}-${member.role}`}>
                    <td className="font-semibold">{member.name}</td>
                    <td>
                      <StatusBadge variant="info">{member.role}</StatusBadge>
                    </td>
                    <td>{member.scope}</td>
                    <td>
                      <StatusBadge
                        variant={member.status === "Aktif" ? "success" : "warning"}
                      >
                        {member.status}
                      </StatusBadge>
                    </td>
                    <td>{member.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="notice notice--success">
        <CheckCircle2 size={16} />
        Semua perubahan role tercatat di audit log dan berlaku langsung di
        halaman anak / staff.
      </div>
    </div>
  );
}
