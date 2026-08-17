"use client";

import { Eye, Lock, ShieldCheck, WalletCards } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { IconChip, StatusBadge } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";

/**
 * The landing page for a row-scoped member (`dependant` = "Anak",
 * `operational` = "Staff Operasional") — see `RowScopedRouteGuard`.
 *
 * This page used to be a pure static mock: the role badge read
 * "Role: Staff Operasional" for EVERY viewer (so a child was told they were
 * staff), "Rekening Ditugaskan" always said "Kas Operasional", and the three
 * cards carried invented completion percentages (76% / 0% / 42%) that
 * measured nothing.
 *
 * Worse, it claimed the viewer had report access ("Laporan — Ringkasan
 * pribadi"). Verified live: `GET /reports/summary` answers **403** for both
 * row-scoped roles. Promising access the API refuses is the one thing a
 * permissions screen must never do, so that card now states the real answer.
 *
 * Everything below is either read from the API or is a statement that was
 * checked against the server's actual behaviour — nothing is invented.
 */

type AccountRow = { id: string; name: string };

const toneClass = {
  success: "bg-emerald-500/12 text-emerald-600",
  danger: "bg-red-500/12 text-red-600",
  info: "bg-cyan-500/12 text-cyan-600",
} as const;

export default function MyAccessPage() {
  const { t } = useLocale();
  const { myRole } = useMyRole();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;

  // A row-scoped role's `/accounts` is already filtered to the rows they own
  // (privacy.util.ts), so this list IS "rekening yang ditugaskan" — no
  // separate assignment endpoint exists or is needed.
  const { data: accounts, isLoading: accountsLoading } = useQuery<AccountRow[]>(
    {
      queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
      queryFn: ({ signal }) =>
        apiFetch<AccountRow[]>(`/family-groups/${familyGroupId}/accounts`, {
          token,
          signal,
        }),
      enabled: Boolean(token) && Boolean(familyGroupId),
      staleTime: 60_000,
    },
  );

  const assigned = accounts ?? [];
  const roleLabel =
    myRole && myRole in t.common.roleLabels
      ? t.common.roleLabels[myRole as keyof typeof t.common.roleLabels]
      : null;

  const permissions = [
    {
      title: "Rekening Ditugaskan",
      value: accountsLoading
        ? "Memuat…"
        : assigned.length === 0
          ? "Belum ada"
          : `${assigned.length} rekening`,
      description:
        assigned.length > 0
          ? `Boleh mencatat transaksi dan melihat mutasi di: ${assigned
              .map((a) => a.name)
              .join(", ")}.`
          : "Master belum menugaskan rekening apa pun ke akun ini.",
      icon: WalletCards,
      tone: assigned.length > 0 ? ("success" as const) : ("info" as const),
    },
    {
      title: "Saldo Keluarga",
      value: "Tidak terlihat",
      description:
        "Kekayaan bersih, investasi, dan aset keluarga tidak dihitung untuk akun ini.",
      icon: Lock,
      tone: "danger" as const,
    },
    {
      title: "Laporan Keluarga",
      // Was "Ringkasan pribadi" — untrue. /reports/summary is 403 here.
      value: "Dikunci",
      description:
        "Laporan keluarga hanya untuk Master dan Co-Master. Transaksimu sendiri tetap bisa dilihat di halaman Transaksi.",
      icon: Eye,
      tone: "danger" as const,
    },
  ];

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
          {roleLabel && (
            <StatusBadge variant="success">Role: {roleLabel}</StatusBadge>
          )}
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
                  <p className="t-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Aktivitas yang Diizinkan</h2>
            <p className="text-muted-foreground">
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
                {/* Each row mirrors a real CASL grant in
                    casl-ability.factory.ts for dependant/operational. */}
                <tr>
                  <td className="font-semibold">Mencatat transaksi</td>
                  <td>
                    <StatusBadge variant="success">Diizinkan</StatusBadge>
                  </td>
                  <td>
                    {assigned.length > 0
                      ? "Pada rekening yang ditugaskan."
                      : "Menunggu rekening ditugaskan Master."}
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">Mengajukan dana</td>
                  <td>
                    <StatusBadge variant="success">Diizinkan</StatusBadge>
                  </td>
                  <td>Perlu disetujui Master sebelum dana berpindah.</td>
                </tr>
                <tr>
                  <td className="font-semibold">Melihat laporan keluarga</td>
                  <td>
                    <StatusBadge variant="danger">Dikunci</StatusBadge>
                  </td>
                  <td>Hanya Master dan Co-Master.</td>
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
        Kalau butuh akses tambahan, minta Master menugaskan rekening atau
        mengubah role kamu dari halaman IAM Roles.
      </div>
    </div>
  );
}
