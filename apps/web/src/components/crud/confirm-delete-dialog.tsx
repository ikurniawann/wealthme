"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteDialogProps {
  /** Entity label, e.g. "Transaksi" — dialog is closed when null. */
  label: string | null;
  onClose: () => void;
  onConfirm: () => void;
  // EPIC-023 Group F fix round (HIGH 1) — this dialog is the app's one
  // real (non-`window.confirm`) confirmation pattern, so irreversible
  // actions that aren't a deletion (e.g. confirming a split-bill payment,
  // revoking a share link) reuse it instead of inventing another. All four
  // are optional and default to the exact original delete copy/behavior —
  // every pre-existing caller (asuransi/warisan/etc.) is unaffected.
  title?: string;
  body?: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
}

export function ConfirmDeleteDialog({
  label,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  confirmVariant = "destructive",
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={label !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="text-center min-[769px]:w-[min(380px,calc(100%-2rem))]"
        showCloseButton={false}
      >
        <div className="mx-auto flex size-[60px] items-center justify-center rounded-full bg-destructive/10 text-[26px]">
          ⚠️
        </div>
        <DialogTitle className="text-center text-[17px] font-extrabold">
          {title ?? `Hapus ${label}?`}
        </DialogTitle>
        <p className="text-[13px] text-muted-foreground">
          {body ?? `${label} yang dihapus tidak bisa dikembalikan.`}
        </p>
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant={confirmVariant}
            className="flex-1"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel ?? "Ya, Hapus"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
