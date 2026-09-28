"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import type { ApiError } from "@/lib/api-client";

/**
 * A2 (revisi-2) — "no technical junk in front of the user": this is the
 * app's general-purpose error toast, so it is the one place that MUST never
 * leak a request id, HTTP status, stack trace, or a raw server/class-
 * validator string. `extractApiErrorMessage` only maps specific known
 * codes to friendly copy; anything else (a plain JS `Error`, a network
 * failure, an unrecognised status/code) falls back to localized copy
 * instead of the raw `.message`. The real error still goes to the console
 * for debugging.
 */
export function useApiError() {
  const { t } = useLocale();
  const handleError = useCallback(
    (error: unknown) => {
      const apiError = error as Partial<ApiError>;
      console.error("[api] request failed:", error);
      const message =
        extractApiErrorMessage(apiError, t) ??
        (apiError.status === 401
          ? t.common.apiError.sessionExpired
          : apiError.status === 403
            ? t.common.apiError.accessDenied
            : t.common.apiError.generic);
      toast.error(message);
    },
    [t],
  );

  return { handleError };
}
