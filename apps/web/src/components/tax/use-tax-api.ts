"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/auth-compat";

import { taxKeys } from "./tax-query-keys";

import type {
  CreateTaxFinalIncomeEntryDto,
  CryptoExchangeKind,
  FinalTaxEstimateDto,
  PphOpPreviewRequestDto,
  PphOpResultDto,
  PpnPreviewRequestDto,
  PpnPreviewResultDto,
  TaxAnnualSummaryDto,
  TaxFinalIncomeEntryDto,
  TaxRuleDetailDto,
  TerPreviewRequestDto,
  TerPreviewResultDto,
  UmkmPreviewRequestDto,
  UmkmResultDto,
  UpdateTaxFinalIncomeEntryDto,
} from "@wealthme/contracts";

/** The session's token + family group, the same source every tax hook reads from. */
export function useTaxSession(): {
  token: string | undefined;
  fgId: string | null;
} {
  const { data: session } = useSession();
  return {
    token: session?.accessToken,
    fgId: session?.familyGroupId ?? null,
  };
}

export function usePphOpPreview(req: PphOpPreviewRequestDto | null) {
  const { token, fgId } = useTaxSession();
  return useQuery<PphOpResultDto>({
    queryKey: taxKeys.pphOpPreview(fgId ?? "", req),
    queryFn: () =>
      apiFetch<PphOpResultDto>(`/family-groups/${fgId}/tax/pph-op/preview`, {
        method: "POST",
        token,
        body: JSON.stringify(req),
      }),
    enabled: !!token && !!fgId && req !== null,
    placeholderData: keepPreviousData,
  });
}

export function useTerPreview(req: TerPreviewRequestDto | null) {
  const { token, fgId } = useTaxSession();
  return useQuery<TerPreviewResultDto>({
    queryKey: taxKeys.terPreview(fgId ?? "", req),
    queryFn: () =>
      apiFetch<TerPreviewResultDto>(`/family-groups/${fgId}/tax/ter/preview`, {
        method: "POST",
        token,
        body: JSON.stringify(req),
      }),
    enabled: !!token && !!fgId && req !== null,
    placeholderData: keepPreviousData,
  });
}

export function useUmkmPreview(req: UmkmPreviewRequestDto | null) {
  const { token, fgId } = useTaxSession();
  return useQuery<UmkmResultDto>({
    queryKey: taxKeys.umkmPreview(fgId ?? "", req),
    queryFn: () =>
      apiFetch<UmkmResultDto>(`/family-groups/${fgId}/tax/umkm/preview`, {
        method: "POST",
        token,
        body: JSON.stringify(req),
      }),
    enabled: !!token && !!fgId && req !== null,
    placeholderData: keepPreviousData,
  });
}

export function useUmkmYear(year: number) {
  const { token, fgId } = useTaxSession();
  return useQuery<UmkmResultDto | null>({
    queryKey: taxKeys.umkmYear(fgId ?? "", year),
    queryFn: () =>
      apiFetch<UmkmResultDto | null>(
        `/family-groups/${fgId}/tax/umkm/${year}`,
        {
          token,
        },
      ),
    enabled: !!token && !!fgId,
  });
}

export function useSaveUmkmYear() {
  const { token, fgId } = useTaxSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, dto }: { year: number; dto: UmkmPreviewRequestDto }) =>
      apiFetch<UmkmResultDto>(`/family-groups/${fgId}/tax/umkm/${year}`, {
        method: "PUT",
        token,
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      if (fgId)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tax.list(fgId),
        });
    },
  });
}

export function useFinalTax(year: number) {
  const { token, fgId } = useTaxSession();
  return useQuery<FinalTaxEstimateDto>({
    queryKey: taxKeys.finalTax(fgId ?? "", year),
    queryFn: () =>
      apiFetch<FinalTaxEstimateDto>(
        `/family-groups/${fgId}/tax/final-tax?year=${year}`,
        { token },
      ),
    enabled: !!token && !!fgId,
  });
}

