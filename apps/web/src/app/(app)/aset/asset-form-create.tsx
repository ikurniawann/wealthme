"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ASSET_CREATE_VALUATION_SOURCES,
  type AssetCreateValuationSource,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { DateField } from "@/components/wm";
import {
  MoneyInput,
  moneyDigits,
  useMoneyField,
  type MoneyField,
} from "@/components/money";

/** Today (yyyy-mm-dd) in WIB (UTC+7, no DST), as the API judges "future". */
function wibToday(): string {
  return new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
}

/**
 * Aset fields (2026-10-20) — create-only inputs of "Tambah aset": Pemilik,
 * Harga perolehan (its own currency, converted server-side like the value),
 * and the opening valuation's date and source. Edit never shows them: owner
 * and cost are history (the opening transaction), not identity fields.
 */
export function useCreateFields(familyGroupId: string, active: boolean) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { access } = useMyAccess();
  // A row-scoped member records only for themselves (the API pins it).
  const ownOnly = access?.dataScope === "own";
  const [owner, setOwner] = useState("");
  const cost = useMoneyField({ initialRaw: "", isEdit: false });
  const [valuationDate, setValuationDate] = useState("");
  const [source, setSource] = useState<AssetCreateValuationSource>("manual");
  const members = useQuery<{ userId: string; name: string }[]>({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId), token],
    queryFn: () =>
      apiFetch<{ userId: string; name: string }[]>(
        `/family-groups/${familyGroupId}/members`,
        { token },
      ),
    enabled: active && !ownOnly && Boolean(token && familyGroupId),
    retry: false,
  });
  return {
    ownOnly,
    members: members.data ?? null,
    owner,
    setOwner,
    cost,
    costDigits: moneyDigits(cost),
    valuationDate,
    setValuationDate,
    source,
    setSource,
  };
}

export type CreateFields = ReturnType<typeof useCreateFields>;

/** The create body's new keys; `null` error = valid. */
export function createExtras(
  s: CreateFields,
  acquisitionDate: string,
): {
  body: {
    ownerUserId?: string | null;
    acquisitionCost?: string;
    valuationDate?: string;
    valuationSource?: AssetCreateValuationSource;
  };
  dateError: boolean;
} {
  const dateError =
    !!s.valuationDate && !!acquisitionDate && s.valuationDate < acquisitionDate;
  return {
    body: {
      ...(s.ownOnly || !s.members ? {} : { ownerUserId: s.owner || null }),
      ...(s.costDigits ? { acquisitionCost: s.costDigits } : {}),
      ...(s.valuationDate ? { valuationDate: s.valuationDate } : {}),
      valuationSource: s.source,
    },
    dateError,
  };
}

/** Pemilik: a family member or Bersama. Hidden when members can't be listed. */
export function OwnerField({ s }: { s: CreateFields }) {
  const { t } = useLocale();
  const c = t.aset.v3.form.create;
  if (s.ownOnly) {
    return (
      <div className="field">
        <span className="label">{c.owner}</span>
        <span className="hint">{c.ownerSelf}</span>
      </div>
    );
  }
  if (!s.members) return null;
  return (
    <div className="field">
      <label className="label" htmlFor="asset-owner">
        {c.owner}
      </label>
      <select
        id="asset-owner"
        className="select"
        value={s.owner}
        onChange={(e) => s.setOwner(e.target.value)}
      >
        <option value="">{c.ownerShared}</option>
        {s.members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CostField({ field }: { field: MoneyField }) {
  const { t } = useLocale();
  const c = t.aset.v3.form.create;
  return (
    <div className="field">
      <label className="label" htmlFor="asset-cost">
        {c.cost}
      </label>
      <MoneyInput
        field={field}
        id="asset-cost"
        placeholder={t.aset.fieldValuePlaceholder}
        ariaDescribedBy="asset-cost-hint"
      />
      <span className="hint" id="asset-cost-hint">
        {c.costHint}
      </span>
    </div>
  );
}

/** Opening valuation date (floating, date-only) and its source. */
export function ValuationMetaFields({
  s,
  acquisitionDate,
  dateError,
}: {
  s: CreateFields;
  acquisitionDate: string;
  dateError: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.aset.v3.form.create;
  return (
    <div className="as4f-pair">
      <div className="field">
        <label className="label" htmlFor="asset-valuation-date">
          {c.valuationDate}
        </label>
        <DateField
          id="asset-valuation-date"
          value={s.valuationDate}
          locale={locale}
          label={c.valuationDate}
          min={acquisitionDate || undefined}
          max={wibToday()}
          onChange={s.setValuationDate}
        />
        {dateError ? (
          <p className="error-text" role="alert">
            {c.valuationDateBeforeAcq}
          </p>
        ) : (
          <span className="hint">{c.valuationDateHint}</span>
        )}
      </div>
      <div className="field">
        <label className="label" htmlFor="asset-valuation-source">
          {c.valuationSource}
        </label>
        <select
          id="asset-valuation-source"
          className="select"
          value={s.source}
          onChange={(e) =>
            s.setSource(e.target.value as AssetCreateValuationSource)
          }
        >
          {ASSET_CREATE_VALUATION_SOURCES.map((k) => (
            <option key={k} value={k}>
              {c.sources[k]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
