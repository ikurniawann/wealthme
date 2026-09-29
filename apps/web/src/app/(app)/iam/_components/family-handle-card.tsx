"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FAMILY_HANDLE_PATTERN } from "@wealthme/contracts";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiError } from "@/hooks/use-api-error";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type FamilyHandleCardProps = {
  familyGroupId: string | null;
  token: string | undefined;
};

/**
 * EPIC-031 — "kode keluarga": the part after "@" in every login the Master
 * creates (`budi@arsandi`). Renaming it rewrites those logins, so the dialog
 * says so before saving.
 */
export function FamilyHandleCard({
  familyGroupId,
  token,
}: FamilyHandleCardProps) {
  const { handleError } = useApiError();
  const fieldId = useId();
  const queryClient = useQueryClient();
  const key = queryKeys.familyGroups.loginHandle(familyGroupId ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

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
  const handle = data?.handle;

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
      setEditing(false);
    },
    onError: handleError,
  });

  const normalized = draft.trim().toLowerCase();
  const valid = FAMILY_HANDLE_PATTERN.test(normalized);
  const changed = normalized !== handle;

  return (
    <section className="card">
      <div
        className="card__body row row--between row--wrap"
        style={{ gap: 12 }}
      >
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <AtSign size={15} aria-hidden="true" />
          </span>
          <div>
            <div className="text-[13px] font-bold">
              Kode keluarga:{" "}
              <span className="mono text-primary">{handle ?? "…"}</span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Anggota yang Anda buatkan akun login dengan{" "}
              <span className="mono">nama@{handle ?? "kode"}</span>. Username
              cukup unik di dalam keluarga ini.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          disabled={!handle}
          onClick={() => {
            setDraft(handle ?? "");
            setEditing(true);
          }}
        >
          <Pencil size={14} aria-hidden="true" />
          Ubah Kode
        </button>
      </div>

      <Dialog
        open={editing}
        onOpenChange={(o) => !o && !save.isPending && setEditing(false)}
      >
        <DialogContent className="dialog--sm">
          <DialogTitle>Ubah Kode Keluarga</DialogTitle>
          <DialogDescription>
            Semua login anggota yang Anda buatkan ikut berubah, misalnya{" "}
            <span className="mono">budi@{handle}</span> menjadi{" "}
            <span className="mono">budi@{valid ? normalized : "kodebaru"}</span>
            . Beri tahu anggota setelah mengubahnya.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && changed) save.mutate(normalized);
            }}
          >
            <DialogBody>
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
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                className="btn btn--outline"
                disabled={save.isPending}
                onClick={() => setEditing(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!valid || !changed || save.isPending}
              >
                {save.isPending ? "Menyimpan…" : "Simpan Kode"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
