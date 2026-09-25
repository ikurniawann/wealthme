"use client";

import { useState } from "react";
import { Plus, ShieldCheck, SlidersHorizontal, UserCog } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AccessRoleResponse } from "@wealthme/contracts";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";

import { AddMemberDialog } from "./_components/add-member-dialog";
import { FamilyHandleCard } from "./_components/family-handle-card";
import { MemberAccessDialog } from "./_components/member-access-dialog";
import { MemberEmailDialog } from "./_components/member-email-dialog";
import { MembersTab, type MemberRow } from "./_components/members-tab";
import {
  ResetPasswordDialog,
  type ResetPasswordTarget,
} from "./_components/reset-password-dialog";
import { RoleEditorDialog } from "./_components/role-editor-dialog";
import { RolesTab } from "./_components/roles-tab";

/**
 * EPIC-030 — /iam rebuilt as a conventional IAM screen (Master only; the
 * route guard and the API's Master-only `iam` resource keep everyone else
 * out). Two tabs, one mental model:
 *
 *  - Anggota: every member, how they log in, what access they have, whose
 *    data they see, and the per-person actions (Atur Akses, Reset Password,
 *    Hapus).
 *  - Role Akses: reusable page-access bundles the Master assigns to members.
 *
 * The old static "Role Permission Matrix" and role cards are gone: they
 * described fixed grants that the Master can now change, so they would have
 * contradicted the real configuration.
 */
type Tab = "members" | "roles";

const HOW_IT_WORKS = [
  {
    icon: ShieldCheck,
    title: "Buat role",
    text: "Kumpulan halaman yang boleh dibuka (Lihat / Kelola) dan data siapa yang terlihat.",
  },
  {
    icon: UserCog,
    title: "Pasang ke anggota",
    text: "Lewat tombol Atur Akses. Tanpa role, anggota memakai akses bawaan tipenya.",
  },
  {
    icon: SlidersHorizontal,
    title: "Pengecualian (opsional)",
    text: "Buka atau tutup halaman tertentu hanya untuk satu anggota.",
  },
] as const;

