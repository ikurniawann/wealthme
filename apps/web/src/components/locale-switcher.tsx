"use client";

import { useLocale } from "@/hooks/use-locale";

export function LocaleSwitcher() {
  const { locale, toggle } = useLocale();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch language — current: ${locale.toUpperCase()}`}
      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <span
        aria-hidden="true"
        style={{ fontWeight: locale === "id" ? 700 : 400 }}
      >
        ID
      </span>
      <span aria-hidden="true" className="opacity-40">
        |
      </span>
      <span
        aria-hidden="true"
        style={{ fontWeight: locale === "en" ? 700 : 400 }}
      >
        EN
      </span>
    </button>
  );
}
