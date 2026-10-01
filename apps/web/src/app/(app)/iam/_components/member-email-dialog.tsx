"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

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

import type { MemberRow } from "./members-tab";

type MemberEmailDialogProps = {
  member: MemberRow | null;
  onClose: () => void;
  familyGroupId: string | null;
  token: string | undefined;
};

/**
 * EPIC-031 — give a Master-created member an email (or resend its link).
 * The address is only pending until its owner confirms from their inbox, so
 * the copy says exactly that instead of implying it works immediately.
 */
export function MemberEmailDialog({
  member,
  onClose,
  familyGroupId,
  token,
}: MemberEmailDialogProps) {
  const { handleError } = useApiError();
  const fieldId = useId();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(member?.pendingEmail ?? "");

  const save = useMutation({
    mutationFn: (next: string | null) =>
      apiFetch<{ pendingEmail: string | null }>(
        `/family-groups/${familyGroupId}/members/${member?.id}/email`,
        { token, method: "PUT", body: JSON.stringify({ email: next }) },
      ),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
      });
      toast.success(
        res.pendingEmail ? "Link konfirmasi dikirim" : "Email dibatalkan",
        {
          description: res.pendingEmail
            ? `Minta ${member?.name} membuka email di ${res.pendingEmail} dan klik link konfirmasi.`
            : undefined,
        },
      );
      onClose();
    },
    onError: handleError,
  });

  const trimmed = email.trim();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(o) => !o && !save.isPending && onClose()}
    >
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              Email untuk {member?.name}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              Kami kirim link konfirmasi ke email ini. Setelah pemilik email
              mengeklik link itu, {member?.name} bisa login dengan email dan
              memakai Lupa Password. Sebelum dikonfirmasi, email belum berlaku.
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
            if (isValid) save.mutate(trimmed);
          }}
        >
          <div className="wm-panel-body wm-form">
            <label className="field" htmlFor={`${fieldId}-email`}>
              <span className="label">Email</span>
              <input
                id={`${fieldId}-email`}
                className="input"
                type="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@gmail.com"
                disabled={save.isPending}
              />
            </label>
            {member?.pendingEmail && (
              <p className="hint">
                Menunggu konfirmasi: <strong>{member.pendingEmail}</strong>.
                Simpan lagi untuk mengirim ulang link.
              </p>
            )}
          </div>
          <div className="wm-panel-foot">
            {member?.pendingEmail && (
              <button
                type="button"
                className="btn btn--ghost text-destructive"
                disabled={save.isPending}
                onClick={() => save.mutate(null)}
              >
                Batalkan email
              </button>
            )}
            <PillButton
              type="button"
              disabled={save.isPending}
              onClick={onClose}
            >
              Tutup
            </PillButton>
            <PillButton
              variant="primary"
              type="submit"
              disabled={!isValid || save.isPending}
            >
              {save.isPending ? "Mengirim…" : "Kirim Link Konfirmasi"}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}
