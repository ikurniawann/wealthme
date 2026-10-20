"use client";

import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";

import type { I18nDictionary } from "@/i18n";
import type {
  CreateInsuranceBeneficiaryDto,
  MemberRelationship,
  Role,
} from "@wealthme/contracts";

// EPIC-021 Group D (#14) — mirrors the `FamilyMember` shape used on /akun for
export type FamilyMember = {
  id: string;
  userId: string;
  name: string;
  relationship: MemberRelationship | null;
  role: Role;
};

// EPIC-021 Group D (#14) — one beneficiary row bound to text inputs; parsed
export interface BeneficiaryFormRow {
  id: string;
  name: string;
  relationship: string;
  sharePercent: string;
  memberUserId: string;
}

let beneficiaryRowIdCounter = 0;

export function emptyBeneficiaryRow(): BeneficiaryFormRow {
  beneficiaryRowIdCounter += 1;
  return {
    id: `new-beneficiary-${beneficiaryRowIdCounter}`,
    name: "",
    relationship: "",
    sharePercent: "",
    memberUserId: "",
  };
}

function totalAllocated(rows: BeneficiaryFormRow[]): number {
  return rows.reduce((sum, r) => sum + (parseFloat(r.sharePercent) || 0), 0);
}

interface BeneficiaryEditorProps {
  rows: BeneficiaryFormRow[];
  onChange: (rows: BeneficiaryFormRow[]) => void;
  familyMembers: FamilyMember[];
  membersUnavailable?: boolean;
  /** polish-j batch 7a item 9 — the add-policy form wraps this in an
   * "Ahli waris (opsional)" disclosure, whose own summary already names
   * the section; suppress the inner heading there to avoid saying it
   * twice. Defaults to shown (standalone edit-policy usage). */
  showSectionTitle?: boolean;
}

