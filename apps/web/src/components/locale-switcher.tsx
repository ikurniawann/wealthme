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

  const segment = (value: "id" | "en") => (
    <button
      type="button"
      role="radio"
      aria-checked={locale === value}
      onClick={() => {
        if (locale !== value) toggle();
      }}
      className={cn(
        "flex h-full items-center justify-center rounded-[5px] px-2 text-[11px] font-bold tracking-wide transition-colors",
        locale === value
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-primary",
      )}
    >
      {value.toUpperCase()}
    </button>
  );

  return (
    <div
      role="radiogroup"
      aria-label={t.shell.localeSwitcher.ariaLabel.replace(
        "%s",
        locale.toUpperCase(),
      )}
      className={cn(
        "flex items-center gap-0.5 rounded-md bg-secondary p-0.5",
        size === "default" ? "h-9" : "h-7",
        className,
      )}
    >
      {segment("id")}
      {segment("en")}
    </div>
  );
}
