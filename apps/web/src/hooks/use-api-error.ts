"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/components/money/fx-inputs";
import { useLocale } from "@/hooks/use-locale";
import type { ApiError } from "@/lib/api-client";
import { describeApiError, type ApiErrorCopy } from "@/lib/api-error";

/**
 * A2 (revisi-2) — "no technical junk in front of the user": this is the
 * app's general-purpose error toast, so it is the one place that MUST never
 * leak a request id, HTTP status, stack trace, or a raw server/class-
 * validator string. `extractApiErrorMessage` only maps specific known
 * codes to friendly copy; anything else (a plain JS `Error`, a network
 * failure, an unrecognised status/code) falls back to localized copy
 * instead of the raw `.message`. The real error still goes to the console
 * for debugging.
 *
 * A 4xx whose message is plain business copy the server wrote for people
 * (e.g. "Saldo rekening bank ... tidak mencukupi") is still shown: that is
 * the actionable reason, not technical detail. Anything that smells
 * technical (status codes, ids, exception names, class-validator English)
 * never reaches the toast.
 */
const TECHNICAL_PATTERN =
  /HTTP\s?\d{3}|status\s?\d{3}|exception|prisma|stack|request ?id|trace|undefined|null|\berror\b|must be|should not|is not allowed|property |\bat \w+ \(/i;
const MAX_FRIENDLY_LENGTH = 200;

export function friendlyServerMessage(
  apiError: Partial<ApiError>,
): string | null {
  const { status, message } = apiError;
  if (typeof status !== "number" || status < 400 || status >= 500) return null;
  if (typeof message !== "string") return null;
  const text = message.trim();
  if (!text || text.length > MAX_FRIENDLY_LENGTH) return null;
  return TECHNICAL_PATTERN.test(text) ? null : text;
}

type ApiErrorT = {
  common: { apiError: ApiErrorCopy };
  money: { fxIndicativeRefused: string };
};

/**
 * Toast an API failure. `title` keeps the toast specific to the action
 * ("Failed to save the asset"); the localized reason goes underneath. Usable
 * from any `onError` callback that has `t` in scope.
 */
export function toastApiError(error: unknown, t: ApiErrorT, title?: string) {
  console.error("[api] request failed:", error);
  const reason =
    extractApiErrorMessage(error, t) ??
    describeApiError(error, t.common.apiError);
  if (title && title !== reason) {
    toast.error(title, { description: reason });
    return;
  }
  toast.error(title ?? reason);
}

export function useApiError() {
  const { t } = useLocale();
  const handleError = useCallback(
    (error: unknown) => toastApiError(error, t),
    [t],
  );

  return { handleError };
}
