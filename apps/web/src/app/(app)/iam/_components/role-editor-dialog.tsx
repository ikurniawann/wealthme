"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LEGACY_ACCESS_PRESETS,
  type AccessDataScope,
  type AccessLevel,
  type AccessPage,
  type AccessRoleResponse,
} from "@wealthme/contracts";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

import {
  SCOPE_COPY,
  compactPermissions,
  fillPermissions,
  summarizePermissions,
} from "./access-shared";
import { PageAccessMatrix } from "./page-access-matrix";

type TemplateKey = keyof typeof LEGACY_ACCESS_PRESETS;
const TEMPLATE_ORDER: TemplateKey[] = [
  "dependant",
  "operational",
  "admin_staff",
  "member",
  "spouse",
];

type RoleEditorDialogProps = {
  /** `null` closed, `"new"` create, or the role being edited. */
  target: AccessRoleResponse | "new" | null;
  onClose: () => void;
  familyGroupId: string | null;
  token: string | undefined;
};

/**
 * Create / edit a custom role: name, who-sees-what data scope, and the
 * page × level matrix. Starting points come from the built-in member types
 * so the Master never has to fill 23 rows from nothing.
 */
export function RoleEditorDialog({
  target,
  onClose,
  familyGroupId,
  token,
}: RoleEditorDialogProps) {
  const { t } = useLocale();
  const { handleError } = useApiError();
  const fieldId = useId();
  const queryClient = useQueryClient();
  const editing = target !== null && target !== "new" ? target : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [dataScope, setDataScope] = useState<AccessDataScope>(
    editing?.dataScope ?? "own",
  );
  const [perms, setPerms] = useState<Record<AccessPage, AccessLevel>>(() =>
    fillPermissions(
      editing?.permissions ?? LEGACY_ACCESS_PRESETS.dependant.permissions,
    ),
  );

  const save = useMutation({
    mutationFn: () =>
      apiFetch<AccessRoleResponse>(
        editing
          ? `/family-groups/${familyGroupId}/access-roles/${editing.id}`
          : `/family-groups/${familyGroupId}/access-roles`,
        {
          token,
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            dataScope,
            permissions: compactPermissions(perms),
          }),
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.familyGroups.accessRoles(familyGroupId ?? ""),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
        }),
      ]);
      toast.success(editing ? "Role diperbarui" : "Role dibuat", {
        description: editing
          ? "Perubahan langsung berlaku untuk semua anggota dengan role ini."
          : "Pilih role ini untuk anggota lewat tombol Atur Akses.",
      });
      onClose();
    },
    onError: handleError,
  });

  const applyTemplate = (key: TemplateKey) => {
    setPerms(fillPermissions(LEGACY_ACCESS_PRESETS[key].permissions));
    setDataScope(LEGACY_ACCESS_PRESETS[key].dataScope);
  };

  const canSave = name.trim().length > 0 && !save.isPending;

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => !o && !save.isPending && onClose()}
    >
      <DialogContent className="dialog--wide">
        <DialogTitle>
          {editing ? `Edit Role: ${editing.name}` : "Buat Role"}
        </DialogTitle>
        <DialogDescription>
          Role = kumpulan akses halaman. Satu role bisa dipakai banyak anggota;
          mengubah role langsung berlaku untuk semuanya.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <DialogBody>
            <div className="field-row">
              <label className="field" htmlFor={`${fieldId}-name`}>
                <span className="label">Nama role</span>
                <input
                  id={`${fieldId}-name`}
                  className="input"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Anak, Supir, Asisten Rumah"
                  required
                />
              </label>
              <label className="field mt-0" htmlFor={`${fieldId}-desc`}>
                <span className="label">Keterangan (opsional)</span>
                <input
                  id={`${fieldId}-desc`}
                  className="input"
                  value={description}
                  maxLength={200}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Untuk siapa role ini"
                />
              </label>
            </div>

            <fieldset className="field">
              <legend className="label">Data yang terlihat</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["own", "all"] as const).map((scope) => (
                  <label
                    key={scope}
                    className={cn(
                      "flex cursor-pointer gap-2.5 rounded-[10px] border p-3 transition-colors",
                      dataScope === scope
                        ? "border-primary bg-accent"
                        : "hover:bg-secondary",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-scope`}
                      checked={dataScope === scope}
                      onChange={() => setDataScope(scope)}
                      className="mt-0.5 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="block text-[13px] font-bold">
                        {SCOPE_COPY[scope].title}
                      </span>
                      <span className="block text-[11.5px] text-muted-foreground">
                        {SCOPE_COPY[scope].detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <div className="row row--between row--wrap">
                <span className="label">Akses halaman</span>
                <span className="t-xs t-muted">
                  {summarizePermissions(compactPermissions(perms))}
                </span>
              </div>
              <div className="row row--wrap" style={{ gap: 6 }}>
                <span className="t-xs t-muted">Mulai dari template:</span>
                {TEMPLATE_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="tab"
                    onClick={() => applyTemplate(key)}
                  >
                    {t.common.roleLabels[key]}
                  </button>
                ))}
              </div>
              <PageAccessMatrix
                value={perms}
                onChange={(page, level) =>
                  setPerms((prev) => ({ ...prev, [page]: level }))
                }
                disabled={save.isPending}
              />
              <p className="hint">
                IAM Roles tidak bisa diberikan — hanya Master yang bisa mengatur
                akses. Akun, Akses Saya, Notifikasi dan Panduan selalu terbuka
                untuk semua anggota.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              className="btn btn--outline"
              disabled={save.isPending}
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!canSave}
            >
              {save.isPending
                ? "Menyimpan…"
                : editing
                  ? "Simpan Role"
                  : "Buat Role"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
