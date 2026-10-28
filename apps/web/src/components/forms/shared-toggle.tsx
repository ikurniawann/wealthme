"use client";

import { useId } from "react";

import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/hooks/use-locale";

/**
 * The one "Shared with others" control used by every add/edit form.
 * ON  = visible to the family (members with access).
 * OFF = visible only to Master & Co-Master (stored as `isPrivate: true`).
 */
export function SharedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (shared: boolean) => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const c = t.common.sharing;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--wm-line)] px-3.5 py-3">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        aria-label={c.label}
      />
      <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
        <b className="text-[length:var(--wm-type-13)] font-semibold">
          {c.label}
        </b>
        <span className="text-[length:var(--wm-type-12)] text-[var(--wm-muted)]">
          {checked ? c.onHint : c.offHint}
        </span>
      </label>
    </div>
  );
}
