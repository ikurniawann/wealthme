import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/wm";
import { X } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { MoneyInput } from "@/components/money";
import type { MoneyField } from "@/components/money";
import type { InvestmentDto, InvestmentType } from "@wealthme/contracts";

type InvestmentFormState = {
  ticker: string;
  name: string;
  type: InvestmentType;
  quantity: string;
  costBasisPerUnit: string;
};

/**
 * EPIC-026 file-split — the Ringkasan/Investasi investment Add/Edit and
 * Delete dialogs, extracted verbatim from `LaporanInner`'s return JSX so
 * that file stays under the size convention. All state (`invForm`,
 * `showAddInv`, etc.) is still owned by `LaporanInner` — this component is
 * purely presentational, receiving the same setters/handlers it always
 * called inline.
 */
export function InvestmentDialogs({
  showAddInv,
  editingInv,
  deletingInv,
  invForm,
  costBasisField,
  invSubmitting,
  setShowAddInv,
  setEditingInv,
  setDeletingInv,
  setInvForm,
  handleInvSubmit,
  handleInvDelete,
}: {
  showAddInv: boolean;
  editingInv: InvestmentDto | null;
  deletingInv: InvestmentDto | null;
  invForm: InvestmentFormState;
  costBasisField: MoneyField;
  invSubmitting: boolean;
  setShowAddInv: Dispatch<SetStateAction<boolean>>;
  setEditingInv: Dispatch<SetStateAction<InvestmentDto | null>>;
  setDeletingInv: Dispatch<SetStateAction<InvestmentDto | null>>;
  setInvForm: Dispatch<SetStateAction<InvestmentFormState>>;
  handleInvSubmit: (e: React.FormEvent) => Promise<void>;
  handleInvDelete: () => Promise<void>;
}) {
  const { t } = useLocale();

  const closeInv = () => {
    setShowAddInv(false);
    setEditingInv(null);
  };

  return (
    <>
      {/* Investment Add/Edit Dialog */}
      <Dialog
        open={showAddInv || editingInv !== null}
        onOpenChange={(open) => {
          if (!open) closeInv();
        }}
      >
        <PanelContent variant="side" className="wm-form-panel">
          <header className="wm-panel-head">
            <div className="min-w-0">
              <DialogTitle className="wm-panel-title">
                {editingInv
                  ? t.investasi.modalTitleEdit
                  : t.investasi.modalTitleAdd}
              </DialogTitle>
            </div>
            <DialogClose className="wm-panel-x" aria-label={t.common.close}>
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <form
            onSubmit={(e) => {
              void handleInvSubmit(e);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="wm-panel-body wm-form">
              <div className="wm-form__grid">
                {(["ticker", "name"] as const).map((field) => (
                  <div key={field} className="field">
                    <label className="label">
                      {field === "ticker"
                        ? t.investasi.fieldTickerLabel
                        : t.investasi.fieldNameLabel}
                    </label>
                    <input
                      required
                      value={invForm[field]}
                      onChange={(e) =>
                        setInvForm((f) => ({ ...f, [field]: e.target.value }))
                      }
                      placeholder={
                        field === "ticker"
                          ? t.investasi.fieldTickerPlaceholder
                          : t.investasi.fieldNamePlaceholder
                      }
                      className="input"
                    />
                  </div>
                ))}
                <div className="field">
                  <label className="label">{t.investasi.fieldTypeLabel}</label>
                  <select
                    value={invForm.type}
                    onChange={(e) =>
                      setInvForm((f) => ({
                        ...f,
                        type: e.target.value as InvestmentType,
                      }))
                    }
                    className="select"
                  >
                    {(
                      [
                        "saham",
                        "reksa_dana",
                        "obligasi",
                        "emas",
                        "kripto",
                        "lainnya",
                      ] as InvestmentType[]
                    ).map((typeOption) => (
                      <option key={typeOption} value={typeOption}>
                        {typeOption.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">
                    {t.investasi.fieldQuantityLabel}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    required
                    min="0"
                    step="any"
                    value={invForm.quantity}
                    onChange={(e) =>
                      setInvForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    className="input"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="laporan-cost-basis">
                    {t.investasi.fieldCostBasisLabel}
                  </label>
                  <MoneyInput
                    field={costBasisField}
                    id="laporan-cost-basis"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="wm-panel-foot">
              <PillButton type="button" onClick={closeInv}>
                {t.common.cancel}
              </PillButton>
              <PillButton
                type="submit"
                variant="primary"
                disabled={invSubmitting}
              >
                {invSubmitting ? t.investasi.saving : t.investasi.saveButton}
              </PillButton>
            </div>
          </form>
        </PanelContent>
      </Dialog>

      {/* Investment Delete Confirm Dialog */}
      <Dialog
        open={deletingInv !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingInv(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.laporan.investasi.deleteDialogTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            {t.laporan.investasi.deleteConfirmPrefix}{" "}
            <span className="font-semibold text-foreground">
              {deletingInv?.ticker} · {deletingInv?.name}
            </span>
            {t.laporan.investasi.deleteConfirmSuffix}
          </p>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingInv(null)}
              disabled={invSubmitting}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleInvDelete();
              }}
              disabled={invSubmitting}
            >
              {invSubmitting
                ? t.laporan.investasi.deletingLabel
                : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
