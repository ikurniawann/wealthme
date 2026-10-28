"use client";

import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AssetCreateValuationSource,
  AssetDto,
  AssetValuationModel,
  AssetValueChangeMode,
  FxInput,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { uploadAssetDocument } from "@/lib/asset-attachments";
import { queryKeys } from "@/lib/query-keys";
import { toastApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";

export interface AssetBody {
  name: string;
  type: string;
  currentValue?: string;
  notes?: string;
  valueChangeRatePct?: string;
  valueChangeMode?: AssetValueChangeMode;
  valueChangeAmount?: string;
  categoryId?: string;
  acquisitionDate?: string;
  unit?: string | null;
  valuationModel?: AssetValuationModel;
  quantity?: string;
  internalCode?: string | null;
  custodian?: string | null;
  details?: Record<string, string> | null;
  ownerUserId?: string | null;
  acquisitionCost?: string;
  valuationDate?: string;
  valuationSource?: AssetCreateValuationSource;
  fxInputs?: FxInput[];
}

/**
 * POST / PATCH /assets for the add/edit drawer (moved out of
 * asset-form.tsx unchanged): optional document upload after save, cache
 * invalidation, toasts, and the quantity error routed back to its field.
 */
export function useAssetSave({
  familyGroupId,
  editing,
  docFile,
  onClose,
  onQtyError,
}: {
  familyGroupId: string;
  editing: AssetDto | null;
  docFile: File | null;
  onClose: () => void;
  onQtyError: (message: string) => void;
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  return useMutation({
    mutationFn: (body: AssetBody) => {
      if (!token) return Promise.reject(new Error("Not authenticated"));
      const base = `/family-groups/${familyGroupId}/assets`;
      return apiFetch<AssetDto>(editing ? `${base}/${editing.id}` : base, {
        method: editing ? "PATCH" : "POST",
        token,
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (saved) => {
      if (docFile) {
        try {
          await uploadAssetDocument(familyGroupId, saved.id, docFile, token);
        } catch (err) {
          toastApiError(err, t, t.aset.toastDocumentFailed);
        }
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      toast.success(editing ? t.aset.toastUpdated : t.aset.toastAdded);
      onClose();
    },
    onError: (err) => {
      if ((err as { code?: unknown }).code === "ASSET_QUANTITY_INVALID") {
        onQtyError(apiErrorMessage(err, t.aset.v3.formQtyInvalid));
        return;
      }
      const fallback = editing
        ? t.aset.toastUpdateFailed
        : t.aset.toastAddFailed;
      const c = t.aset.v3.form.create;
      const field = rejectedField(err, {
        ownerUserId: c.owner,
        acquisitionCost: c.cost,
        valuationDate: c.valuationDate,
        valuationSource: c.valuationSource,
      });
      toast.error(
        field
          ? c.fieldRejected.replace("{field}", field)
          : apiErrorMessage(err, fallback),
      );
    },
  });
}

/**
 * A class-validator 400 carries English `message: string[]` that
 * `apiErrorMessage` (rightly) never shows, so a rejected create-only field
 * used to surface as the generic "coba lagi" toast and invited blind
 * retries. Name the field instead when it is one of `labels`.
 */
export function rejectedField(
  err: unknown,
  labels: Record<string, string>,
): string | null {
  if (
    !err ||
    typeof err !== "object" ||
    (err as { status?: unknown }).status !== 400
  )
    return null;
  const raw = (err as { message?: unknown }).message;
  const lines = Array.isArray(raw) ? raw : [raw];
  for (const line of lines) {
    if (typeof line !== "string") continue;
    const key = /^(\w+)\s/.exec(line.trim())?.[1];
    if (key && Object.hasOwn(labels, key)) return labels[key];
  }
  return null;
}

/** Same linear 5-year approximation as the API's compute-on-read estimate. */
export function projectFiveYears(
  valueDigits: string,
  mode: AssetValueChangeMode,
  rate: string,
  changeDigits: string,
): number | null {
  if (!valueDigits) return null;
  const base = parseInt(valueDigits, 10);
  if (mode === "percent") {
    const r = parseFloat(rate);
    if (!Number.isFinite(r) || r === 0) return null;
    return Math.max(Math.round(base * (1 + (r / 100) * 5)), 0);
  }
  const amount = parseInt(changeDigits || "0", 10);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return Math.max(Math.round(base + amount * 5), 0);
}
