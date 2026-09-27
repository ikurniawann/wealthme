import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  return (
    <>
      {/* Investment Add/Edit Dialog */}
      <Dialog
        open={showAddInv || editingInv !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddInv(false);
            setEditingInv(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingInv
                ? t.investasi.modalTitleEdit
                : t.investasi.modalTitleAdd}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              void handleInvSubmit(e);
            }}
            className="space-y-3"
          >
            {(["ticker", "name"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-[12px] text-muted-foreground capitalize">
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
                  className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-[12px] text-muted-foreground">
                {t.investasi.fieldTypeLabel}
              </label>
              <select
                value={invForm.type}
                onChange={(e) =>
                  setInvForm((f) => ({
                    ...f,
                    type: e.target.value as InvestmentType,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
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
            <div className="space-y-1">
              <label className="text-[12px] text-muted-foreground">
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
                className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-[12px] text-muted-foreground"
                htmlFor="laporan-cost-basis"
              >
                {t.investasi.fieldCostBasisLabel}
              </label>
              <MoneyInput
                field={costBasisField}
                id="laporan-cost-basis"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={invSubmitting} className="w-full">
                {invSubmitting ? t.investasi.saving : t.investasi.saveButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
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
