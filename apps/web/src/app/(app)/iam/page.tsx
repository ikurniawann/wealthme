"use client";

import {
  CheckCircle2,
  Crown,
  Eye,
  KeyRound,
  Lock,
  Plus,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconChip, ProgressBar, StatusBadge } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * EPIC-027 group 1 (D1/D2) — these cards used to advertise a "Co-Master" role
 * that cannot manage IAM. It can: a co-master is created by
 * `createDependantMember` as `role: owner` paired with `relationship: istri`
 * (EPIC-024 A1), and `owner` holds `manage Member` in casl-ability.factory.ts.
 * The app was right and this screen was lying, so Co-Master is folded into the
 * Master card rather than given a column that contradicts the ability factory.
 *
 * Only the three roles an owner can actually create are shown. `spouse`,
 * `member` and `admin_staff` still exist in the schema and still render with
 * their own labels in the roster below; they are surfaced here by the
 * "Lainnya" card only when a family actually has one, instead of being
 * silently counted as Co-Masters the way they were before.
 */
const roles = [
  {
    name: "Master",
    description:
      "Pemilik utama keluarga — termasuk Co-Master (istri). Akses penuh ke data, role, dan audit.",
    icon: Crown,
    tone: "success",
    permissions: [
      "Kelola role",
      "Semua rekening",
      "Export laporan",
      "Audit log",
    ],
  },
  {
    name: "Anak",
    description:
      "Akses terbatas untuk tabungan, tujuan, dan edukasi finansial.",
    icon: Eye,
    tone: "purple",
    permissions: ["Saldo sendiri", "Tujuan pribadi", "Tidak bisa hapus"],
  },
  {
    name: "Staff Operasional",
    description:
      "Asisten, supir, atau admin yang hanya mencatat transaksi tertentu.",
    icon: WalletCards,
    tone: "warning",
    permissions: [
      "Input transaksi",
      "Rekening ditugaskan",
      "Tanpa saldo keluarga",
    ],
  },
  /* Legacy roles (`spouse` / `member` / `admin_staff`) — no form creates one,
     so this card is rendered only when the roster actually contains one. */
  {
    name: "Lainnya",
    description:
      "Role lama (pasangan, anggota, admin pembukuan) yang tidak bisa dibuat lagi dari form mana pun.",
    icon: ShieldCheck,
    tone: "info",
    permissions: ["Lihat data keluarga", "Tanpa kelola role"],
  },
] as const;

/**
 * Mirrors casl-ability.factory.ts for the three roles shown above. Master =
 * `owner` (which is what a Co-Master is). Verified per row against the
 * factory's grants, not against the prototype's picture of them.
 *
 * Exception, called out so a future reader does not check the wrong file:
 * the LAST row is not CASL-derived. The factory declares a `Report` subject
 * but grants it to nobody; report/export access is enforced by
 * `assertHouseholdWideReadAllowed()` in reports.controller.ts. The values
 * below match that function — if real `Report` grants are ever added to the
 * factory, this row must be re-checked against both.
 */
const permissionRows = [
  ["Lihat kekayaan keluarga", "Ya", "Tidak", "Tidak"],
  ["Kelola rekening & saldo", "Ya", "Tidak", "Tidak"],
  ["Input transaksi", "Ya", "Terbatas", "Terbatas"],
  ["Setujui permintaan dana", "Ya", "Tidak", "Tidak"],
  ["Kelola IAM roles", "Ya", "Tidak", "Tidak"],
  ["Export laporan", "Ya", "Tidak", "Tidak"], // ← assertHouseholdWideReadAllowed, not CASL
] as const;

const roleToneClass = {
  success: "bg-emerald-500/12 text-emerald-600",
  info: "bg-cyan-500/12 text-cyan-600",
  purple: "bg-violet-500/12 text-violet-600",
  warning: "bg-amber-500/12 text-amber-600",
} as const;

/**
 * "Anggota & Akses Aktif" used to be a hardcoded four-row array (Demo User /
 * Siti / Aisyah / Pak Dedi) with no network call anywhere on this page — the
 * table showed the same four invented people to every family. It now reads
 * the real roster from the endpoint that already existed for it,
 * `GET /family-groups/:id/members` (`listMembers`, gated on CASL
 * `read Member`), so a family sees its own members and a newly created
 * dependant appears here immediately.
 *
 * Two columns the prototype's mock filled in are deliberately NOT invented:
 * `MemberResponseDto` carries no last-login timestamp and no per-member
 * account scope, so "Cakupan" is derived from the role's own scope (which
 * IS knowable — a row-scoped role sees only its own rows) and "Terakhir
 * aktif" renders "—". Fabricating a plausible login date on a security
 * screen would be worse than an honest blank.
 */