/** Shared allocation-bar + row editor, mirroring warisan's heir editor UX. */
export function BeneficiaryEditor({
  rows,
  onChange,
  familyMembers,
  membersUnavailable,
  showSectionTitle = true,
}: BeneficiaryEditorProps) {
  const { t } = useLocale();
  const allocated = Math.min(100, totalAllocated(rows));
  const unallocated = Math.max(0, 100 - totalAllocated(rows));

  function updateRow(id: string, patch: Partial<BeneficiaryFormRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      {showSectionTitle && (
        <div className="section-title mt-[18px] mb-2 text-[14px]">
          {t.asuransi.beneficiariesSectionTitle}
        </div>
      )}
      <div className="space-y-2.5">
        {rows.map((row) => {
          const linkedMember = row.memberUserId
            ? familyMembers.find((m) => m.userId === row.memberUserId)
            : undefined;
          return (
            <div key={row.id} className="rounded-md border bg-background p-3">
              <div className="row row--between mb-1.5">
                <span className="label m-0">
                  {t.asuransi.beneficiaryMemberLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${t.asuransi.removeBeneficiaryAriaLabel} ${
                    linkedMember ? linkedMember.name : row.name
                  }`.trim()}
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                >
                  <X className="size-[15px]" />
                </Button>
              </div>
              {familyMembers.length > 0 ? (
                <select
                  value={row.memberUserId}
                  onChange={(e) => {
                    const memberUserId = e.target.value;
                    const picked = familyMembers.find(
                      (m) => m.userId === memberUserId,
                    );
                    updateRow(row.id, {
                      memberUserId,
                      ...(picked
                        ? {
                            name: picked.name,
                            relationship:
                              picked.relationship ??
                              (picked.role === "owner"
                                ? t.asuransi.beneficiaryRelationshipSelfDefault
                                : ""),
                          }
                        : {}),
                    });
                  }}
                  className="select"
                  aria-label={t.asuransi.beneficiaryMemberLabel}
                >
                  <option value="">
                    {t.asuransi.beneficiaryMemberNoneOption}
                  </option>
                  {familyMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                membersUnavailable && (
                  <p className="hint">
                    {t.asuransi.beneficiaryMemberPickerUnavailable}
                  </p>
                )
              )}

              <div className="wm-form__grid">
                <div className="field mt-0">
                  <label
                    className="label"
                    htmlFor={`beneficiary-name-${row.id}`}
                  >
                    {t.asuransi.beneficiaryNameLabel}
                  </label>
                  <input
                    id={`beneficiary-name-${row.id}`}
                    type="text"
                    value={linkedMember ? linkedMember.name : row.name}
                    disabled={!!linkedMember}
                    onChange={(e) =>
                      updateRow(row.id, { name: e.target.value })
                    }
                    placeholder={t.asuransi.beneficiaryNamePlaceholder}
                    className="input disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div className="field mt-0">
                  <label
                    className="label"
                    htmlFor={`beneficiary-relationship-${row.id}`}
                  >
                    {t.asuransi.beneficiaryRelationshipLabel}
                  </label>
                  <input
                    id={`beneficiary-relationship-${row.id}`}
                    type="text"
                    value={
                      linkedMember?.relationship
                        ? linkedMember.relationship
                        : row.relationship
                    }
                    disabled={!!linkedMember?.relationship}
                    onChange={(e) =>
                      updateRow(row.id, { relationship: e.target.value })
                    }
                    placeholder={t.asuransi.beneficiaryRelationshipPlaceholder}
                    className="input disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="field">
                <label
                  className="label"
                  htmlFor={`beneficiary-share-${row.id}`}
                >
                  {t.asuransi.beneficiarySharePercentLabel}
                </label>
                <input
                  id={`beneficiary-share-${row.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={row.sharePercent}
                  onChange={(e) =>
                    updateRow(row.id, { sharePercent: e.target.value })
                  }
                  placeholder={t.asuransi.beneficiarySharePercentLabel}
                  className="input mono"
                />
                {totalAllocated(rows) > 100 && (
                  <span className="error-text">
                    {t.asuransi.validationSharePercentExceeded}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, emptyBeneficiaryRow()])}
        className="btn--block mt-2.5"
      >
        <Plus className="size-[15px]" /> {t.asuransi.addBeneficiaryButton}
      </Button>

      {rows.length > 0 && (
        <>
          <div className="notice mt-3">
            <span>
              {unallocated <= 0
                ? t.asuransi.allocationFullyAllocated
                : `${allocated}${t.asuransi.allocationAllocatedSuffix} · ${unallocated}${t.asuransi.allocationUnallocatedSuffix}`}
            </span>
          </div>
          <div className="progress mt-2">
            <div
              className="progress__bar"
              style={{
                transform: `scaleX(${Math.min(100, Math.max(0, allocated)) / 100})`,
                background:
                  unallocated <= 0 ? "var(--success)" : "var(--warning)",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * EPIC-022 D6 — validates the rows and maps them to DTOs. A share with a
 * blank name blocks the save, as does > 100%; under-allocation only warns
 * (the remainder may go to the estate). Returns null when the save must stop.
 */
export function toBeneficiaryDtos(
  rows: BeneficiaryFormRow[],
  copy: I18nDictionary["asuransi"],
): CreateInsuranceBeneficiaryDto[] | null {
  const blankNamedWithShare = rows.find(
    (b) => !b.name.trim() && (parseFloat(b.sharePercent) || 0) > 0,
  );
  if (blankNamedWithShare) {
    toast.warning(copy.validationBeneficiaryNameRequired);
    return null;
  }
  const dtos: CreateInsuranceBeneficiaryDto[] = rows
    .filter((b) => b.name.trim())
    .map((b) => ({
      name: b.name.trim(),
      relationship: b.relationship.trim(),
      sharePercent: parseFloat(b.sharePercent) || 0,
      ...(b.memberUserId && { memberUserId: b.memberUserId }),
    }));
  const total = dtos.reduce((sum, b) => sum + b.sharePercent, 0);
  if (total > 100) {
    toast.warning(copy.validationSharePercentExceeded);
    return null;
  }
  if (dtos.length > 0 && total < 100) {
    toast.warning(
      copy.validationShareUnderAllocated.replace("{pct}", String(total)),
    );
  }
  return dtos;
}
