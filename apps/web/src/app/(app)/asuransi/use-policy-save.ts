"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

import {
  canonical,
  cashHasStatement,
  fundHasStatement,
  type CashValueRow,
  type FundRow,
} from "./policy-form-model";

import type {
  CreateInsuranceDto,
  CreateInsuranceValuationDto,
  FxInput,
  InsuranceDocumentDto,
  InsuranceDto,
  InsuranceFundDto,
  InsuranceValuationDto,
  UpdateInsuranceDto,
} from "@wealthme/contracts";

export type PolicySaveDto = CreateInsuranceDto & { fxInputs?: FxInput[] };

export type PolicySaveInput = {
  dto: PolicySaveDto | (UpdateInsuranceDto & { fxInputs?: FxInput[] });
  /** unit_link only: sub-fund lines (identity + optional new statement). */
  funds: FundRow[];
  /** traditional only: a policy-level cash value statement. */
  cash: CashValueRow | null;
  /** The report the AI read: stored with the policy on save and cited by
   *  report-sourced rows (never uploaded before the user saves). */
  documentFile: File | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Saves the policy (POST add / PATCH edit), then its sub-funds and any new
 * value statements. Every step is remembered across retries: a policy that
 * was already created is PATCHed (never created twice), created funds keep
 * their id and a statement that was stored is not stored again. Value
 * statements never create cash transactions (S6); units × NAV is computed by
 * the API with Decimal.
 */
export function usePolicySave(
  familyGroupId: string,
  token: string | undefined,
  editing: InsuranceDto | null,
) {
  const queryClient = useQueryClient();
  const savedPolicyId = useRef<string | null>(editing?.id ?? null);
  const fundIds = useRef(new Map<string, string>());
  const savedStatements = useRef(new Set<string>());
  const uploadedDoc = useRef<{ file: File; id: string } | null>(null);
  const base = `/family-groups/${familyGroupId}/insurances`;

  async function saveFund(policyId: string, f: FundRow): Promise<string> {
    const known = f.fundId ?? fundIds.current.get(f.rowId);
    const body = {
      name: f.name.trim(),
      ...(f.code.trim() && { code: f.code.trim() }),
    };
    if (known) {
      if (
        f.fundId &&
        (f.name.trim() !== f.initialName || f.code.trim() !== f.initialCode)
      ) {
        await apiFetch<InsuranceFundDto>(`${base}/${policyId}/funds/${known}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        });
      }
      return known;
    }
    const created = await apiFetch<InsuranceFundDto>(
      `${base}/${policyId}/funds`,
      {
        method: "POST",
        token,
        body: JSON.stringify({ ...body, currency: f.currency }),
      },
    );
    fundIds.current.set(f.rowId, created.id);
    return created.id;
  }

  async function saveStatement(
    policyId: string,
    key: string,
    body: CreateInsuranceValuationDto,
    confirmed: boolean,
  ): Promise<void> {
    if (savedStatements.current.has(key)) return;
    const row = await apiFetch<InsuranceValuationDto>(
      `${base}/${policyId}/valuations`,
      { method: "POST", token, body: JSON.stringify(body) },
    );
    // A report-sourced row always starts as needs_confirmation (S5/S8);
    // the user's explicit tick confirms it in a second, separate call.
    if (confirmed && row.status !== "confirmed") {
      await apiFetch<InsuranceValuationDto>(
        `${base}/${policyId}/valuations/${row.id}/confirm`,
        { method: "POST", token },
      );
    }
    savedStatements.current.add(key);
  }

  async function uploadDocument(policyId: string, file: File): Promise<string> {
    if (uploadedDoc.current?.file === file) return uploadedDoc.current.id;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}${base}/${policyId}/documents`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw { status: res.status, message: body.message ?? res.statusText };
    }
    const doc = (await res.json()) as InsuranceDocumentDto;
    uploadedDoc.current = { file, id: doc.id };
    return doc.id;
  }

  const mutation = useMutation({
    mutationFn: async ({ dto, funds, cash, documentFile }: PolicySaveInput) => {
      const policy = savedPolicyId.current
        ? await apiFetch<InsuranceDto>(`${base}/${savedPolicyId.current}`, {
            method: "PATCH",
            token,
            body: JSON.stringify(dto),
          })
        : await apiFetch<InsuranceDto>(base, {
            method: "POST",
            token,
            body: JSON.stringify(dto),
          });
      savedPolicyId.current = policy.id;
      const documentId = documentFile
        ? await uploadDocument(policy.id, documentFile)
        : null;

      for (const f of funds) {
        const fundId = await saveFund(policy.id, f);
        if (!fundHasStatement(f)) continue;
        const fromReport = f.page !== null;
        await saveStatement(
          policy.id,
          `fund-${f.rowId}`,
          {
            fundId,
            units: canonical(f.units) ?? undefined,
            navPerUnit: canonical(f.nav) ?? undefined,
            navDate: f.navDate,
            unitsDate: f.unitsDate || f.navDate,
            effectiveDate: f.navDate,
            source: fromReport ? "report" : "manual",
            ...(fromReport && f.page && { page: f.page }),
            ...(fromReport && f.snippet && { snippet: f.snippet }),
            ...(fromReport && documentId && { documentId }),
            ...(!fromReport && {
              status: f.confirmed ? "confirmed" : "needs_confirmation",
            }),
          } as CreateInsuranceValuationDto,
          f.confirmed,
        );
      }
      if (cash && cashHasStatement(cash)) {
        await saveStatement(
          policy.id,
          "cash",
          {
            cashValue: canonical(cash.cashValue) ?? undefined,
            surrenderEstimate: canonical(cash.surrenderEstimate) ?? undefined,
            maturityBenefit: canonical(cash.maturityBenefit) ?? undefined,
            guaranteed: cash.guaranteed,
            effectiveDate: cash.effectiveDate,
            source: "manual",
            status: cash.confirmed ? "confirmed" : "needs_confirmation",
          } as CreateInsuranceValuationDto,
          cash.confirmed,
        );
      }
      return policy;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["insurances", familyGroupId],
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return {
    mutation,
    /** Set once the policy exists (an add that failed later becomes an edit). */
    savedPolicyId: () => savedPolicyId.current,
  };
}
