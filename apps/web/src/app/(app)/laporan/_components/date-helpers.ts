import type { Locale } from "@/i18n";

/* ───────────────────────── Locale-aware date helpers ───────────────────────── */

export function localeTag(locale: Locale): string {
  return locale === "en" ? "en-US" : "id-ID";
}

export function formatLocaleDateLong(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatLocaleDateShort(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(localeTag(locale), {
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatLocaleTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  });
}
