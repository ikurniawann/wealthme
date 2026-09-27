"use client";

import { useState } from "react";
import { EmojiPicker } from "@/components/wm";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * polish-j batch 7a item 1 — the inline `EmojiPicker` (quick-pick row +
 * search + a ~168px scrolling grid) pushed the first real field below the
 * fold on every dialog that opens with an icon chooser. This wraps the same
 * unmodified `EmojiPicker` in a nested dialog behind a single 40px trigger
 * button showing the current icon, so the dialog opens on the field that
 * actually matters (name/target/amount) instead of a grid.
 *
 * A nested Dialog (not a Sheet): the Sheet sat at z-50, underneath the
 * z-[60] CRUD dialog and its backdrop, so the picker opened dimmed and
 * unclickable behind the form.
 */
export function IconPickerField({
  label,
  value,
  onChange,
  searchPlaceholder,
  noResultsLabel,
  loadingLabel,
  ariaLabel,
}: {
  label?: string;
  value: string;
  onChange: (emoji: string) => void;
  searchPlaceholder: string;
  noResultsLabel: string;
  loadingLabel: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="field">
      {label && <span className="label">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className="flex size-10 items-center justify-center rounded-lg border bg-card text-[18px] transition-colors hover:bg-accent"
      >
        {value || "🏷️"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{label}</DialogTitle>
          <DialogBody>
            <EmojiPicker
              value={value}
              onChange={(emoji) => {
                onChange(emoji);
                setOpen(false);
              }}
              searchPlaceholder={searchPlaceholder}
              noResultsLabel={noResultsLabel}
              loadingLabel={loadingLabel}
              ariaLabel={ariaLabel}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
