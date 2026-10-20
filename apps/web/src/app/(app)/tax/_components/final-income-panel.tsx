"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog, RowActions } from "@/components/crud";
import { formatNumber, formatRupiah } from "@/lib/format";
import { formatBps } from "@/components/tax/format-bps";
import { TaxRuleBadge } from "@/components/tax/tax-rule-badge";
import {
  useFinalIncomeMutations,
  useFinalTax,
} from "@/components/tax/use-tax-api";

import { extractApiErrorMessage } from "./api-error";
import {
  EMPTY_FINAL_INCOME_FORM,
  FinalIncomeDialog,
  type FinalIncomeFormValue,
} from "./final-income-dialog";

import type {
  CreateTaxFinalIncomeEntryDto,
  FinalTaxLineDto,
} from "@wealthme/contracts";

// Task 10 (sub-plan L) — the final-tax (investments + manual) table. Every
// number comes from `FinalTaxEstimateDto` (the shared BE engine); this
// panel only owns the add/edit/delete UI for the manual entries within it.
export function FinalIncomePanel({
  taxYear,
  canManage,
}: {
  taxYear: number;
  canManage: boolean;
}) {
  const { t } = useLocale();
  const {
    data: result,
    isPending: isResultPending,
    isError: isResultError,
  } = useFinalTax(taxYear);
  const { create, update, remove } = useFinalIncomeMutations(taxYear);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingLine, setEditingLine] = useState<FinalTaxLineDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FinalTaxLineDto | null>(
    null,
  );

  function openCreate() {
    setEditingLine(null);
    setDialogMode("create");
  }
  function openEdit(line: FinalTaxLineDto) {
    setEditingLine(line);
    setDialogMode("edit");
  }
  function closeDialog() {
    setDialogMode(null);
    setEditingLine(null);
  }

  function handleSubmit(dto: CreateTaxFinalIncomeEntryDto) {
    const onSettled = {
      onSuccess: () => {
        toast.success(t.tax.final.toastSaved);
        closeDialog();
      },
      onError: (err: unknown) =>
        toast.error(extractApiErrorMessage(err, t.tax.final.toastFailed)),
    };
    if (dialogMode === "edit" && editingLine?.entryId) {
      update.mutate({ entryId: editingLine.entryId, dto }, onSettled);
      return;
    }
    create.mutate(dto, onSettled);
  }

  function handleDelete() {
    if (!pendingDelete?.entryId) return;
    const entryId = pendingDelete.entryId;
    setPendingDelete(null);
    remove.mutate(entryId, {
      onSuccess: () => toast.success(t.tax.final.toastDeleted),
      onError: (err) =>
        toast.error(extractApiErrorMessage(err, t.tax.final.toastFailed)),
    });
  }

  const initial: FinalIncomeFormValue =
    dialogMode === "edit" && editingLine
      ? {
          instrument: editingLine.instrument,
          grossAmount: formatNumber(Number(editingLine.grossAmount)),
          occurredAt: editingLine.occurredAt ?? "",
          reinvested:
            editingLine.instrument === "dividen" &&
            editingLine.rateSource !== "missing",
          rateOverridePct:
            editingLine.rateSource === "override" &&
            editingLine.rateBps !== null
              ? String(editingLine.rateBps / 100).replace(".", ",")
              : "",
          notes: "",
        }
      : EMPTY_FINAL_INCOME_FORM;

  const lines = result?.lines ?? [];

  return (
    <div className="space-y-3.5">
      <div className="text-xs text-muted-foreground">
        {t.tax.final.subtitle}
      </div>

      {isResultError ? (
        <div className="notice notice--warning">
          {t.tax.final.loadFailedLabel}
        </div>
      ) : isResultPending ? (
        <div className="hint">{t.tax.final.loadingLabel}</div>
      ) : lines.length === 0 ? (
        <div className="notice notice--info">{t.tax.final.emptyStateNote}</div>
      ) : (
        <div className="table-wrap">
          <table className="table table--num wm-stack-table">
            <thead>
              <tr>
                <th></th>
                <th>{t.tax.final.fieldInstrument}</th>
                <th>{t.tax.final.fieldGross}</th>
                <th>{t.tax.ter.colRate}</th>
                <th>{t.tax.umkm.colTax}</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={
                    line.entryId ?? `${line.source}-${line.instrument}-${idx}`
                  }
                >
                  <td data-label="">
                    <span
                      className={`badge ${
                        line.source === "holding"
                          ? "badge--info"
                          : "badge--gray"
                      }`}
                    >
                      {line.source === "holding"
                        ? t.tax.final.sourceHolding
                        : t.tax.final.sourceEntry}
                    </span>
                  </td>
                  <td>
                    <div>{t.tax.final.instruments[line.instrument]}</div>
                    {line.label && (
                      <div className="text-[11px] text-muted-foreground">
                        {line.label}
                      </div>
                    )}
                  </td>
                  <td
                    data-label={t.tax.final.fieldGross}
                    className="wm-amount mono"
                  >
                    {formatRupiah(Number(line.grossAmount))}
                  </td>
                  <td data-label={t.tax.ter.colRate}>
                    {formatBps(line.rateBps)}
                  </td>
                  <td data-label={t.tax.umkm.colTax} className="mono">
                    {line.tax === null ? (
                      <>
                        <span>—</span>
                        <div className="text-[11px] text-warning">
                          {t.tax.final.missingRate}
                        </div>
                      </>
                    ) : (
                      formatRupiah(Number(line.tax))
                    )}
                  </td>
                  <td data-label="">
                    {line.caveat ? t.tax.final.caveats[line.caveat] : "—"}
                  </td>
                  <td data-label="">
                    <TaxRuleBadge rules={[line.rule]} />
                  </td>
                  <td data-label="">
                    {line.source === "entry" && canManage && line.entryId && (
                      <RowActions
                        onEdit={() => openEdit(line)}
                        onDelete={() => setPendingDelete(line)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!!result && (
        <div className="text-[13px] font-semibold">
          {t.tax.final.totalPrefix}{" "}
          <span className="mono text-primary">
            {formatRupiah(Number(result.totalTax))}
          </span>
        </div>
      )}
      {!!result && result.missingRateCount > 0 && (
        <div className="hint">
          {t.tax.final.missingRateNotice.replace(
            "{n}",
            String(result.missingRateCount),
          )}
        </div>
      )}
      {!!result && result.skippedForeign > 0 && (
        <div className="hint">
          {t.tax.final.skippedForeign.replace(
            "{n}",
            String(result.skippedForeign),
          )}
        </div>
      )}

      <Button
        onClick={openCreate}
        disabled={!canManage}
        className="h-auto px-4 py-2.5"
      >
        {t.tax.final.addEntry}
      </Button>

      {dialogMode && (
        <FinalIncomeDialog
          open
          mode={dialogMode}
          initial={initial}
          onClose={closeDialog}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
        />
      )}
      <ConfirmDeleteDialog
        label={
          pendingDelete
            ? t.tax.final.instruments[pendingDelete.instrument]
            : null
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
