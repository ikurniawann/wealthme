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

/** A reversible UI removal: the destructive request only starts after Undo expires. */
export function showDelayedUndoToast({
  message,
  undoLabel,
  onUndo,
  commit,
  onError,
}: {
  message: string;
  undoLabel: string;
  onUndo: () => void;
  commit: () => Promise<unknown>;
  onError: () => void;
}) {
  let pending = true;
  const undo = () => {
    if (!pending) return;
    pending = false;
    window.clearTimeout(timer);
    toast.dismiss(id);
    onUndo();
  };
  const id = toast(<span role="status">{message}</span>, {
    action: { label: undoLabel, onClick: undo },
    duration: 6000,
    dismissible: false,
  });
  const timer = window.setTimeout(() => {
    pending = false;
    // Sonner pauses its visual duration on hover; never leave a stale Undo
    // button visible once the request has actually started.
    toast.dismiss(id);
    void commit().catch(onError);
  }, 6000);
  return undo;
}
