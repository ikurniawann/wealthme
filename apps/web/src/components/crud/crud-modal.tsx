"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/hooks/use-locale";
import { mergeReferenceOptions } from "@/hooks/reference-options";
import { useReferenceItems } from "@/hooks/use-reference-items";
import { EmojiPicker } from "@/components/wm";
import { CRUD_CONFIG, type CrudEntity, type CrudField } from "./crud-config";
import { AddToMasterDataLink } from "./add-to-master-data-link";

export type CrudMode = "add" | "edit";

export interface CrudModalState {
  entity: CrudEntity;
  mode: CrudMode;
  initialValues?: Record<string, string>;
}

interface CrudModalProps {
  state: CrudModalState | null;
  onClose: () => void;
  /**
   * Optional submit handler; defaults to a demo-parity success toast. May
   * return a Promise — the modal disables Simpan and awaits it before
   * closing, so pass the handler directly (don't swap it for `undefined`
   * while a submit is in flight, that silently no-ops the real request and
   * falls back to this demo-parity toast). Re-entrant clicks are guarded
   * internally instead.
   */
  onSubmit?: (
    entity: CrudEntity,
    mode: CrudMode,
    values: Record<string, string>,
  ) => void | Promise<void>;
  /**
   * Runtime-injected options for `select` fields, keyed by field key. When
   * present for a field, these override the static config `options` and allow a
   * distinct value/label (e.g. a COA account id vs its display label).
   */
  dynamicOptions?: Record<string, { value: string; label: string }[]>;
}

// EPIC-021 #21 — `allowNegative` (only `cash.saldo` today) preserves a
// leading "-" instead of stripping it with every other non-digit character,
// so a cash account that has gone negative (via an over-budget expense) can
// still be typed, edited, and round-tripped correctly through this shared
// "amount" field. Every other field keeps the original strip-everything
// behavior by omitting the flag.
function formatThousands(raw: string, allowNegative = false): string {
  const isNegative = allowNegative && raw.trim().startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return isNegative ? "-" : "";
  const formatted = parseInt(digits, 10).toLocaleString("id-ID");
  return isNegative ? `-${formatted}` : formatted;
}

function initialFieldValues(
  fields: CrudField[],
  initial?: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const given = initial?.[f.key];
    if (given !== undefined) {
      values[f.key] =
        f.type === "amount" ? formatThousands(given, f.allowNegative) : given;
    } else if (f.type === "select" || f.type === "iconpick") {
      values[f.key] = f.options?.[0] ?? "";
    } else if (f.type === "toggle") {
      values[f.key] = "false";
    } else {
      values[f.key] = "";
    }
  }
  return values;
}

/**
 * EPIC-026 Wave 8 — the prototype's only 2-up grouping in a reference-data
 * dialog is `dlg-md-kategori`'s `.field-row` holding "Ikon" next to the
 * "Tipe" select (docs/prototype/pages/masterdata.html); everything else
 * stacks full-width. That is reproduced here as: an `iconpick` field pairs
 * with the nearest following `select`, which is pulled up into the row.
 *
 * The grouping is derived at render time on purpose — `crud-config.ts`'s
 * schema and every entity's declared field list are left byte-for-byte
 * unchanged, and the submitted `values` object is keyed, so visual order has
 * no effect on any payload. An entity with an icon picker but no select
 * (e.g. `tujuan`) simply keeps the picker full-width, as it renders today.
 */
function groupFieldsIntoRows(fields: CrudField[]): CrudField[][] {
  const rows: CrudField[][] = [];
  const consumed = new Set<number>();
  fields.forEach((field, i) => {
    if (consumed.has(i)) return;
    // NOTE: `iconpick` used to be pulled into a 2-up `field-row` beside the
    // following select, mirroring the prototype's small 10-emoji grid sitting
    // next to "Tipe". The picker is now a search field plus a scrolling
    // result grid — several times taller — so squeezing it into half the
    // dialog width would leave both controls cramped. It takes the full row;
    // every other entity's grouping is untouched.
    rows.push([field]);
  });
  return rows;
}

export function CrudModal({
  state,
  onClose,
  onSubmit,
  dynamicOptions,
}: CrudModalProps) {
  if (!state) return null;
  // Keyed so consecutive opens with different entities/modes re-initialize.
  return (
    <CrudForm
      key={`${state.entity}-${state.mode}`}
      state={state}
      onClose={onClose}
      onSubmit={onSubmit}
      dynamicOptions={dynamicOptions}
    />
  );
}

interface CrudFormProps extends CrudModalProps {
  state: CrudModalState;
}

