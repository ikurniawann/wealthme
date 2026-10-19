"use client";
import { useState } from "react";
import { toast } from "sonner";
import type {
  InvestmentDto,
  InvestmentValuationDto,
  PlatformAccountDto,
  InvestmentPriceBatchInput,
  InvestmentPriceBatchResultDto,
} from "@wealthme/contracts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { apiErrorMessage } from "@/lib/api-error";
import { priceUnit } from "./price-unit";
import { amount, today } from "./investment-fields";
import { investmentWrite, uploadHoldingProof } from "./investment-api";
import { PriceTable } from "./price-table";
import type { PriceEntry } from "./price-table";
import { PriceResults } from "./price-results";
import type { FeedResult } from "./price-results";
import { money } from "./portfolio-model";

export function PriceForm({
  initialId,
  holdings,
  valuations,
  platforms,
  fg,
  token,
  onClose,
  onSaved,
}: {
  initialId?: string;
  holdings: InvestmentDto[];
  valuations: InvestmentValuationDto[];
  platforms: PlatformAccountDto[];
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const p = t.investasi.prices;
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const { hideBalance } = useMoney();
  const [mode, setMode] = useState<"manual" | "feed">("manual");
  const [platform, setPlatform] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [reference, setReference] = useState("");
  const [entries, setEntries] = useState<Record<string, PriceEntry>>({});
  const [result, setResult] = useState<InvestmentPriceBatchResultDto | null>(
    null,
  );
  const [previewKey, setPreviewKey] = useState("");
  const [feeds, setFeeds] = useState<FeedResult[]>([]);
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = holdings.filter(
    (h) =>
      (!initialId || h.id === initialId) &&
      (!platform || h.platformAccountId === platform) &&
      h.type !== "deposito",
  );
  const body: InvestmentPriceBatchInput = {
    rows: visible.map((h) => ({
      investmentId: h.id,
      price: entries[h.id]?.price.trim() ? amount(entries[h.id].price) : null,
      currency: h.currency,
      unitLabel: priceUnit(h),
      source: entries[h.id]?.source ?? "manual",
      asOfDate: date,
      asOfTime: time || null,
      timeZone: "Asia/Jakarta",
      reference: reference.trim() || null,
    })),
  };
  const serialized = JSON.stringify(body);
  const fresh = previewKey === serialized;
  const shownResult = fresh ? result : null;
  async function run(action: "preview" | "bulk" | "refresh") {
    if (busy || !visible.length) return;
    if (action === "bulk" && (!fresh || !result || result.saved)) return;
    setBusy(true);
    setError("");
    try {
      if (action === "refresh") {
        const rows = await investmentWrite<FeedResult[]>(
          `/family-groups/${fg}/investments/prices/refresh`,
          {
            token,
            method: "POST",
            body: JSON.stringify({ investmentIds: visible.map((h) => h.id) }),
            timeoutMs: 120000,
          },
        );
        setFeeds(rows);
        onSaved();
        toast.success(p.refreshed);
      } else {
        const next = await investmentWrite<InvestmentPriceBatchResultDto>(
          `/family-groups/${fg}/investments/prices/${action}`,
          { token, method: "POST", body: serialized },
        );
        setResult(next);
        setPreviewKey(serialized);
        if (action === "bulk") {
          onSaved();
          let proofFailed = false;
          if (proof)
            for (const row of next.rows)
              if (row.priceId) {
                try {
                  await uploadHoldingProof(fg, row.investmentId, proof, token);
                } catch {
                  proofFailed = true;
                }
              }
          if (proofFailed) {
            setError(p.proofFailed);
            toast.warning(p.proofFailed);
          } else toast.success(p.saved);
        }
      }
    } catch (err) {
      setError(apiErrorMessage(err, f.failed));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="iv-dialog iv-price-dialog">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("preview");
          }}
        >
          <header className="iv-dialog-head">
            <DialogTitle>{p.title}</DialogTitle>
            <DialogDescription>{p.subtitle}</DialogDescription>
          </header>
          <div className="iv-form-body">
            <div className="iv-tabs" role="group" aria-label={p.title}>
              {(["feed", "manual"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className="btn"
                  disabled={busy}
                  aria-pressed={mode === tab}
                  onClick={() => {
                    setMode(tab);
                    setError("");
                  }}
                >
                  {p[tab]}
                </button>
              ))}
            </div>
            <fieldset disabled={busy} className="iv-price-fields">
              <label className="field">
                <span className="label">{c.platform}</span>
                <select
                  className="select"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="">{c.all}</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label ??
                        p.platformName ??
                        p.customName ??
                        p.platformKey}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "manual" && (
                <div className="iv-field-row">
                  <label className="field">
                    <span className="label">{p.date} *</span>
                    <input
                      className="input"
                      required
                      type="date"
                      max={today()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="label">{p.time}</span>
                    <input
                      className="input"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                    <small>Asia/Jakarta (WIB)</small>
                  </label>
                </div>
              )}
              {mode === "feed" && <p className="iv-notice">{p.feedNote}</p>}
              <PriceTable
                holdings={visible}
                valuations={valuations}
                entries={entries}
                onChange={(id, entry) =>
                  setEntries({ ...entries, [id]: entry })
                }
                mode={mode}
                result={shownResult}
                feeds={feeds}
                disabled={busy}
              />
              {mode === "manual" && (
                <>
                  <p className="iv-notice">{p.blank}</p>
                  <label className="field">
                    <span className="label">{p.reference}</span>
                    <input
                      className="input"
                      maxLength={500}
                      type="url"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="https://"
                    />
                  </label>
                  <label className="field">
                    <span className="label">{f.proof}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (file && file.size > 5 * 1024 * 1024) {
                          setError(f.proofLimit);
                          e.target.value = "";
                          return;
                        }
                        setProof(file);
                      }}
                    />
                    <small>
                      {f.proofLimit} · {p.proofNote}
                    </small>
                  </label>
                </>
              )}
            </fieldset>
            {mode === "manual" && (
              <details>
                <summary>{p.fx}</summary>
                <p>{p.fxNote}</p>
                {valuations
                  .filter(
                    (v) =>
                      visible.some((h) => h.id === v.investmentId) &&
                      v.valuationFx,
                  )
                  .map((v) => (
                    <p key={v.investmentId}>
                      {v.valuationFx!.currency}:{" "}
                      {money(
                        v.valuationFx!.idrPerUnit,
                        "IDR",
                        locale,
                        hideBalance,
                        8,
                      )}{" "}
                      · {v.valuationFx!.rateDate} · {v.valuationFx!.source}
                    </p>
                  ))}
              </details>
            )}
            {mode === "feed" && !!feeds.length && (
              <p role="status">
                {feeds.filter((r) => r.status === "updated").length} {p.count},{" "}
                {feeds.filter((r) => r.status === "skipped").length}{" "}
                {p.skipCount},{" "}
                {feeds.filter((r) => r.status === "failed").length}{" "}
                {p.failCount}
              </p>
            )}
            {mode === "manual" && shownResult && (
              <PriceResults result={shownResult} />
            )}
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </div>
          <footer className="iv-form-footer">
            <button
              type="button"
              className="btn btn--outline"
              disabled={busy}
              onClick={onClose}
            >
              {f.cancel}
            </button>
            {mode === "feed" ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || !visible.length}
                onClick={() => void run("refresh")}
              >
                {busy ? c.loading : p.refresh}
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  className="btn btn--outline"
                  disabled={busy || !visible.length}
                >
                  {busy ? c.loading : p.preview}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={
                    busy || !fresh || !result?.updatedCount || result.saved
                  }
                  onClick={() => void run("bulk")}
                >
                  {busy ? f.saving : p.save}
                </button>
              </>
            )}
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
