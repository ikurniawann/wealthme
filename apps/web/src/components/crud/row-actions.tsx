"use client";

import type { MouseEvent } from "react";
import { Pencil, Trash2, Banknote, Info } from "lucide-react";

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
  /**
   * EPIC-023 group E retry round 4 (C4) — an obligation-linked transaction
   * (a liability payment/purchase or insurance premium) is now REFUSED by
   * the API when edited/deleted (editing/deleting it desyncs the debt/
   * coverage it recorded). Honest UI: disable both controls and swap their
   * label instead of leaving a live-looking Edit/Hapus pair the server will
   * now (also) reject — mirrors `CardSideActions`' own `payDisabled`
   * pattern.
   */
  disabled?: boolean;
  disabledLabel?: string;
}

/** Compact edit/delete icon pair used at the end of list rows and table cells. */
export function RowActions({
  onEdit,
  onDelete,
  className,
  disabled = false,
  disabledLabel,
}: RowActionsProps) {
  const handle = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const editLabel = disabled && disabledLabel ? disabledLabel : "Edit";
  const deleteLabel = disabled && disabledLabel ? disabledLabel : "Hapus";
  return (
    <div className={`flex shrink-0 gap-[5px] ${className ?? ""}`}>
      {/* Hardening batch G3 (P1) — 28px misses the 44px WCAG 2.2 AA touch
          target; the `[@media(pointer:coarse)]:` variant bumps only real
          touchscreens, leaving mouse/trackpad desktop sizing untouched. */}
      <button
        type="button"
        aria-label={editLabel}
        title={editLabel}
        onClick={handle(onEdit)}
        disabled={disabled}
        className="flex size-7 items-center justify-center rounded-[7px] bg-accent text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent disabled:hover:text-primary [@media(pointer:coarse)]:size-11"
      >
        <Pencil className="size-3" />
      </button>
      <button
        type="button"
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={handle(onDelete)}
        disabled={disabled}
        className="flex size-7 items-center justify-center rounded-[7px] bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-destructive/10 disabled:hover:text-destructive [@media(pointer:coarse)]:size-11"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

interface CardSideActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  /**
   * EPIC-024 group G — optional "detail" action (liabilitas cards): opens a
   * read-only dialog with the item's full info + amortisation summary.
   */
  onDetail?: () => void;
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
  onDetail,
  onPay,
  payDisabled = false,
  payDisabledLabel,
}: CardSideActionsProps) {
  return (
    <div className="flex shrink-0 flex-col justify-center gap-1.5 border-l pl-2.5">
      {onDetail && (
        <button
          type="button"
          aria-label="Detail"
          title="Detail"
          onClick={onDetail}
          className="flex size-[34px] items-center justify-center rounded-[9px] bg-muted text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <Info className="size-3.5" />
        </button>
      )}
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
