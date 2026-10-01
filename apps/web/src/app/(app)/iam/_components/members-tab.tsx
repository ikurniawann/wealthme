"use client";

import { Crown, KeyRound, Mail, Trash2 } from "lucide-react";
import {
  LEGACY_ACCESS_PRESETS,
  type AccessDataScope,
  type AccessPermissions,
} from "@wealthme/contracts";

import { StatusBadge } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { isInternalEmail } from "@/lib/display-email";

import { MEMBER_PASTELS, SCOPE_COPY } from "./access-shared";
import { CopyButton } from "./copy-button";
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
  /** EPIC-031 — email a Master entered, waiting for its owner to confirm. */
  pendingEmail?: string | null;
  accessRoleId?: string | null;
  accessRoleName?: string | null;
  accessOverrides?: AccessPermissions;
  canViewBalances?: boolean;
};

type MembersTabProps = {
  members: MemberRow[] | undefined;
  isLoading: boolean;
  roles: AccessRoleResponse[];
  currentUserId: string | undefined;
  onEditAccess: (m: MemberRow) => void;
  onResetPassword: (m: MemberRow) => void;
  onEditEmail: (m: MemberRow) => void;
  onRemove: (m: MemberRow) => void;
};

export function scopeOf(
  m: MemberRow,
  roles: AccessRoleResponse[],
): AccessDataScope {
  if (m.role === "owner") return "all";
  const custom = roles.find((r) => r.id === m.accessRoleId);
  if (custom) return custom.dataScope;
  const preset =
    LEGACY_ACCESS_PRESETS[m.role as keyof typeof LEGACY_ACCESS_PRESETS];
  return preset?.dataScope ?? "all";
}

/**
 * The roster as a Master reads it: who (name + how they log in) and whose
 * data they see, as a row list (iam.html's `.mem-row`) instead of a dense
 * table. Clicking a row opens the "Atur Akses" side panel (`onEditAccess`),
 * same as a prototype `mem-row` click; the per-row Email/Reset
 * Password/Hapus actions stay reachable as small ghost icon buttons inside
 * the row (they `stopPropagation` so they don't also open the panel).
 */
export function MembersTab({
  members,
  isLoading,
  roles,
  currentUserId,
  onEditAccess,
  onResetPassword,
  onEditEmail,
  onRemove,
}: MembersTabProps) {
  const { t } = useLocale();
  const roleLabel = (role: string) =>
    t.common.roleLabels[role as keyof typeof t.common.roleLabels] ?? role;

  if (isLoading) {
    return <div className="card card__body t-muted">Memuat…</div>;
  }

  if (!members || members.length === 0) {
    return <div className="card card__body t-muted">Belum ada anggota</div>;
  }

  return (
    <section className="card">
      <div className="card__body iam-member-list">
        {members.map((m, i) => {
          const isMaster = m.role === "owner";
          const isSelf = m.userId === currentUserId;
          const overrideCount = Object.keys(m.accessOverrides ?? {}).length;
          const scope = scopeOf(m, roles);
          // EPIC-031 — a Master-created member may have a username login
          // (`nama@kode`), a real email, or both.
          const hasRealEmail = !isInternalEmail(m.email);
          const initials = m.name
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase();
          const pastel =
            MEMBER_PASTELS[i % MEMBER_PASTELS.length] ?? MEMBER_PASTELS[0]!;
          const accessLine = isMaster
            ? "Akses penuh"
            : (m.accessRoleName ?? `Bawaan ${roleLabel(m.role)}`);

          return (
            <div
              key={m.id}
              role={isMaster ? undefined : "button"}
              tabIndex={isMaster ? undefined : 0}
              aria-label={isMaster ? undefined : `Atur akses ${m.name}`}
              className="iam-mem-row"
              data-master={isMaster || undefined}
              title={m.relationship ? `Hubungan: ${m.relationship}` : undefined}
              onClick={isMaster ? undefined : () => onEditAccess(m)}
              onKeyDown={
                isMaster
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onEditAccess(m);
                      }
                    }
              }
            >
              <span
                className="avatar"
                aria-hidden="true"
                style={{ background: pastel.bg, color: pastel.fg }}
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="iam-mem-row__name">
                  {m.name}
                  {isSelf && <span className="t-xs t-muted"> (Anda)</span>}
                </span>
                <span className="iam-mem-row__sub">
                  {accessLine}
                  {overrideCount > 0 && ` · +${overrideCount} khusus`}
                  {" · "}
                  {SCOPE_COPY[scope].short}
                </span>
                {m.username && (
                  <span
                    className="mono iam-mem-row__sub flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {`Username: ${m.username}`}
                    <CopyButton
                      value={m.username}
                      ariaLabel={t.akun.copyCredentials.usernameAriaLabel}
                    />
                  </span>
                )}
                {hasRealEmail && (
                  <span className="iam-mem-row__sub">{m.email}</span>
                )}
                {m.pendingEmail && (
                  <span className="iam-mem-row__sub text-warning">
                    {m.pendingEmail} · menunggu konfirmasi
                  </span>
                )}
              </span>
              <span
                className="iam-mem-row__actions"
                onClick={(e) => e.stopPropagation()}
              >
                {m.managedLogin && !isSelf && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--icon"
                    aria-label={`Ubah email ${m.name}`}
                    title="Ubah email"
                    onClick={() => onEditEmail(m)}
                  >
                    <Mail size={14} aria-hidden="true" />
                  </button>
                )}
                {m.managedLogin && !isSelf && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--icon"
                    aria-label={`Reset Password ${m.name}`}
                    title="Reset Password"
                    onClick={() => onResetPassword(m)}
                  >
                    <KeyRound size={14} aria-hidden="true" />
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
              </span>
              <StatusBadge variant={isMaster ? "success" : "gray"}>
                {isMaster && <Crown size={11} aria-hidden="true" />}{" "}
                {roleLabel(m.role)}
              </StatusBadge>
            </div>
          );
        })}
      </div>
    </section>
  );
}