export default function IamRolesPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const [tab, setTab] = useState<Tab>("members");

  const membersKey = queryKeys.familyGroups.members(familyGroupId ?? "");
  const removedKey = queryKeys.familyGroups.removedMembers(familyGroupId ?? "");
  const rolesKey = queryKeys.familyGroups.accessRoles(familyGroupId ?? "");
  const enabled = Boolean(token) && Boolean(familyGroupId);

  const { data: members, isLoading: membersLoading } = useQuery<MemberRow[]>({
    queryKey: membersKey,
    queryFn: ({ signal }) =>
      apiFetch<MemberRow[]>(`/family-groups/${familyGroupId}/members`, {
        token,
        signal,
      }),
    enabled,
    staleTime: 60_000,
  });

  const { data: removedMembers } = useQuery<MemberRow[]>({
    queryKey: removedKey,
    queryFn: ({ signal }) =>
      apiFetch<MemberRow[]>(`/family-groups/${familyGroupId}/members/removed`, {
        token,
        signal,
      }),
    enabled,
    staleTime: 60_000,
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<
    AccessRoleResponse[]
  >({
    queryKey: rolesKey,
    queryFn: ({ signal }) =>
      apiFetch<AccessRoleResponse[]>(
        `/family-groups/${familyGroupId}/access-roles`,
        { token, signal },
      ),
    enabled,
    staleTime: 60_000,
  });

  const invalidateMembers = async () => {
    // Removing/restoring moves a row between both lists.
    await queryClient.invalidateQueries({ queryKey: membersKey });
    await queryClient.invalidateQueries({ queryKey: removedKey });
    await queryClient.invalidateQueries({ queryKey: rolesKey });
  };

  // ── Dialog state ─────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [editingAccess, setEditingAccess] = useState<MemberRow | null>(null);
  const [resettingPassword, setResettingPassword] =
    useState<ResetPasswordTarget | null>(null);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [editingEmail, setEditingEmail] = useState<MemberRow | null>(null);
  const [editingRole, setEditingRole] = useState<
    AccessRoleResponse | "new" | null
  >(null);
  const [deletingRole, setDeletingRole] = useState<AccessRoleResponse | null>(
    null,
  );

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

  const restoreMember = useMutation({
    mutationFn: (m: MemberRow) =>
      apiFetch(`/family-groups/${familyGroupId}/members/${m.id}/restore`, {
        token,
        method: "POST",
      }),
    onSuccess: async () => {
      await invalidateMembers();
      toast.success("Anggota diaktifkan kembali");
    },
    onError: (e: { message?: string }) =>
      toast.error(e.message ?? "Gagal mengaktifkan anggota"),
  });

  const deleteRole = useMutation({
    mutationFn: (r: AccessRoleResponse) =>
      apiFetch(`/family-groups/${familyGroupId}/access-roles/${r.id}`, {
        token,
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidateMembers();
      setDeletingRole(null);
      toast.success("Role dihapus");
    },
    onError: (e: { message?: string }) =>
      toast.error(e.message ?? "Gagal menghapus role"),
  });

  const memberCount = (members ?? []).length;
  const roleCount = (roles ?? []).length;
  const restrictedCount = (members ?? []).filter(
    (m) => m.role !== "owner",
  ).length;

  return (
    <div className="page stack">
      <section className="hero gradient-profile">
        <div className="row row--between row--wrap">
          <div>
            <div className="hero__label">Master Account</div>
            <h1 className="hero__value">IAM Roles</h1>
            <p className="text-white/80">
              Atur halaman apa saja yang boleh dibuka setiap anggota, dan data
              siapa yang mereka lihat.
            </p>
          </div>
          <button
            className="btn bg-white text-slate-900 hover:bg-white/90"
            type="button"
            onClick={() => setAddOpen(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Tambah Anggota
          </button>
        </div>
      </section>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {HOW_IT_WORKS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="card">
              <div
                className="card__body row"
                style={{ alignItems: "flex-start", gap: 10 }}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-primary">
                  {i + 1}
                </span>
                <div>
                  <div className="row" style={{ gap: 6 }}>
                    <Icon
                      size={14}
                      aria-hidden="true"
                      className="text-primary"
                    />
                    <span className="text-[13px] font-bold">{step.title}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="row row--between row--wrap">
        <div className="segmented" role="tablist" aria-label="Bagian IAM">
          <button
            type="button"
            role="tab"
            className="segmented__item"
            aria-selected={tab === "members"}
            onClick={() => setTab("members")}
          >
            Anggota ({memberCount})
          </button>
          <button
            type="button"
            role="tab"
            className="segmented__item"
            aria-selected={tab === "roles"}
            onClick={() => setTab("roles")}
          >
            Role Akses ({roleCount})
          </button>
        </div>
        <p className="t-xs t-muted">
          Master selalu punya akses penuh · {restrictedCount} anggota diatur
          aksesnya
        </p>
      </div>

      {tab === "members" && (
        <FamilyHandleCard familyGroupId={familyGroupId} token={token} />
      )}

      {tab === "members" ? (
        <MembersTab
          members={members}
          isLoading={membersLoading}
          roles={roles ?? []}
          currentUserId={session?.userId}
          onEditAccess={setEditingAccess}
          onResetPassword={setResettingPassword}
          onEditEmail={setEditingEmail}
          onRemove={setRemoving}
        />
      ) : (
        <RolesTab
          roles={roles}
          isLoading={rolesLoading}
          onCreate={() => setEditingRole("new")}
          onEdit={setEditingRole}
          onDelete={setDeletingRole}
        />
      )}

      {tab === "members" && (removedMembers ?? []).length > 0 && (
        <section className="card">
          <div className="card__header">
            <div>
              <h2>Anggota Nonaktif</h2>
              <p className="text-muted-foreground">
                Sudah dihapus dari keluarga dan tidak bisa login. Data dan
                transaksi mereka tetap tersimpan.
              </p>
            </div>
          </div>
          <div className="card__body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Tipe sebelumnya</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(removedMembers ?? []).map((m) => (
                    <tr key={m.id}>
                      <td className="font-semibold">{m.name}</td>
                      <td>
                        <StatusBadge variant="gray">
                          {t.common.roleLabels[
                            m.role as keyof typeof t.common.roleLabels
                          ] ?? m.role}
                        </StatusBadge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          disabled={restoreMember.isPending}
                          onClick={() => restoreMember.mutate(m)}
                        >
                          Aktifkan Kembali
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        familyGroupId={familyGroupId}
        token={token}
        roles={roles ?? []}
      />

      <MemberAccessDialog
        // Remount per member so the draft never carries over.
        key={`access-${editingAccess?.id ?? "none"}`}
        member={editingAccess}
        roles={roles ?? []}
        onClose={() => setEditingAccess(null)}
        familyGroupId={familyGroupId}
        token={token}
      />

      <ResetPasswordDialog
        key={`reset-${resettingPassword?.id ?? "none"}`}
        member={resettingPassword}
        onClose={() => setResettingPassword(null)}
        familyGroupId={familyGroupId}
        token={token}
      />

      <MemberEmailDialog
        key={`email-${editingEmail?.id ?? "none"}`}
        member={editingEmail}
        onClose={() => setEditingEmail(null)}
        familyGroupId={familyGroupId}
        token={token}
      />

      <RoleEditorDialog
        key={
          editingRole === null
            ? "none"
            : editingRole === "new"
              ? "new"
              : editingRole.id
        }
        target={editingRole}
        onClose={() => setEditingRole(null)}
        familyGroupId={familyGroupId}
        token={token}
      />

      {/* ── Hapus anggota ───────────────────────────────────────────── */}
      <Dialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
      >
        <DialogContent className="dialog--sm">
          <DialogTitle>Hapus Anggota</DialogTitle>
          <DialogDescription>
            {removing?.name} akan kehilangan akses ke data keluarga ini.
            Transaksi yang sudah dicatat tetap tersimpan, dan Anda bisa
            mengaktifkannya kembali.
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

      {/* ── Hapus role ──────────────────────────────────────────────── */}
      <Dialog
        open={deletingRole !== null}
        onOpenChange={(o) => !o && setDeletingRole(null)}
      >
        <DialogContent className="dialog--sm">
          <DialogTitle>Hapus Role</DialogTitle>
          <DialogDescription>
            {deletingRole && deletingRole.memberCount > 0
              ? `${deletingRole.memberCount} anggota yang memakai "${deletingRole.name}" akan kembali ke akses bawaan tipenya.`
              : `Role "${deletingRole?.name}" belum dipakai siapa pun.`}
          </DialogDescription>
          <DialogFooter>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setDeletingRole(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn--destructive"
              disabled={deleteRole.isPending}
              onClick={() => deletingRole && deleteRole.mutate(deletingRole)}
            >
              {deleteRole.isPending ? "Menghapus…" : "Hapus Role"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
