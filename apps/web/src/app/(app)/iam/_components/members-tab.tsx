"use client";

import { Crown, KeyRound, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  LEGACY_ACCESS_PRESETS,
  type AccessDataScope,
  type AccessPermissions,
} from "@wealthme/contracts";

import { StatusBadge } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

import { SCOPE_COPY } from "./access-shared";
import type { AccessRoleResponse } from "@wealthme/contracts";

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  relationship: string | null;
  username: string | null;
  /** Head-created username login (no mailbox) — password reset lives here. */
  managedLogin: boolean;
  accessRoleId?: string | null;
  accessRoleName?: string | null;
  accessOverrides?: AccessPermissions;
};

type MembersTabProps = {
  members: MemberRow[] | undefined;
  isLoading: boolean;
  roles: AccessRoleResponse[];
  currentUserId: string | undefined;
  onEditAccess: (m: MemberRow) => void;
  onResetPassword: (m: MemberRow) => void;
  onRemove: (m: MemberRow) => void;
};

function scopeOf(m: MemberRow, roles: AccessRoleResponse[]): AccessDataScope {
  if (m.role === "owner") return "all";
  const custom = roles.find((r) => r.id === m.accessRoleId);
  if (custom) return custom.dataScope;
  const preset =
    LEGACY_ACCESS_PRESETS[m.role as keyof typeof LEGACY_ACCESS_PRESETS];
  return preset?.dataScope ?? "all";
}

/**
 * The roster as a Master reads it: who (name + how they log in), what type
 * of member, which access, whose data — and the actions for that person.
 */
export function MembersTab({
  members,
  isLoading,
  roles,
  currentUserId,
  onEditAccess,
  onResetPassword,
  onRemove,
}: MembersTabProps) {
  const { t } = useLocale();
  const roleLabel = (role: string) =>
    t.common.roleLabels[role as keyof typeof t.common.roleLabels] ?? role;

  return (
    <section className="card">
      <div className="card__body">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Anggota</th>
                <th>Tipe</th>
                <th>Akses</th>
                <th>Data terlihat</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-4 text-center t-muted">
                    Memuat…
                  </td>
                </tr>
              )}
              {!isLoading && (members ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center t-muted">
                    Belum ada anggota
                  </td>
                </tr>
              )}
              {(members ?? []).map((m) => {
                const isMaster = m.role === "owner";
                const isSelf = m.userId === currentUserId;
                const overrideCount = Object.keys(
                  m.accessOverrides ?? {},
                ).length;
                const scope = scopeOf(m, roles);
                const loginLine = m.managedLogin
                  ? m.username
                    ? `Username: ${m.username}`
                    : "Login dengan username"
                  : m.email;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="font-semibold">
                        {m.name}
                        {isSelf && (
                          <span className="t-xs t-muted"> (Anda)</span>
                        )}
                      </div>
                      <div
                        className={
                          m.managedLogin
                            ? "mono text-[11.5px] text-muted-foreground"
                            : "text-[11.5px] text-muted-foreground"
                        }
                      >
                        {loginLine}
                      </div>
                    </td>
                    <td>
                      <StatusBadge variant={isMaster ? "success" : "gray"}>
                        {isMaster && <Crown size={11} aria-hidden="true" />}{" "}
                        {roleLabel(m.role)}
                      </StatusBadge>
                    </td>
                    <td>
                      {isMaster ? (
                        <span className="font-semibold">Akses penuh</span>
                      ) : (
                        <div className="row row--wrap" style={{ gap: 4 }}>
                          <span className="font-semibold">
                            {m.accessRoleName ?? `Bawaan ${roleLabel(m.role)}`}
                          </span>
                          {overrideCount > 0 && (
                            <StatusBadge variant="warning">
                              +{overrideCount} khusus
                            </StatusBadge>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        variant={scope === "own" ? "warning" : "info"}
                      >
                        {SCOPE_COPY[scope].short}
                      </StatusBadge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        className="row row--wrap"
                        style={{ justifyContent: "flex-end", gap: 6 }}
                      >
                        {!isMaster && (
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => onEditAccess(m)}
                          >
                            <SlidersHorizontal size={14} aria-hidden="true" />
                            Atur Akses
                          </button>
                        )}
                        {m.managedLogin && !isSelf && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => onResetPassword(m)}
                          >
                            <KeyRound size={14} aria-hidden="true" />
                            Reset Password
                          </button>
                        )}
                        {!isMaster && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm btn--icon text-destructive"
                            aria-label={`Hapus ${m.name}`}
                            title="Hapus dari keluarga"
                            onClick={() => onRemove(m)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                        {isMaster && !(m.managedLogin && !isSelf) && (
                          <span className="t-muted t-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
