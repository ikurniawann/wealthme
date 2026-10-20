"use client";

import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
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
        } catch {
          toast.error(t.aset.toastDocumentFailed);
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
      toast.error(apiErrorMessage(err, fallback));
    },
  });
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
