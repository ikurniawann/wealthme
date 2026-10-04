"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  LEGACY_ACCESS_PRESETS,
  type AccessDataScope,
  type AccessLevel,
  type AccessPage,
  type AccessPermissions,
  type AccessRoleResponse,
} from "@wealthme/contracts";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PillButton } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import { SCOPE_COPY, fillPermissions } from "./access-shared";
import { PageAccessMatrix } from "./page-access-matrix";

/** Built-in member types a Master may assign (API: ASSIGNABLE_ROLES; never owner). */
export const MEMBER_TYPES = [
  "dependant",
  "operational",
  "admin_staff",
  "member",
  "spouse",
] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

export type AccessMember = {
  id: string;
  name: string;
  role: string;
  accessRoleId?: string | null;
  accessOverrides?: AccessPermissions;
  /** "Lihat saldo" — absent/true = balances visible (API default). */
  canViewBalances?: boolean;
};

type MemberAccessDialogProps = {
  member: AccessMember | null;
  roles: AccessRoleResponse[];
  onClose: () => void;
  familyGroupId: string | null;
  token: string | undefined;
};

function baselineFor(
  type: MemberType,
  roleId: string | null,
  roles: AccessRoleResponse[],
): {
  permissions: Record<AccessPage, AccessLevel>;
  dataScope: AccessDataScope;
} {
  const custom = roleId ? roles.find((r) => r.id === roleId) : undefined;
  const base = custom ?? LEGACY_ACCESS_PRESETS[type];
  return {
    permissions: fillPermissions(base.permissions),
    dataScope: base.dataScope,
  };
}

const asMemberType = (role: string): MemberType =>
  (MEMBER_TYPES as readonly string[]).includes(role)
    ? (role as MemberType)
    : "member";

/**
 * "Atur Akses" for one member, top to bottom in the order a Master thinks:
 * who is this person (type) → which role do they get → any exceptions just
 * for them. Exceptions are what differs from the role; they are saved as
 * per-member overrides and flagged "Khusus" so nothing is hidden.
 */
export function MemberAccessDialog({
  member,
  roles,
  onClose,
  familyGroupId,
  token,
}: MemberAccessDialogProps) {
  const { handleError } = useApiError();
  const { t } = useLocale();
  const fieldId = useId();
  const queryClient = useQueryClient();

  const initialType = asMemberType(member?.role ?? "member");
  const initialRoleId = member?.accessRoleId ?? null;
  const [memberType, setMemberType] = useState<MemberType>(initialType);
  const [roleId, setRoleId] = useState<string | null>(initialRoleId);
  const [canViewBalances, setCanViewBalances] = useState<boolean>(
    member?.canViewBalances ?? true,
  );
  // Master & Co-Master always see balances — the toggle would be a no-op.
  const balanceToggleApplies = memberType !== "spouse";
  const [perms, setPerms] = useState<Record<AccessPage, AccessLevel>>(() => ({
    ...baselineFor(initialType, initialRoleId, roles).permissions,
    ...(member?.accessOverrides ?? {}),
  }));

  const baseline = baselineFor(memberType, roleId, roles);
  const overrides = Object.fromEntries(
    Object.entries(perms).filter(
      ([page, level]) => baseline.permissions[page as AccessPage] !== level,
    ),
  ) as AccessPermissions;
  const overrideCount = Object.keys(overrides).length;

  // Changing the type or role starts from that baseline again — keeping
  // exceptions made against a different role would silently mean something else.
  const resetTo = (type: MemberType, nextRoleId: string | null) => {
    setMemberType(type);
    setRoleId(nextRoleId);
    setPerms(baselineFor(type, nextRoleId, roles).permissions);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!member) return;
      if (memberType !== initialType) {
        await apiFetch(`/family-groups/${familyGroupId}/members/${member.id}`, {
          token,
          method: "PATCH",
          body: JSON.stringify({ role: memberType }),
        });
      }
      await apiFetch(
        `/family-groups/${familyGroupId}/members/${member.id}/access`,
        {
          token,
          method: "PUT",
          body: JSON.stringify({
            accessRoleId: roleId,
            overrides,
            canViewBalances,
          }),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.familyGroups.accessRoles(familyGroupId ?? ""),
      });
      toast.success("Akses diperbarui", {
        description: `${member?.name} melihat menu barunya saat membuka ulang aplikasi.`,
      });
      onClose();
    },
    onError: handleError,
  });

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(o) => !o && !save.isPending && onClose()}
    >
      <PanelContent variant="side" size="lg" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              Atur Akses: {member?.name}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              Tentukan halaman apa saja yang bisa dibuka anggota ini dan data
              siapa yang dia lihat.
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
              <label className="field" htmlFor={`${fieldId}-type`}>
                <span className="label">
                  1. {t.akun.memberConcepts.systemRole}
                </span>
                <select
                  id={`${fieldId}-type`}
                  className="select"
                  value={memberType}
                  disabled={save.isPending}
                  onChange={(e) =>
                    resetTo(e.target.value as MemberType, roleId)
                  }
                >
                  {MEMBER_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {t.common.roleLabels[r]}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Dipakai sebagai akses bawaan bila tidak memilih role.
                </span>
              </label>
              <label className="field mt-0" htmlFor={`${fieldId}-role`}>
                <span className="label">
                  2. {t.akun.memberConcepts.accessRole}
                </span>
                <select
                  id={`${fieldId}-role`}
                  className="select"
                  value={roleId ?? ""}
                  disabled={save.isPending}
                  onChange={(e) => resetTo(memberType, e.target.value || null)}
                >
                  <option value="">
                    Bawaan {t.common.roleLabels[memberType]}
                  </option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Data terlihat: {SCOPE_COPY[baseline.dataScope].short}
                  {roles.length === 0 &&
                    " · Buat role di tab Role Akses untuk dipakai ulang."}
                </span>
              </label>
            </div>

            {balanceToggleApplies && (
              <div className="row row--between items-start gap-3">
                <div className="pr-3">
                  <div className="t-sm t-bold" id={`${fieldId}-balances`}>
                    {t.iam.viewBalancesLabel}
                  </div>
                  <div className="t-xs t-muted">{t.iam.viewBalancesHint}</div>
                </div>
                <Switch
                  aria-labelledby={`${fieldId}-balances`}
                  checked={canViewBalances}
                  disabled={save.isPending}
                  onCheckedChange={(checked) => setCanViewBalances(checked)}
                />
              </div>
            )}

            <div className="field">
              <div className="row row--between row--wrap">
                <span className="label">
                  3. Pengecualian khusus anggota ini
                </span>
                {overrideCount > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setPerms(baseline.permissions)}
                  >
                    Hapus {overrideCount} pengecualian
                  </button>
                )}
              </div>
              <p className="hint">
                Awalnya sama dengan role. Ubah hanya bila anggota ini perlu
                berbeda — halaman yang diubah ditandai &quot;Khusus&quot;.
              </p>
              <PageAccessMatrix
                value={perms}
                baseline={baseline.permissions}
                onChange={(page, level) =>
                  setPerms((prev) => ({ ...prev, [page]: level }))
                }
                disabled={save.isPending}
              />
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton
              type="button"
              disabled={save.isPending}
              onClick={onClose}
            >
              Batal
            </PillButton>
            <PillButton
              variant="primary"
              type="submit"
              disabled={save.isPending}
            >
              {save.isPending ? "Menyimpan…" : "Simpan Akses"}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}
