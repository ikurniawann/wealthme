"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/hooks/use-locale";
import { X } from "lucide-react";
import { PillButton } from "@/components/wm";
import {
  Dialog,
  DialogClose,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { formatNumber, parseRupiah } from "@/lib/format";

import { MAX_TAX_INPUT, toClampedDigitString } from "./digits";

import type {
  CreateTaxFinalIncomeEntryDto,
  TaxFinalInstrument,
} from "@wealthme/contracts";

// Task 10 (sub-plan L) — only the instruments a user records by hand;
// saham_idx/reksa_dana/kripto_* are automatic-only (derived from the
// portfolio, never a manual final-income entry).
const MANUAL_INSTRUMENTS: TaxFinalInstrument[] = [
  "dividen",
  "bunga_tabungan",
  "sewa",
  "p2p",
  "emas",
  "kupon_sbn",
  "bunga_deposito",
];
const NOTES_MAX = 200;
// Instruments whose rate rule carries no fixed rate — the hint says a rate
// is required, but the server accepts an empty override and shows "—".
const NO_FIXED_RATE: readonly TaxFinalInstrument[] = ["emas", "p2p"];

export interface FinalIncomeFormValue {
  instrument: TaxFinalInstrument;
  grossAmount: string;
  /** `YYYY-MM-DD`, or "" for unset. */
  occurredAt: string;
  reinvested: boolean;
  /** Percent as typed, e.g. "15" or "15,5"; "" for unset. */
  rateOverridePct: string;
  notes: string;
}

export const EMPTY_FINAL_INCOME_FORM: FinalIncomeFormValue = {
  instrument: "dividen",
  grossAmount: "",
  occurredAt: "",
  reinvested: false,
  rateOverridePct: "",
  notes: "",
};

/** 0–100 with up to two decimals ("0,5", "10", "100"). */
const PERCENT_PATTERN = "^(100([.,]0{1,2})?|\\d{1,2}([.,]\\d{1,2})?)$";

export function FinalIncomeDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: FinalIncomeFormValue;
  onClose: () => void;
  onSubmit: (dto: CreateTaxFinalIncomeEntryDto) => void;
  submitting: boolean;
}) {
  const { t } = useLocale();
  const [instrument, setInstrument] = useState(initial.instrument);
  const [gross, setGross] = useState(initial.grossAmount);
  const [date, setDate] = useState(initial.occurredAt);
  const [reinvested, setReinvested] = useState(initial.reinvested);
  const [rateOverridePct, setRateOverridePct] = useState(
    initial.rateOverridePct,
  );
  const [notes, setNotes] = useState(initial.notes);

  // Re-seed from `initial` every time the dialog opens (covers both a fresh
  // "add" and re-opening for a different row to edit) — syncing local form
  // state from a caller-controlled prop (an external source), not deriving
  // it from other state in this component.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstrument(initial.instrument);
    setGross(initial.grossAmount);
    setDate(initial.occurredAt);
    setReinvested(initial.reinvested);
    setRateOverridePct(initial.rateOverridePct);
    setNotes(initial.notes);
  }, [open, initial]);

  function handleInstrumentChange(next: TaxFinalInstrument) {
    setInstrument(next);
    if (next !== "dividen") setReinvested(false);
  }

  function handleSubmit() {
    const dto: CreateTaxFinalIncomeEntryDto = {
      instrument,
      grossAmount: toClampedDigitString(gross, MAX_TAX_INPUT),
      occurredAt: date,
      reinvested: instrument === "dividen" ? reinvested : false,
      rateBpsOverride:
        rateOverridePct.trim() === ""
          ? null
          : Math.round(Number(rateOverridePct.replace(",", ".")) * 100),
      notes: notes.trim() === "" ? null : notes.trim(),
    };
    onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {mode === "edit" ? t.tax.final.editEntry : t.tax.final.addEntry}
            </DialogTitle>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
              <div className="field">
                <label htmlFor="final-instrument" className="label">
                  {t.tax.final.fieldInstrument}
                </label>
                <select
                  id="final-instrument"
                  className="select"
                  value={instrument}
                  onChange={(e) =>
                    handleInstrumentChange(e.target.value as TaxFinalInstrument)
                  }
                >
                  {MANUAL_INSTRUMENTS.map((i) => (
                    <option key={i} value={i}>
                      {t.tax.final.instruments[i]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="final-gross" className="label">
                  {t.tax.final.fieldGross}
                </label>
                <input
                  id="final-gross"
                  type="text"
                  inputMode="numeric"
                  required
                  className="input"
                  value={gross}
                  onChange={(e) =>
                    setGross(
                      e.target.value === ""
                        ? ""
                        : formatNumber(
                            Math.min(
                              parseRupiah(e.target.value),
                              MAX_TAX_INPUT,
                            ),
                          ),
                    )
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="final-date" className="label">
                  {t.tax.final.fieldDate}
                </label>
                <input
                  id="final-date"
                  type="date"
                  required
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {instrument === "dividen" && (
                <div className="field flex items-center gap-2">
                  <input
                    id="final-reinvested"
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={reinvested}
                    onChange={(e) => setReinvested(e.target.checked)}
                  />
                  <label htmlFor="final-reinvested" className="text-[13px]">
                    {t.tax.final.fieldReinvested}
                  </label>
                </div>
              )}
              <div className="field">
                <label htmlFor="final-rate-override" className="label">
                  {t.tax.final.fieldRateOverride}
                </label>
                <input
                  id="final-rate-override"
                  type="text"
                  inputMode="decimal"
                  className="input"
                  pattern={PERCENT_PATTERN}
                  title={t.common.percentRangeError}
                  value={rateOverridePct}
                  onChange={(e) =>
                    setRateOverridePct(e.target.value.replace(/[^0-9,.]/g, ""))
                  }
                />
                {NO_FIXED_RATE.includes(instrument) && (
                  <div className="hint">{t.tax.final.missingRate}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="final-notes" className="label">
                  {t.tax.final.fieldNotes}
                </label>
                <input
                  id="final-notes"
                  type="text"
                  className="input"
                  maxLength={NOTES_MAX}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton type="submit" variant="primary" disabled={submitting}>
              {t.common.save}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}
