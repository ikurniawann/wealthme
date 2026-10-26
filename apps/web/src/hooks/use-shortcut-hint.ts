"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const snapshot = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function useShortcutHint() {
  const mac = useSyncExternalStore(subscribe, snapshot, () => false);
  return {
    search: mac ? "⌘ K" : "Ctrl K",
    transaction: mac ? "⌘ ⇧ ↵" : "Ctrl Shift Enter",
    modifier: mac ? "Meta" : "Control",
  };
}

export function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
      ),
    )
  );
}
