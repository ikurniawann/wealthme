"use client";

import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { MemberRelationshipSchema } from "@wealthme/contracts";
import type {
  AccessRoleResponse,
  MemberRelationship,
} from "@wealthme/contracts";

/**
 * EPIC-027 group 2 (D3) — moved here verbatim from `akun/page.tsx`, which used
 * to carry a SECOND, lesser copy of this dialog: /iam had its own hand-written
 * version with no Istri/Co-Master option, no show-password toggle and no
 * relationship<->role locking, even though both posted to the same endpoint.
 * Member management now lives only on /iam (the API already requires
 * `manage Member`, which only an owner holds), and the profile page links here.
 *
 * Same page-local helper as mastercoa/page.tsx: surfaces the API's own message
 * ("username taken", "keluarga ini sudah memiliki istri") instead of a generic
 * toast.
 */
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head-created dependant/operational
// member: name + username + initial password, no email; forced password
// change at first login (ForcePasswordChangeGuard on the API side).
export function AddMemberDialog({
  open,
  onOpenChange,
  familyGroupId,
  token,
  roles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  familyGroupId: string | null;
  token: string | undefined;
  roles: AccessRoleResponse[];
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  // EPIC-026 Wave 3 — this dialog composes the prototype's `.field` markup
  // directly (label + control + `.hint`) instead of the `Field` helper,
  // because `Field` only wires `htmlFor` when the control is its single
  // child — the hint-bearing fields here previously lost that association.
  const fieldId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  // EPIC-031 — the login ID is `<username>@<kode keluarga>`; show the suffix
  // so the Master knows exactly what to hand over.
  const { data: loginHandle } = useQuery<{ handle: string }>({
    queryKey: queryKeys.familyGroups.loginHandle(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<{ handle: string }>(
        `/family-groups/${familyGroupId}/login-handle`,
        { token, signal },
      ),
    enabled: open && Boolean(token) && Boolean(familyGroupId),
    staleTime: 60_000,
  });
  const handle = loginHandle?.handle;
  const passwordRef = useRef<HTMLInputElement>(null);
  // EPIC-024 A1 (D1) — "owner" is reachable ONLY through this dialog's
  // "Istri (Co-Master)" option (below), which forces `relationship: istri`
  // in lockstep — the API independently re-enforces that pairing
  // (FamilyGroupsService#createDependantMember), so this is UX
  // convenience, not the only guard.
  const [role, setRole] = useState<
    "dependant" | "operational" | "member" | "spouse"
  >("dependant");
  const [relationship, setRelationship] = useState<MemberRelationship | "">("");
  const [accessRoleId, setAccessRoleId] = useState("");
  const isIstriCoMaster = role === "spouse";
  // FIX 2 (HIGH, react-reviewer + security-reviewer) — show/hide toggle so
  // the head can verify the initial password before handing it over, same
  // pattern as login/page.tsx, without it being permanently plaintext.
  const [showPassword, setShowPassword] = useState(false);

  const { mutate: createMember, isPending } = useMutation({
    mutationFn: async ({
      accessRoleId: chosenRoleId,
      ...body
    }: {
      name: string;
      username: string;
      email?: string;
      initialPassword: string;
      role: "dependant" | "operational" | "member" | "spouse";
      relationship?: MemberRelationship;
      accessRoleId: string | null;
    }) => {
      const created = await apiFetch<{
        id: string;
        username: string;
        pendingEmail?: string | null;
      }>(`/family-groups/${familyGroupId}/members/dependant`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      if (!chosenRoleId) return { created, accessRoleFailed: false };
      try {
        await apiFetch(
          `/family-groups/${familyGroupId}/members/${created.id}/access`,
          {
            method: "PUT",
            token,
            body: JSON.stringify({ accessRoleId: chosenRoleId, overrides: {} }),
          },
        );
        return { created, accessRoleFailed: false };
      } catch {
        return { created, accessRoleFailed: true };
      }
    },
    onSuccess: ({ created, accessRoleFailed }) => {
      onOpenChange(false);
      // FIX 5 (MEDIUM, react-reviewer) — the dialog stays mounted; reset its state with the close.
      setRole("dependant");
      setRelationship("");
      setAccessRoleId("");
      setShowPassword(false);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.familyGroups.accessRoles(familyGroupId ?? ""),
      });
      toast.success(t.akun.addDependant.toastCreated, {
        description: `${t.akun.addDependant.toastCreatedDesc} Login: ${created.username}${created.pendingEmail ? ` · Link konfirmasi dikirim ke ${created.pendingEmail}` : ""}`,
        duration: 10000,
      });
      if (accessRoleFailed) {
        toast.error(t.akun.addDependant.toastAccessRoleFailed);
      }
    },
    onError: (err) => {
      toast.error(
        extractApiErrorMessage(err, t.akun.addDependant.toastCreateFailed),
      );
    },
  });

  function handleCreate() {
    const name = nameRef.current?.value?.trim() ?? "";
    const username = usernameRef.current?.value?.trim() ?? "";
    const email = emailRef.current?.value?.trim() ?? "";
    const initialPassword = passwordRef.current?.value ?? "";
    if (!name || !username || !initialPassword || !familyGroupId) return;
    // EPIC-024 A1 — the istri co-master path always sends
    // relationship: "istri" regardless of what the (disabled) relationship
    // picker shows, so the role/relationship pairing the API requires is
    // never accidentally desynced from the UI's own lockstep behaviour.
    const effectiveRelationship = isIstriCoMaster ? "istri" : relationship;
    createMember({
      name,
      username,
      ...(email ? { email } : {}),
      initialPassword,
      role,
      ...(effectiveRelationship ? { relationship: effectiveRelationship } : {}),
      accessRoleId: isIstriCoMaster ? null : accessRoleId || null,
    });
  }

  // FIX 5 follow-up (react-reviewer round 2) — onSuccess resets role/
  // relationship/showPassword on submit, but the dialog's own close paths
  // (X, Escape, overlay click) skip that reset entirely, so cancelling
  // without submitting leaves stale values for the next open. Reset on
  // every close, not just a successful submit.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setRole("dependant");
      setRelationship("");
      setAccessRoleId("");
      setShowPassword(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* EPIC-026 Wave 3 — prototype `dlg-tambah-anggota`
          (docs/prototype/pages/akun.html). Field order, hints, the
          Co-Master `.notice--warning`, and the two-button footer are the
          prototype's; only the fields the API actually persists are
          rendered (see the omission note on "Rekening yang ditugaskan"
          below). Default 480px width, as in the prototype. */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.akun.addDependant.dialogTitle}</DialogTitle>
          <DialogDescription>
            {t.akun.addDependant.dialogDesc}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Prototype order: Hubungan → Nama → Username → Password Awal →
              Peran. The prototype autofills Peran from Hubungan; this app
              runs the lockstep the other way (Peran "Istri (Co-Master)"
              forces relationship "istri", which the API independently
              re-enforces), so the Co-Master notice below stays attached to
              the control that actually triggers it. */}
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-relationship`}>
              {t.akun.addDependant.relationshipLabel}
            </label>
            <select
              id={`${fieldId}-relationship`}
              className="select"
              value={relationship}
              disabled={isIstriCoMaster}
              onChange={(e) =>
                setRelationship(e.target.value as MemberRelationship | "")
              }
            >
              <option value="">
                {t.akun.addDependant.relationshipNoneOption}
              </option>
              {MemberRelationshipSchema.options.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-name`}>
              {t.akun.addDependant.nameLabel}
            </label>
            <input
              id={`${fieldId}-name`}
              ref={nameRef}
              className="input"
              placeholder={t.akun.addDependant.namePlaceholder}
              type="text"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-username`}>
              {t.akun.addDependant.usernameLabel}
            </label>
            <div className="flex items-stretch">
              <input
                id={`${fieldId}-username`}
                ref={usernameRef}
                className="input rounded-r-none"
                placeholder={t.akun.addDependant.usernamePlaceholder}
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                aria-describedby={`${fieldId}-username-hint`}
              />
              <span className="mono grid shrink-0 place-items-center rounded-r-[9px] border border-l-0 bg-secondary px-2.5 text-[12.5px] text-muted-foreground">
                @{handle ?? "…"}
              </span>
            </div>
            <p className="hint" id={`${fieldId}-username-hint`}>
              Cukup unik di keluarga ini. Anggota login dengan{" "}
              <span className="mono">nama@{handle ?? "kodekeluarga"}</span>.
            </p>
          </div>
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-email`}>
              Email (opsional)
            </label>
            <input
              id={`${fieldId}-email`}
              ref={emailRef}
              className="input"
              placeholder="nama@gmail.com"
              type="email"
              autoComplete="off"
              aria-describedby={`${fieldId}-email-hint`}
            />
            <p className="hint" id={`${fieldId}-email-hint`}>
              Kami kirim link konfirmasi ke email ini. Setelah dikonfirmasi
              pemiliknya, anggota bisa login dengan email juga dan memakai Lupa
              Password.
            </p>
          </div>
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-password`}>
              {t.akun.addDependant.passwordLabel}
            </label>
            <div className="relative">
              <input
                id={`${fieldId}-password`}
                ref={passwordRef}
                className="input pr-10"
                placeholder={t.akun.addDependant.passwordPlaceholder}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={
                  showPassword
                    ? t.akun.addDependant.hidePassword
                    : t.akun.addDependant.showPassword
                }
                aria-pressed={showPassword}
                onClick={() => setShowPassword((s) => !s)}
                // UI/UX audit fix (docs/uiux-beda) — muted-foreground on the
                // dark-theme input background reads as near-invisible; bump
                // to foreground/70 (still a subtle icon, but findable) and
                // give it a visible hit target background on hover/focus.
                className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-accent hover:text-primary focus-visible:bg-accent focus-visible:text-primary focus-visible:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
            <p className="hint">{t.akun.addDependant.passwordHint}</p>
          </div>
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-role`}>
              {t.akun.addDependant.roleLabel}
            </label>
            <select
              id={`${fieldId}-role`}
              className="select"
              value={role}
              onChange={(e) => {
                const next = e.target.value as
                  | "dependant"
                  | "operational"
                  | "member"
                  | "spouse";
                setRole(next);
                // EPIC-024 A1 — selecting "Istri (Co-Master)" locks the
                // relationship picker above to "istri" (the API rejects any
                // other pairing with role owner); switching away clears it
                // back to editable.
                setRelationship(next === "spouse" ? "istri" : "");
                if (next === "spouse") setAccessRoleId("");
              }}
            >
              <option value="spouse">
                {t.akun.addDependant.roleOptions.istriCoMaster}
              </option>
              <option value="dependant">
                {t.akun.addDependant.roleOptions.dependant}
              </option>
              <option value="operational">
                {t.akun.addDependant.roleOptions.operational}
              </option>
              <option value="member">
                {t.akun.addDependant.roleOptions.member}
              </option>
            </select>
          </div>
          {isIstriCoMaster && (
            <div className="notice notice--warning mt-2.5">
              <Crown className="size-4 shrink-0" aria-hidden />
              <span>{t.akun.addDependant.istriCoMasterHint}</span>
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-access-role`}>
              {t.akun.addDependant.accessRoleLabel}
            </label>
            <select
              id={`${fieldId}-access-role`}
              className="select"
              value={accessRoleId}
              disabled={isIstriCoMaster}
              onChange={(e) => setAccessRoleId(e.target.value)}
              aria-describedby={
                roles.length === 0 ? `${fieldId}-access-role-hint` : undefined
              }
            >
              <option value="">
                {t.akun.addDependant.accessRoleDefaultOption}
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {roles.length === 0 && (
              <p className="hint" id={`${fieldId}-access-role-hint`}>
                {t.akun.addDependant.accessRoleEmptyHint}
              </p>
            )}
          </div>
          {/* Honest UI — the prototype's "Rekening yang ditugaskan
              (opsional)" select is omitted: POST
              /family-groups/:id/members/dependant accepts only
              name/username/initialPassword/role/relationship, so an account
              picker here would silently drop the operator's choice. */}
        </DialogBody>
        <DialogFooter>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => handleOpenChange(false)}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={isPending || !familyGroupId}
            className="btn btn--primary disabled:opacity-60"
            onClick={handleCreate}
          >
            {isPending
              ? t.akun.addDependant.creating
              : t.akun.addDependant.createButton}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
