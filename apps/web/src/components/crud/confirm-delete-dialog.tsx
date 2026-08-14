"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
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
    // EPIC-026 Wave 8 — composition taken verbatim from the prototype's
    // `dlg-md-delete` (docs/prototype/pages/masterdata.html): a
    // `dialog--sm` (400px) box, left-aligned `.dialog__title` +
    // `.dialog__desc`, and a `.dialog__footer` whose outline "Batal" sits
    // left of the destructive confirm. The previous centred layout and its
    // ⚠️ emoji medallion were app inventions with no prototype counterpart.
    // The prototype additionally carries a `.notice` explaining the
    // consequence — deliberately NOT reproduced here: this component takes
    // exactly one caller-supplied sentence (`body`), which belongs in
    // `.dialog__desc`; inventing a second, generic consequence line would
    // be copy the callers never wrote.
    <Dialog open={label !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog--sm" showCloseButton={false}>
        <DialogTitle>{title ?? `Hapus ${label}?`}</DialogTitle>
        <DialogDescription>
          {body ?? `${label} yang dihapus tidak bisa dikembalikan.`}
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel ?? "Ya, Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
