"use client";

import type { MouseEvent } from "react";
import { Pencil, Trash2, Banknote } from "lucide-react";

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

/** Compact edit/delete icon pair used at the end of list rows and table cells. */
export function RowActions({ onEdit, onDelete, className }: RowActionsProps) {
  const handle = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className={`flex shrink-0 gap-[5px] ${className ?? ""}`}>
      <button
        type="button"
        aria-label="Edit"
        onClick={handle(onEdit)}
        className="flex size-7 items-center justify-center rounded-[7px] bg-accent text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        <Pencil className="size-3" />
      </button>
      <button
        type="button"
        aria-label="Hapus"
        onClick={handle(onDelete)}
        className="flex size-7 items-center justify-center rounded-[7px] bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-white"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

interface CardSideActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  /** Optional "bayar" action (liabilitas/asuransi cards). */
  onPay?: () => void;
  /**
   * EPIC-023 group E retry round 4 (C3) — the `/asuransi` page rendered NO
   * disabled state at all, even though the object it renders already
   * carries `paidThisPeriod`: a user who paid via `/anggaran` (which DOES
   * disable) could still open `/asuransi` and click Bayar again for a
   * second debit. Honest UI: when the obligation is already paid this
   * period, disable the button and swap its tooltip instead of leaving a
   * live-looking "Bayar" control that the server will now (also) reject.
   */
  payDisabled?: boolean;
  payDisabledLabel?: string;
}

/** Vertical action column on the right edge of liability/insurance cards. */
export function CardSideActions({
  onEdit,
  onDelete,
  onPay,
  payDisabled = false,
  payDisabledLabel,
}: CardSideActionsProps) {
  return (
    <div className="flex shrink-0 flex-col justify-center gap-1.5 border-l pl-2.5">
      <button
        type="button"
        aria-label="Edit"
        title="Edit"
        onClick={onEdit}
        className="flex size-[34px] items-center justify-center rounded-[9px] bg-accent text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        <Pencil className="size-3.5" />
      </button>
      {onPay && (
        <button
          type="button"
          aria-label={
            payDisabled && payDisabledLabel ? payDisabledLabel : "Bayar"
          }
          title={payDisabled && payDisabledLabel ? payDisabledLabel : "Bayar"}
          onClick={onPay}
          disabled={payDisabled}
          className="flex size-[34px] items-center justify-center rounded-[9px] bg-success/10 text-success transition-colors hover:bg-success hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-success/10 disabled:hover:text-success"
        >
          <Banknote className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label="Hapus"
        title="Hapus"
        onClick={onDelete}
        className="flex size-[34px] items-center justify-center rounded-[9px] bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-white"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
