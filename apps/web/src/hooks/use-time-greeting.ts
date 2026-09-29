"use client";

// G8 (hardening batch) — AIChatCard's greeting: time-of-day Indonesian
// greeting (WIB) + the user's first name. Shared by the /ai page and the
// floating AI launcher so both read the exact same wall-clock rule.

import { useLocale } from "@/hooks/use-locale";

function wibHour(): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  // "24" at midnight in some ICU implementations; normalize to 0.
  return Number(hourStr) % 24;
}

/** First token of a full name, falling back to the whole string if there's no space. */
export function firstName(fullName: string | undefined | null): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** "Selamat pagi/siang/sore/malam" (or the English equivalent) for the current WIB hour. */
export function useTimeGreeting(name?: string | null): string {
  const { t } = useLocale();
  const hour = wibHour();
  const label =
    hour < 11
      ? t.greeting.morning
      : hour < 15
        ? t.greeting.afternoon
        : hour < 19
          ? t.greeting.afternoon2
          : t.greeting.evening;
  const who = firstName(name);
  return who ? `${label}, ${who}!` : `${label}!`;
}
