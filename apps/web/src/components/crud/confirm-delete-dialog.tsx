"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteDialogProps {
  /** Entity label, e.g. "Transaksi" — dialog is closed when null. */
  label: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  label,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={label !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="text-center sm:max-w-[380px]"
        showCloseButton={false}
      >
        <div className="mx-auto flex size-[60px] items-center justify-center rounded-full bg-destructive/10 text-[26px]">
          ⚠️
        </div>
        <DialogTitle className="text-center text-[17px] font-extrabold">
          Hapus {label}?
        </DialogTitle>
        <p className="text-[13px] text-muted-foreground">
          {label} yang dihapus tidak bisa dikembalikan.
        </p>
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            Ya, Hapus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
