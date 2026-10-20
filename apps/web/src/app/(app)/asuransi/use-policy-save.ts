"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateInsuranceDto,
  FxInput,
  InsuranceDto,
  UpdateInsuranceDto,
} from "@wealthme/contracts";

export type PolicySaveDto = CreateInsuranceDto & { fxInputs?: FxInput[] };

/** POST (add) or PATCH (edit) a policy; closes the drawer on success. */
export function usePolicySave(
  familyGroupId: string,
  token: string | undefined,
  editing: InsuranceDto | null,
  onClose: () => void,
) {
  const { t } = useLocale();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (
      dto: PolicySaveDto | (UpdateInsuranceDto & { fxInputs?: FxInput[] }),
    ) =>
      editing
        ? apiFetch<InsuranceDto>(
            `/family-groups/${familyGroupId}/insurances/${editing.id}`,
            { method: "PATCH", token, body: JSON.stringify(dto) },
          )
        : apiFetch<InsuranceDto>(`/family-groups/${familyGroupId}/insurances`, {
            method: "POST",
            token,
            body: JSON.stringify(dto),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId),
      });
      toast.success(editing ? t.asuransi.toastUpdated : t.asuransi.toastAdded);
    },
  });

  const { isSuccess, isError, error } = mutation;
  useEffect(() => {
    if (isSuccess) onClose();
  }, [isSuccess, onClose]);
  useEffect(() => {
    if (isError) handleError(error);
  }, [isError, error, handleError]);

  return mutation;
}
