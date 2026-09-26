"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import type { ApiError } from "@/lib/api-client";

export function useApiError() {
  const { t } = useLocale();
  const handleError = useCallback(
    (error: unknown) => {
      const apiError = error as Partial<ApiError>;
      const message =
        extractApiErrorMessage(apiError, t) ??
        (apiError.status === 401
          ? "Sesi habis, silakan login kembali"
          : apiError.status === 403
            ? "Tidak memiliki akses"
            : (apiError.message ?? "Terjadi kesalahan"));
      toast.error(message);
    },
    [t],
  );

  return { handleError };
}