function CrudForm({ state, onClose, onSubmit, dynamicOptions }: CrudFormProps) {
  const { t } = useLocale();
  const config = CRUD_CONFIG[state.entity];
  const { items: referenceItems } = useReferenceItems(undefined, {
    enabled: config.fields.some((f) => f.referenceGroup),
  });
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialFieldValues(config.fields, state.initialValues),
  );
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (isSaving) return;
    if (!onSubmit) {
      toast.success(
        `${config.title} berhasil ${state.mode === "edit" ? "diperbarui" : "ditambahkan"}!`,
      );
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(state.entity, state.mode, values);
      onClose();
    } catch {
      // EPIC-022 F2 — a rejected `onSubmit` is exactly what keeps this
      // dialog open (skipping `onClose()` above) instead of discarding the
      // user's input on a failed save; every `onSubmit` implementation
      // already shows its own error toast before rethrowing (see e.g.
      // rekening/page.tsx, tujuan/page.tsx). Catching here only stops that
      // already-handled rejection from also becoming an "Uncaught (in
      // promise)" console error, since this `onClick` handler's returned
      // promise is never awaited by the caller.
    } finally {
      setIsSaving(false);
    }
  };

  // F6 — a field with no real backing data on edit (e.g. `rekening.jenis`,
  // see its own `hideOnEdit` doc comment) is dropped from the edit form
  // entirely instead of rendering pre-filled-wrong and silently discarded.
  const visibleFields =
    state.mode === "edit"
      ? config.fields.filter((f) => !f.hideOnEdit)
      : config.fields;
  const rows = groupFieldsIntoRows(visibleFields);

  const renderControl = (f: CrudField) => {
    if (f.type === "select") {
      const options =
        dynamicOptions?.[f.key] ??
        (f.referenceGroup
          ? mergeReferenceOptions(
              referenceItems
                .filter((i) => i.group === f.referenceGroup)
                .map((i) => i.label),
              f.options ?? [],
              values[f.key],
            )
          : (f.options ?? [])
        ).map((o) => ({ value: o, label: o }));
      return (
        <select
          className="select"
          value={values[f.key] ?? ""}
          onChange={(e) => setField(f.key, e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === "textarea") {
      return (
        <textarea
          className="textarea"
          rows={2}
          placeholder={f.placeholder}
          value={values[f.key] ?? ""}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      );
    }
    if (f.type === "amount") {
      // Prototype money inputs are `.input.mono` holding a dot-grouped
      // value (see `dlg-split`'s "Jumlah Pokok") — no "Rp" adornment.
      return (
        <input
          className="input mono"
          inputMode={f.allowNegative ? "text" : "numeric"}
          placeholder="0"
          value={values[f.key] ?? ""}
          onChange={(e) =>
            setField(f.key, formatThousands(e.target.value, f.allowNegative))
          }
        />
      );
    }
    if (f.type === "date") {
      return (
        <input
          className="input"
          type="date"
          value={values[f.key] ?? ""}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      );
    }
    return (
      <input
        className="input"
        type={
          f.type === "number" ? "number" : f.type === "email" ? "email" : "text"
        }
        placeholder={f.placeholder}
        value={values[f.key] ?? ""}
        onChange={(e) => setField(f.key, e.target.value)}
      />
    );
  };

  const renderField = (f: CrudField, inRow: boolean) => {
    const fieldClass = inRow ? "field mt-0" : "field";
    const hint = f.helper?.(values);

    // Prototype `dlg-md-kategori` — the switch is a `.row`, not a boxed
    // card: control first, then a bold label with its muted sub-copy.
    if (f.type === "toggle") {
      return (
        <div key={f.key} className="row mt-3.5 gap-[9px]">
          <Switch
            aria-label={f.label}
            checked={values[f.key] === "true"}
            onCheckedChange={(checked) =>
              setField(f.key, checked ? "true" : "false")
            }
          />
          <span>
            <span className="t-sm t-bold">{f.label}</span>
            {f.helperText && (
              <span className="t-xs t-muted block">{f.helperText}</span>
            )}
          </span>
        </div>
      );
    }

    // The icon picker is a button group, which cannot live inside a
    // `<label>` — it keeps a `<div class="field">` plus a `<span
    // class="label">`, exactly as the prototype's own icon picker does.
    //
    // `f.options` is no longer the choice set: the picker searches the full
    // emoji list, so the ten hardcoded emoji in `crud-config.ts` stopped being
    // a limit. The field's `options` are left in place there because
    // `initialValuesFor` still reads `options[0]` as the default selection.
    if (f.type === "iconpick") {
      return (
        <div key={f.key} className={fieldClass}>
          <EmojiPicker
            label={f.label}
            value={values[f.key] ?? ""}
            onChange={(emoji) => setField(f.key, emoji)}
            searchPlaceholder={t.common.emojiSearchPlaceholder}
            noResultsLabel={t.common.emojiNoResults}
            loadingLabel={t.common.emojiLoading}
            ariaLabel={t.common.emojiGroupAriaLabel}
          />
          {hint && <span className="hint block">{hint}</span>}
        </div>
      );
    }

    return (
      <label key={f.key} className={fieldClass}>
        <span className="label">{f.label}</span>
        {renderControl(f)}
        {hint && <span className="hint block">{hint}</span>}
        {f.referenceGroup && <AddToMasterDataLink group={f.referenceGroup} />}
      </label>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* EPIC-026 Wave 8 — composition ported from the prototype's
          `dlg-md-add` / `dlg-md-kategori` (docs/prototype/pages/
          masterdata.html): `.dialog__title` + `.dialog__desc`, a
          `.dialog__body` of `.field` / `.field-row` groups, and a
          `.dialog__footer` with outline "Batal" left of the primary
          confirm. No width override — `.dialog`'s own 480px default is what
          the prototype uses for the field-bearing reference dialog, and the
          former `min-[769px]:w-[min(448px,…)]` was an app invention. */}
      <DialogContent>
        <DialogTitle>
          {state.mode === "edit" ? "Edit" : "Tambah"} {config.title}
        </DialogTitle>
        <DialogDescription>
          {state.mode === "edit"
            ? t.crud.editDescription
            : t.crud.addDescription}
        </DialogDescription>

        <DialogBody>
          {rows.map((row, i) =>
            row.length === 2 ? (
              // `.field-row` carries no margin of its own (only `.field +
              // .field` does), so every row after the first restores the
              // prototype's 12px gap — matching its inline
              // `style="margin-top: 12px"`.
              <div
                key={row[0].key}
                className={i === 0 ? "field-row" : "field-row mt-3"}
              >
                {row.map((f) => renderField(f, true))}
              </div>
            ) : (
              renderField(row[0], false)
            ),
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="size-4" /> {isSaving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
