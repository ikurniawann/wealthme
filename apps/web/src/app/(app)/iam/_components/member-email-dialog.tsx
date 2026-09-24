"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
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
    onError: (e: { message?: string }) =>
      toast.error(e.message ?? "Gagal menyimpan email"),
  });

  const trimmed = email.trim();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(o) => !o && !save.isPending && onClose()}
    >
      <DialogContent className="dialog--sm">
        <DialogTitle>Email untuk {member?.name}</DialogTitle>
        <DialogDescription>
          Kami kirim link konfirmasi ke email ini. Setelah pemilik email
          mengeklik link itu, {member?.name} bisa login dengan email dan memakai
          Lupa Password. Sebelum dikonfirmasi, email belum berlaku.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid) save.mutate(trimmed);
          }}
        >
          <DialogBody>
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
          </DialogBody>
          <DialogFooter>
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
            <button
              type="button"
              className="btn btn--outline"
              disabled={save.isPending}
              onClick={onClose}
            >
              Tutup
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!isValid || save.isPending}
            >
              {save.isPending ? "Mengirim…" : "Kirim Link Konfirmasi"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