export function useFinalIncome(year: number) {
  const { token, fgId } = useTaxSession();
  return useQuery<TaxFinalIncomeEntryDto[]>({
    queryKey: taxKeys.finalIncome(fgId ?? "", year),
    queryFn: () =>
      apiFetch<TaxFinalIncomeEntryDto[]>(
        `/family-groups/${fgId}/tax/final-income?year=${year}`,
        { token },
      ),
    enabled: !!token && !!fgId,
  });
}

export function useFinalIncomeMutations(year: number) {
  const { token, fgId } = useTaxSession();
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (fgId)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tax.list(fgId),
      });
  };
  const create = useMutation({
    mutationFn: (dto: CreateTaxFinalIncomeEntryDto) =>
      apiFetch<TaxFinalIncomeEntryDto>(
        `/family-groups/${fgId}/tax/final-income`,
        { method: "POST", token, body: JSON.stringify(dto) },
      ),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      entryId,
      dto,
    }: {
      entryId: string;
      dto: UpdateTaxFinalIncomeEntryDto;
    }) =>
      apiFetch<TaxFinalIncomeEntryDto>(
        `/family-groups/${fgId}/tax/final-income/${entryId}`,
        { method: "PATCH", token, body: JSON.stringify(dto) },
      ),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (entryId: string) =>
      apiFetch<void>(`/family-groups/${fgId}/tax/final-income/${entryId}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: invalidate,
  });
  // `year` only scopes the invalidated/read queries above; it plays no part
  // in the mutation URLs themselves (entryId already identifies the row).
  void year;
  return { create, update, remove };
}

export function useInvestmentTaxEstimate(year: number) {
  const { token, fgId } = useTaxSession();
  return useQuery<FinalTaxEstimateDto>({
    queryKey: taxKeys.investmentTax(fgId ?? "", year),
    queryFn: () =>
      apiFetch<FinalTaxEstimateDto>(
        `/family-groups/${fgId}/investment-tax/estimate?year=${year}`,
        { token },
      ),
    enabled: !!token && !!fgId,
  });
}

export function useSetCryptoExchange(year: number) {
  const { token, fgId } = useTaxSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      investmentId,
      cryptoExchange,
    }: {
      investmentId: string;
      cryptoExchange: CryptoExchangeKind | null;
    }) =>
      apiFetch<{
        investmentId: string;
        cryptoExchange: CryptoExchangeKind | null;
      }>(`/family-groups/${fgId}/investment-tax/${investmentId}/profile`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ cryptoExchange }),
      }),
    onSuccess: () => {
      if (fgId) {
        void queryClient.invalidateQueries({
          queryKey: taxKeys.investmentTax(fgId, year),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tax.list(fgId),
        });
      }
    },
  });
}

export function useTaxSummary(year: number) {
  const { token, fgId } = useTaxSession();
  return useQuery<TaxAnnualSummaryDto>({
    queryKey: taxKeys.summary(fgId ?? "", year),
    queryFn: () =>
      apiFetch<TaxAnnualSummaryDto>(
        `/family-groups/${fgId}/tax/summary?year=${year}`,
        { token },
      ),
    enabled: !!token && !!fgId,
  });
}

export function useTaxRules(keys: string[], date?: string) {
  return useQuery<TaxRuleDetailDto[]>({
    queryKey: taxKeys.rules(date ?? "", keys),
    queryFn: () => {
      const params = new URLSearchParams({ keys: keys.join(",") });
      if (date) params.set("date", date);
      return apiFetch<TaxRuleDetailDto[]>(
        `/calculators/tax-rules?${params.toString()}`,
      );
    },
    enabled: true,
  });
}

export function usePpnPreview(req: PpnPreviewRequestDto | null) {
  return useQuery<PpnPreviewResultDto>({
    queryKey: taxKeys.ppn(req),
    queryFn: () =>
      apiFetch<PpnPreviewResultDto>("/calculators/ppn", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    enabled: req !== null,
    placeholderData: keepPreviousData,
  });
}