type MemberRow = {
  id: string;
  name: string;
  role: string;
  relationship: string | null;
};

function RoleCard({
  role,
  count,
}: {
  role: (typeof roles)[number];
  count: number;
}) {
  const Icon = role.icon;

  return (
    <article className="card">
      <div className="card__body stack">
        <div className="row row--between">
          <IconChip icon={Icon} className={roleToneClass[role.tone]} />
          <StatusBadge variant={role.tone}>{count} anggota</StatusBadge>
        </div>
        <div>
          <h3 className="t-md">{role.name}</h3>
          <p className="t-sm text-muted-foreground">{role.description}</p>
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

/** Roles the API lets an owner assign (`ASSIGNABLE_ROLES` in update-member-role.dto.ts — `owner` is deliberately excluded there). */
const ASSIGNABLE_ROLES = [
  "member",
  "admin_staff",
  "spouse",
  "dependant",
  "operational",
] as const;

/** Roles `POST /members/dependant` accepts — it mints username accounts, which only these two use. */
const CREATABLE_ROLES = ["dependant", "operational"] as const;

const RELATIONSHIPS = [
  "istri",
  "anak",
  "kakek",
  "nenek",
  "bibi",
  "supir",
  "sekretaris",
  "bendahara",
] as const;

export default function IamRolesPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;

  const { data: members, isLoading: membersLoading } = useQuery<MemberRow[]>({
    queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<MemberRow[]>(`/family-groups/${familyGroupId}/members`, {
        token,
        signal,
      }),
    enabled: Boolean(token) && Boolean(familyGroupId),
    staleTime: 60_000,
  });

  const invalidateMembers = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
    });

  // ── Add member ────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    username: "",
    initialPassword: "",
    role: "dependant" as (typeof CREATABLE_ROLES)[number],
    relationship: "anak" as (typeof RELATIONSHIPS)[number],
  });

  const addMember = useMutation({
    mutationFn: () =>
      apiFetch(`/family-groups/${familyGroupId}/members/dependant`, {
        token,
        method: "POST",
        body: JSON.stringify(addForm),
      }),
    onSuccess: async () => {
      await invalidateMembers();
      setAddOpen(false);
      setAddForm({
        name: "",
        username: "",
        initialPassword: "",
        role: "dependant",
        relationship: "anak",
      });
      toast.success("Anggota berhasil ditambahkan");
    },
    onError: (e: { message?: string }) =>
      toast.error(e.message ?? "Gagal menambahkan anggota"),
  });

  // ── Change role ───────────────────────────────────────────────────────
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [editRole, setEditRole] =
    useState<(typeof ASSIGNABLE_ROLES)[number]>("member");

  const updateRole = useMutation({
    mutationFn: (m: MemberRow) =>
      apiFetch(`/family-groups/${familyGroupId}/members/${m.id}`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ role: editRole }),
      }),
    onSuccess: async () => {
      await invalidateMembers();
      setEditing(null);
      toast.success("Role anggota diperbarui");
    },
    onError: (e: { message?: string }) =>
      toast.error(e.message ?? "Gagal mengubah role"),
  });

  // ── Remove member ─────────────────────────────────────────────────────
  const [removing, setRemoving] = useState<MemberRow | null>(null);

  const removeMember = useMutation({
    mutationFn: (m: MemberRow) =>
      apiFetch(`/family-groups/${familyGroupId}/members/${m.id}`, {
        token,
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidateMembers();
      setRemoving(null);
      toast.success("Anggota dihapus dari keluarga");
    },
    onError: (e: { message?: string }) =>
      toast.error(e.message ?? "Gagal menghapus anggota"),
  });

  // Role-card counts, counted off the real roster. EPIC-027 group 1: a
  // `member` or `admin_staff` is no longer counted as a "Co-Master" — a
  // co-master IS an owner (D1), and the legacy roles get their own card,
  // rendered only when the family actually has one.
  const countByRole = (roles: readonly string[]) =>
    (members ?? []).filter((m) => roles.includes(m.role)).length;
  const roleCounts: Record<string, number> = {
    Master: countByRole(["owner"]),
    Anak: countByRole(["dependant"]),
    "Staff Operasional": countByRole(["operational"]),
    Lainnya: countByRole(["spouse", "member", "admin_staff"]),
  };
  const visibleRoles = roles.filter(
    (role) => role.name !== "Lainnya" || (roleCounts["Lainnya"] ?? 0) > 0,
  );

  // A row-scoped role only ever sees its own rows (privacy.util.ts's
  // `isRowScopedRole`); every trusted role sees the whole household. That is
  // real, derivable scope — unlike the mock's per-member account names.
  const scopeFor = (role: string) =>
    role === "dependant" || role === "operational"
      ? "Hanya data miliknya sendiri"
      : "Semua data keluarga";
  const isRestricted = (role: string) =>
    role === "dependant" || role === "operational";

  // EPIC-027 group 1 (A6) — this gauge used to be a hardcoded 82% computed
  // from nothing. It is the share of the roster that is row-scoped, which is
  // exactly what "cakupan akses terbatas" claims to measure.
  const totalMembers = (members ?? []).length;
  const restrictedShare =
    totalMembers === 0
      ? 0
      : Math.round(
          ((members ?? []).filter((m) => isRestricted(m.role)).length /
            totalMembers) *
            100,
        );

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
          {/* EPIC-027 group 1 (A3) — the "Preview Anak / Staff" link is gone.
              It opened /akses-saya as the SIGNED-IN OWNER, so it showed the
              owner's own data on the child's page rather than simulating the
              child's view. /akses-saya itself is untouched: it remains the
              landing page for row-scoped roles and the redirect target of
              RowScopedRouteGuard. */}
          <div className="row">
            <button
              className="btn bg-white text-slate-900 hover:bg-white/90"
              type="button"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={16} />
              Tambah Anggota
            </button>
          </div>
        </div>
      </section>

      <section className="auto-grid auto-grid--wide">
        {visibleRoles.map((role) => (
          <RoleCard
            key={role.name}
            role={role}
            count={roleCounts[role.name] ?? 0}
          />
        ))}
      </section>

      <section className="grid grid--sidebar grid--stack-sm">
        <article className="card">
          <div className="card__header">
            <div>
              <h2>Role Permission Matrix</h2>
              <p className="text-muted-foreground">
                Ringkasan hak akses utama per role.
              </p>
            </div>
            {/* The prototype shows a "Kelola Permission" button, but these
                grants are compiled into casl-ability.factory.ts and there is
                no endpoint to edit them at runtime — a dialog here would be
                a button that cannot do anything. Stating where the rules
                actually live is more useful than a dead control. */}
            <span className="badge badge--gray">
              <KeyRound size={14} />
              Ditetapkan sistem
            </span>
          </div>
          <div className="card__body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    <th>Master</th>
                    <th>Anak</th>
                    <th>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map(([permission, master, child, staff]) => (
                    <tr key={permission}>
                      <td className="font-semibold">{permission}</td>
                      {[master, child, staff].map((value, index) => (
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
                  <span className="t-sm font-semibold">
                    Cakupan akses terbatas
                  </span>
                  <span className="mono t-sm">{restrictedShare}%</span>
                </div>
                <ProgressBar value={restrictedShare} />
              </div>
            </div>
          </article>

          {/* The prototype's "Permintaan Akses" panel is NOT ported, and the
              hardcoded stand-in that used to sit here ("Pak Dedi minta akses
              GoPay", "Aisyah minta lihat tujuan DP", "2 pending") has been
              removed. There is no access-request feature behind it at any
              layer: no `AccessRequest` model in schema.prisma, no endpoint,
              and `AllowanceRequest` only carries `funding` / `held_expense`
              — money, not access. So nothing could be requested, approved or
              rejected; the panel was a picture of a feature. Showing a
              permanent "2 pending" badge on a security screen is worse than
              showing nothing. Rebuild this together with the real feature
              (model + migration + endpoints + a request UI on /akses-saya). */}
        </aside>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Anggota & Akses Aktif</h2>
            <p className="text-muted-foreground">
              Pantau role, cakupan data, dan aktivitas login terakhir.
            </p>
          </div>
          {/* EPIC-027 group 1 (A4) — "Assign Akses" opened the very same
              add-member dialog as the hero button. Two controls, one action:
              the hero adds, the per-row "Ubah Role" assigns. */}
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
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center t-muted">
                      Memuat…
                    </td>
                  </tr>
                )}
                {!membersLoading && (members ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center t-muted">
                      Belum ada anggota
                    </td>
                  </tr>
                )}
                {(members ?? []).map((member) => (
                  <tr key={member.id}>
                    <td className="font-semibold">{member.name}</td>
                    <td>
                      <StatusBadge variant="info">
                        {t.common.roleLabels[
                          member.role as keyof typeof t.common.roleLabels
                        ] ?? member.role}
                      </StatusBadge>
                    </td>
                    <td>{scopeFor(member.role)}</td>
                    <td>
                      <StatusBadge
                        variant={
                          isRestricted(member.role) ? "warning" : "success"
                        }
                      >
                        {isRestricted(member.role) ? "Terbatas" : "Aktif"}
                      </StatusBadge>
                    </td>
                    {/* No last-login field exists on MemberResponseDto — see
                        the MemberRow comment; an em dash beats a fake date. */}
                    <td className="t-muted">—</td>
                    <td style={{ textAlign: "right" }}>
                      {/* `owner` is excluded from ASSIGNABLE_ROLES server-side
                          and `removeMember` refuses the last owner, so the
                          row for an owner offers no destructive action here
                          rather than surfacing a button that always 400s. */}
                      {member.role === "owner" ? (
                        <span className="t-muted t-xs">—</span>
                      ) : (
                        <div
                          className="row"
                          style={{ justifyContent: "flex-end", gap: 6 }}
                        >
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => {
                              setEditing(member);
                              setEditRole(
                                (
                                  ASSIGNABLE_ROLES as readonly string[]
                                ).includes(member.role)
                                  ? (member.role as (typeof ASSIGNABLE_ROLES)[number])
                                  : "member",
                              );
                            }}
                          >
                            Ubah Role
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm text-destructive"
                            onClick={() => setRemoving(member)}
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </td>
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

      {/* ── Tambah anggota ─────────────────────────────────────────────
          Posts to `/members/dependant`, which mints a USERNAME account (no
          email) and forces a password change at first login — hence the
          initial-password field and the notice below it. Only the two
          row-scoped roles can be created this way; a spouse/bookkeeper still
          arrives through `/invitations` by email. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogTitle>Tambah Anggota</DialogTitle>
          <DialogDescription>
            Membuat akun login untuk anak atau staff. Mereka wajib mengganti
            password saat pertama kali masuk.
          </DialogDescription>
          <DialogBody>
            <label className="field">
              <span className="label">Nama</span>
              <input
                className="input"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
                placeholder="Aisyah Arsandi"
              />
            </label>
            <label className="field">
              <span className="label">Username</span>
              <input
                className="input"
                value={addForm.username}
                onChange={(e) =>
                  setAddForm({ ...addForm, username: e.target.value })
                }
                placeholder="aisyah_kecil"
              />
            </label>
            <label className="field">
              <span className="label">Password Awal</span>
              <input
                className="input"
                type="password"
                value={addForm.initialPassword}
                onChange={(e) =>
                  setAddForm({ ...addForm, initialPassword: e.target.value })
                }
                placeholder="Minimal 8 karakter"
              />
            </label>
            <label className="field">
              <span className="label">Role</span>
              <select
                className="select"
                value={addForm.role}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    role: e.target.value as (typeof CREATABLE_ROLES)[number],
                  })
                }
              >
                {CREATABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.common.roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Hubungan</span>
              <select
                className="select"
                value={addForm.relationship}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    relationship: e.target
                      .value as (typeof RELATIONSHIPS)[number],
                  })
                }
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setAddOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                addMember.isPending ||
                !addForm.name.trim() ||
                addForm.username.trim().length < 3 ||
                addForm.initialPassword.length < 8
              }
              onClick={() => addMember.mutate()}
            >
              {addMember.isPending ? "Menyimpan…" : "Tambah"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ubah role ──────────────────────────────────────────────────── */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="dialog--sm">
          <DialogTitle>Ubah Role</DialogTitle>
          <DialogDescription>
            {editing?.name} — role menentukan menu dan data yang bisa dia buka.
          </DialogDescription>
          <DialogBody>
            <label className="field">
              <span className="label">Role Baru</span>
              <select
                className="select"
                value={editRole}
                onChange={(e) =>
                  setEditRole(
                    e.target.value as (typeof ASSIGNABLE_ROLES)[number],
                  )
                }
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.common.roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setEditing(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={updateRole.isPending}
              onClick={() => editing && updateRole.mutate(editing)}
            >
              {updateRole.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hapus anggota ──────────────────────────────────────────────── */}
      <Dialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
      >
        <DialogContent className="dialog--sm">
          <DialogTitle>Hapus Anggota</DialogTitle>
          <DialogDescription>
            {removing?.name} akan kehilangan akses ke data keluarga ini.
            Transaksi yang sudah dicatat tetap tersimpan.
          </DialogDescription>
          <DialogFooter>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setRemoving(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn--destructive"
              disabled={removeMember.isPending}
              onClick={() => removing && removeMember.mutate(removing)}
            >
              {removeMember.isPending ? "Menghapus…" : "Hapus"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
