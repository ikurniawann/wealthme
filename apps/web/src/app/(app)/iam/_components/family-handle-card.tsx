"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { FAMILY_HANDLE_PATTERN } from "@wealthme/contracts";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/wm";
import { useApiError } from "@/hooks/use-api-error";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * EPIC-031 — "kode keluarga": the part after "@" in every login the Master
 * creates (`budi@arsandi`). Renaming it rewrites those logins, so the dialog
 * says so before saving.
 *
 * iam.html's `editHandle`/`Ubah Kode` lives on the hero's "Kode: <handle>"
 * ghost button (EPIC-033 restyle) — this card no longer renders its own
 * trigger, it only owns the fetch + the edit dialog, fully controlled by
 * the parent's `open`/`onOpenChange`.
 */
export function useFamilyHandle(
  familyGroupId: string | null,
  token: string | undefined,
) {
  const key = queryKeys.familyGroups.loginHandle(familyGroupId ?? "");
  const { data } = useQuery<{ handle: string }>({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiFetch<{ handle: string }>(
        `/family-groups/${familyGroupId}/login-handle`,
        { token, signal },
      ),
    enabled: Boolean(token) && Boolean(familyGroupId),
    staleTime: 60_000,
  });
  return data?.handle;
}

type FamilyHandleDialogProps = {
  familyGroupId: string | null;
  token: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FamilyHandleDialog({
  familyGroupId,
  token,
  open,
  onOpenChange,
}: FamilyHandleDialogProps) {
  const { handleError } = useApiError();
  const fieldId = useId();
  const queryClient = useQueryClient();
  const key = queryKeys.familyGroups.loginHandle(familyGroupId ?? "");
  const handle = useFamilyHandle(familyGroupId, token);
  const [draft, setDraft] = useState("");
  // Reset the draft to the current handle each time the dialog transitions
  // from closed to open — "adjusting state when a prop changes", derived
  // during render with plain state (no ref, no effect) per
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && draft !== (handle ?? "")) setDraft(handle ?? "");
  }

  const save = useMutation({
    mutationFn: (next: string) =>
      apiFetch<{ handle: string }>(
        `/family-groups/${familyGroupId}/login-handle`,
        { token, method: "PATCH", body: JSON.stringify({ handle: next }) },
      ),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
      });
      toast.success("Kode keluarga diubah", {
        description: `Anggota sekarang login dengan nama@${res.handle}.`,
      });
      onOpenChange(false);
    },
    onError: handleError,
  });

  const normalized = draft.trim().toLowerCase();
  const valid = FAMILY_HANDLE_PATTERN.test(normalized);
  const changed = normalized !== handle;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && !save.isPending && onOpenChange(false)}
      >
        <PanelContent variant="side" className="wm-form-panel">
          <header className="wm-panel-head">
            <div className="min-w-0">
              <DialogTitle className="wm-panel-title">
                Ubah Kode Keluarga
              </DialogTitle>
              <DialogDescription className="wm-panel-desc">
                Semua login anggota yang Anda buatkan ikut berubah, misalnya{" "}
                <span className="mono">budi@{handle}</span> menjadi{" "}
                <span className="mono">
                  budi@{valid ? normalized : "kodebaru"}
                </span>
                . Beri tahu anggota setelah mengubahnya.
              </DialogDescription>
            </div>
            <DialogClose className="wm-panel-x" aria-label="Tutup">
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && changed) save.mutate(normalized);
            }}
          >
            <div className="wm-panel-body wm-form">
              <label className="field" htmlFor={`${fieldId}-handle`}>
                <span className="label">Kode baru</span>
                <input
                  id={`${fieldId}-handle`}
                  className="input mono"
                  value={draft}
                  maxLength={24}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={(e) => setDraft(e.target.value)}
                  aria-invalid={draft.length > 0 && !valid}
                  aria-describedby={`${fieldId}-hint`}
                  disabled={save.isPending}
                />
                <span
                  className={valid || !draft ? "hint" : "hint text-destructive"}
                  id={`${fieldId}-hint`}
                >
                  3–24 karakter: huruf kecil, angka, tanda minus. Contoh:
                  arsandi, keluarga-arsandi.
                </span>
              </label>
            </div>
            <div className="wm-panel-foot">
              <PillButton
                type="button"
                disabled={save.isPending}
                onClick={() => onOpenChange(false)}
              >
                Batal
              </PillButton>
              <PillButton
                variant="primary"
                type="submit"
                disabled={!valid || !changed || save.isPending}
              >
                {save.isPending ? "Menyimpan…" : "Simpan Kode"}
              </PillButton>
            </div>
          </form>
        </PanelContent>
      </Dialog>
    </>
  );
}
