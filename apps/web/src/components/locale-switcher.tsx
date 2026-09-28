"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

/**
 * A3 (revisi-2) — topbar ID/EN toggle, sized to sit next to `ThemeToggle`.
 * `size` lets the topbar (size-9, matching the theme buttons) and any other
 * call site (compact) share the component.
 */
export function LocaleSwitcher({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "compact";
}) {
  const { locale, toggle, t } = useLocale();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.shell.localeSwitcher.ariaLabel.replace(
        "%s",
        locale.toUpperCase(),
      )}
      className={cn(
        "flex items-center justify-center gap-1 rounded-md text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-primary",
        size === "default"
          ? "size-9 bg-secondary"
          : "gap-1 rounded px-2 py-0.5",
        className,
      )}
    >
      <span aria-hidden="true" style={{ opacity: locale === "id" ? 1 : 0.4 }}>
        ID
      </span>
      <span aria-hidden="true" className="opacity-30">
        /
      </span>
      <span aria-hidden="true" style={{ opacity: locale === "en" ? 1 : 0.4 }}>
        EN
      </span>
    </button>
  );
}
