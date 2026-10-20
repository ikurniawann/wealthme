"use client";
import type { FormEvent, ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { dialogCopy } from "./dialog-copy";
import "./trade-position.css";
import "./dialog-shell.css";

/**
 * One frame for every investment form dialog that is not a bespoke flow:
 * forest `.wm-dark` header band (icon, light title + subtitle, round close),
 * padded scrolling body whose controls are disabled while saving, and a
 * sticky footer with Batal (outline) + the primary action. Full-screen sheet
 * on phones. Same look as Top up, Tambah investasi, Beli/Jual and the Kas
 * form; the CSS is the `.ivx` system (trade-position.css + dialog-shell.css).
 */
export function InvestDialogShell({
  title,
  subtitle,
  icon,
  tone,
  size,
  busy,
  submitLabel,
  destructive = false,
  onClose,
  onSubmit,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: "danger";
  size?: "sm";
  busy: boolean;
  submitLabel: ReactNode;
  destructive?: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const { t, locale } = useLocale();
  const f = t.investasi.forms;
  const copy = dialogCopy(locale);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="ivx ivx-std"
        data-size={size}
      >
        <header className="ivx-head wm-dark">
          {icon && (
            <span className="ivx-head-ic" data-tone={tone} aria-hidden="true">
              {icon}
            </span>
          )}
          <div className="ivx-head-text">
            <DialogTitle className="ivx-title">{title}</DialogTitle>
            {subtitle && (
              <DialogDescription className="ivx-sub">
                {subtitle}
              </DialogDescription>
            )}
          </div>
          <DialogClose
            className="ivx-x"
            aria-label={copy.close}
            disabled={busy}
          >
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          className="ivx-form"
          onSubmit={(e) => {
            // A nested dialog (the platform form opened from a pocket
            // picker) is portaled, but React still bubbles its submit
            // through the component tree: handle only our own form, and
            // stop ours from reaching an outer form's handler.
            if (e.target !== e.currentTarget) return;
            e.stopPropagation();
            onSubmit(e);
          }}
        >
          <div className="ivx-body">
            <fieldset className="ivx-fieldset" disabled={busy}>
              {children}
            </fieldset>
          </div>
          <footer className="ivx-foot">
            <button
              type="button"
              className="btn btn--outline ivx-cancel"
              disabled={busy}
              onClick={onClose}
            >
              {f.cancel}
            </button>
            <button
              type="submit"
              className={`btn ${destructive ? "btn--destructive" : "btn--primary"} ivx-save`}
              disabled={busy}
            >
              {busy ? f.saving : submitLabel}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A titled group of fields inside the shell body. */
export function DialogSection({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ivx-sec">
      <h3 className="ivx-sec-title">{title}</h3>
      {children}
    </section>
  );
}
