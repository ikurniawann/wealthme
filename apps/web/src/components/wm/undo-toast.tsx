"use client";

import { toast } from "sonner";

/**
 * Bento v2 delete pattern: remove immediately, then offer undo instead of an
 * "are you sure" dialog. Call after the reversible mutation succeeds; the
 * caller owns the restore mutation. Pass `t.common.undo` as `undoLabel`.
 */
export function showUndoToast(
  message: string,
  undoLabel: string,
  onUndo: () => void,
) {
  return toast(message, {
    action: { label: undoLabel, onClick: onUndo },
    duration: 6000,
  });
}
