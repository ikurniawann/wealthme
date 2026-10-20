"use client";

import type { Ref } from "react";
import Link from "next/link";
import {
  BarChart3,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import type { I18nDictionary } from "@/i18n/types";
import "./tx-phone.css";

/*
 * Phone-only pieces of the Tambah transaksi sheet (2026-10-20 reference
 * "Tambah transaksi · layar penuh"). The dialog renders them only when
 * `usePhone()` is true; every handler and value comes from the dialog, so the
 * form logic stays in one place. Styles: tx-phone.css (≤720px only).
 */

/** Back chevron left of the title; closes the sheet like Esc does. */
export function TxPhoneBack({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      className="tx3-back"
      aria-label={label}
      title={label}
      onClick={onBack}
    >
      <ChevronLeft aria-hidden="true" />
    </button>
  );
}

/**
 * "Scan struk" as one full-width row (camera chip · title + hint · chevron).
 * Without an AI key the row is disabled and the hint links to Pengaturan —
 * the same gate as the desktop banner, never a fake scan.
 */
export function TxPhoneScanRow({
  t,
  available,
  hintId,
  triggerRef,
  onScan,
}: {
  t: I18nDictionary;
  available: boolean;
  hintId: string;
  triggerRef: Ref<HTMLButtonElement>;
  onScan: () => void;
}) {
  const dlg = t.shell.transactionDialog;
  return (
    <div className="tx3-scanrow" data-disabled={!available || undefined}>
      <button
        type="button"
        ref={triggerRef}
        onClick={onScan}
        disabled={!available}
        aria-describedby={hintId}
        className="tx3-scanrow-btn"
      >
        <span className="tx3-scanrow-ic" aria-hidden="true">
          <Camera />
        </span>
        <span className="tx3-scanrow-txt">
          <b>{t.shell.phone.tx.scanTitle}</b>
        </span>
        <ChevronRight className="tx3-scanrow-chev" aria-hidden="true" />
      </button>
      <span id={hintId} className="tx3-scanrow-hint">
        {available ? (
          t.shell.phone.tx.scanBody
        ) : (
          <>
            {dlg.scanUnavailable}{" "}
            <Link href="/akun" className="tx3-scanrow-link">
              {dlg.scanUnavailableLink}
            </Link>
          </>
        )}
      </span>
    </div>
  );
}

/** "Detail tambahan" disclosure over the description + receipt fields. */
export function TxPhoneDetailToggle({
  t,
  open,
  controls,
  onToggle,
}: {
  t: I18nDictionary;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <div className="tx3-detail">
      <span className="tx3-detail-title" aria-hidden="true">
        {t.shell.phone.tx.detailTitle}
      </span>
      <button
        type="button"
        className="tx3-detail-btn"
        aria-expanded={open}
        aria-controls={controls}
        aria-label={`${t.shell.phone.tx.detailTitle}: ${t.shell.phone.tx.detailToggle}`}
        onClick={onToggle}
      >
        <FileText aria-hidden="true" />
        <span>{t.shell.phone.tx.detailToggle}</span>
        <ChevronDown className="tx3-detail-chev" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * "Saldo setelah transaksi" from the selected account's known balance and the
 * typed amount; the dialog passes null (and nothing renders) when either is
 * unknown.
 */
export function TxPhoneBalanceAfter({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (value === null) return null;
  return (
    <p className="tx3-after" aria-live="polite">
      <BarChart3 aria-hidden="true" />
      <span>{label}</span>
      <b className="wm-num">{value}</b>
    </p>
  );
}
