"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CRUD_CONFIG, type CrudEntity, type CrudField } from "./crud-config";

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
}

function formatThousands(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

function initialFieldValues(
  fields: CrudField[],
  initial?: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const given = initial?.[f.key];
    if (given !== undefined) {
      values[f.key] = f.type === "amount" ? formatThousands(given) : given;
    } else if (f.type === "select" || f.type === "iconpick") {
      values[f.key] = f.options?.[0] ?? "";
    } else {
      values[f.key] = "";
    }
  }
  return values;
}

const FIELD_INPUT_CLASS =
  "h-9 w-full rounded-lg border bg-background px-3 text-[13px] outline-none focus:border-primary";

export function CrudModal({ state, onClose, onSubmit }: CrudModalProps) {
  if (!state) return null;
  // Keyed so consecutive opens with different entities/modes re-initialize.
  return (
    <CrudForm
      key={`${state.entity}-${state.mode}`}
      state={state}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

interface CrudFormProps extends CrudModalProps {
  state: CrudModalState;
}

function CrudForm({ state, onClose, onSubmit }: CrudFormProps) {
  const config = CRUD_CONFIG[state.entity];
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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold">
            {state.mode === "edit" ? "Edit" : "Tambah"} {config.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {config.fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
                {f.label}
              </label>
              {f.type === "select" ? (
                <select
                  className={FIELD_INPUT_CLASS}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <Textarea
                  rows={2}
                  className="resize-none text-[13px]"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : f.type === "amount" ? (
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-[12px] font-semibold text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    inputMode="numeric"
                    className="pl-9 text-[13px]"
                    placeholder="0"
                    value={values[f.key] ?? ""}
                    onChange={(e) =>
                      setField(f.key, formatThousands(e.target.value))
                    }
                  />
                </div>
              ) : f.type === "iconpick" ? (
                <div className="flex flex-wrap gap-1.5">
                  {(f.options ?? []).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setField(f.key, o)}
                      className={`flex size-9 items-center justify-center rounded-lg border text-[16px] transition-colors ${
                        values[f.key] === o
                          ? "border-primary bg-accent"
                          : "bg-background hover:border-primary/50"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              ) : f.type === "date" ? (
                <Input
                  type="date"
                  className="text-[13px]"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : (
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  className="text-[13px]"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          <Save className="size-4" /> {isSaving ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
