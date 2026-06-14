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
}

/** Vertical action column on the right edge of liability/insurance cards. */
export function CardSideActions({
  onEdit,
  onDelete,
  onPay,
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
          aria-label="Bayar"
          title="Bayar"
          onClick={onPay}
          className="flex size-[34px] items-center justify-center rounded-[9px] bg-success/10 text-success transition-colors hover:bg-success hover:text-white"
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
