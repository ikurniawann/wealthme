"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChartColumnIncreasing,
  ChevronDown,
  Database,
  Eye,
  Info,
  Paperclip,
  PenLine,
  Coins,
  X,
} from "lucide-react";
import { MANUAL_PRICE_SOURCES } from "@wealthme/contracts";
import type {
  InvestmentDto,
  InvestmentValuationDto,
  ManualPriceSource,
  PlatformAccountDto,
  InvestmentPriceBatchInput,
  InvestmentPriceBatchResultDto,
} from "@wealthme/contracts";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { investmentErrorMessage } from "./investment-conflict";
import { priceUnit } from "./price-unit";
import { amount, today, TIME_ZONES } from "./investment-fields";
import { investmentWrite, uploadHoldingProof } from "./investment-api";
import { PriceTable } from "./price-table";
import type { PriceEntry } from "./price-table";
import { PriceResults } from "./price-results";
import type { FeedResult } from "./price-results";
import { money } from "./portfolio-model";
import { priceCopy } from "./price-copy";
import "./trade-position.css";
import "./price-update.css";

const PROOF_LIMIT = 5 * 1024 * 1024;
/** Select value for holdings not linked to any platform account. */
const UNLINKED = "__unlinked__";

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
  const copy = priceCopy(locale);
  const { hideBalance } = useMoney();
  const [mode, setMode] = useState<"manual" | "feed">("manual");
  const [platform, setPlatform] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [zone, setZone] = useState("Asia/Jakarta");
  const [reference, setReference] = useState("");
  const [bulkSource, setBulkSource] = useState<ManualPriceSource | "">("");
  const [entries, setEntries] = useState<Record<string, PriceEntry>>({});
  const [result, setResult] = useState<InvestmentPriceBatchResultDto | null>(
    null,
  );
  const [previewKey, setPreviewKey] = useState("");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [feeds, setFeeds] = useState<FeedResult[]>([]);
  const [proof, setProof] = useState<File | null>(null);
  const [pending, setPending] = useState<"" | "preview" | "bulk" | "refresh">(
    "",
  );
  const busy = pending !== "";
  const [error, setError] = useState("");
  // Every row the dialog can price, before the platform filter. Counts per
  // option come from this list so they match what each tab would show.
  const priceable = holdings.filter(
    (h) => (!initialId || h.id === initialId) && h.type !== "deposito",
  );
  const onPlatform = (h: InvestmentDto, key: string) =>
    key === UNLINKED ? !h.platformAccountId : h.platformAccountId === key;
  const countFor = (key: string) =>
    priceable.filter((h) => onPlatform(h, key)).length;
  const visible = priceable.filter((h) => !platform || onPlatform(h, platform));
  const body: InvestmentPriceBatchInput = {
    rows: visible.map((h) => ({
      investmentId: h.id,
      price: entries[h.id]?.price.trim() ? amount(entries[h.id].price) : null,
      currency: h.currency,
      unitLabel: priceUnit(h),
      source: entries[h.id]?.source ?? "manual",
      asOfDate: date,
      asOfTime: time || null,
      timeZone: zone,
      reference: reference.trim() || null,
    })),
  };
  const serialized = JSON.stringify(body);
  const fresh = previewKey === serialized;
  const shownResult = fresh ? result : null;
  const filled = visible.filter((h) => entries[h.id]?.price.trim()).length;
  const autoRows = visible.filter(
    (h) =>
      (h.type === "saham" || h.type === "kripto") &&
      !h.details?.manualInstrument,
  ).length;
  const fxRows = valuations.filter(
    (v) => visible.some((h) => h.id === v.investmentId) && v.valuationFx,
  );
  const fxByCurrency = [
    ...new Map(
      fxRows.map((v) => [v.valuationFx!.currency, v.valuationFx!]),
    ).values(),
  ];
  const saved = !!shownResult?.saved;
  const platformName = (x: PlatformAccountDto) =>
    x.label ?? x.platformName ?? x.customName ?? x.platformKey;

  async function run(action: "preview" | "bulk" | "refresh") {
    if (busy || !visible.length) return;
    if (action === "bulk" && (!fresh || !result || result.saved)) return;
    setPending(action);
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
        return;
      }
      const next = await investmentWrite<InvestmentPriceBatchResultDto>(
        `/family-groups/${fg}/investments/prices/${action}`,
        { token, method: "POST", body: serialized },
      );
      setResult(next);
      setPreviewKey(serialized);
      setPreviewOpen(true);
      if (action !== "bulk") return;
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
    } catch (err) {
      setError(investmentErrorMessage(err, f.failed, locale));
    } finally {
      setPending("");
    }
  }

  const updateEntry = (id: string, entry: PriceEntry) =>
    setEntries((prev) => ({ ...prev, [id]: entry }));
  const applySource = (source: ManualPriceSource | "") => {
    setBulkSource(source);
    if (!source) return;
    setEntries((prev) =>
      Object.fromEntries(
        visible.map((h) => [h.id, { price: prev[h.id]?.price ?? "", source }]),
      ),
    );
  };
  const summaryLine = shownResult
    ? copy.summaryResult(
        shownResult.updatedCount,
        shownResult.skippedCount,
        shownResult.failedCount,
      )
    : copy.summaryDraft(filled, visible.length - filled);
  const feedCounts = {
    updated: feeds.filter((r) => r.status === "updated").length,
    skipped: feeds.filter((r) => r.status === "skipped").length,
    failed: feeds.filter((r) => r.status === "failed").length,
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="ivx ivp">
        <header className="ivx-head wm-dark">
          <span className="ivx-head-ic" aria-hidden="true">
            <ChartColumnIncreasing />
          </span>
          <div className="ivx-head-text">
            <DialogTitle className="ivx-title">{p.title}</DialogTitle>
            <DialogDescription className="ivx-sub">
              {p.subtitle}
            </DialogDescription>
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
            e.preventDefault();
            void run(mode === "feed" ? "refresh" : "preview");
          }}
        >
          <div className="ivx-body">
            <div
              className="ivx-seg ivp-tabs"
              role="radiogroup"
              aria-label={p.title}
            >
              {(["feed", "manual"] as const).map((tab) => {
                const Icon = tab === "feed" ? Database : PenLine;
                return (
                  <label key={tab}>
                    <input
                      type="radio"
                      name="ivp-mode"
                      checked={mode === tab}
                      disabled={busy}
                      onChange={() => {
                        setMode(tab);
                        setError("");
                      }}
                    />
                    <Icon aria-hidden="true" />
                    {p[tab]}
                  </label>
                );
              })}
            </div>

            <div className="ivp-controls">
              <label className="ivx-field ivp-platform">
                <span className="ivx-label">{copy.platform}</span>
                <select
                  className="select"
                  value={platform}
                  disabled={busy || !!initialId}
                  aria-describedby={
                    platforms.length ? undefined : "ivp-platform-hint"
                  }
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="">{copy.allPlatforms}</option>
                  {[
                    ...platforms.map((x) => ({
                      key: x.id,
                      name: platformName(x),
                    })),
                    { key: UNLINKED, name: copy.unlinked },
                  ].map(({ key, name }) => {
                    const n = countFor(key);
                    return (
                      <option key={key} value={key} disabled={!n}>
                        {n
                          ? `${name} · ${copy.instrumentCount(n)}`
                          : `${name} (0)`}
                      </option>
                    );
                  })}
                </select>
                {!platforms.length && (
                  <small className="ivx-hint" id="ivp-platform-hint">
                    {copy.noPlatforms}
                  </small>
                )}
              </label>
              {mode === "manual" && (
                <fieldset className="ivp-when" disabled={busy}>
                  <legend className="ivx-label">{p.date} *</legend>
                  <div className="ivp-when-row">
                    <input
                      className="input"
                      aria-label={p.date}
                      required
                      type="date"
                      max={today()}
                      enterKeyHint="next"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                    <input
                      className="input"
                      aria-label={p.time}
                      type="time"
                      enterKeyHint="next"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                    <select
                      className="select"
                      aria-label={p.zone}
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                    >
                      {TIME_ZONES.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>
                </fieldset>
              )}
            </div>

            {mode === "feed" && (
              <p className="ivx-strip">
                <Info aria-hidden="true" />
                {autoRows ? p.feedNote : copy.feedNoAuto}
              </p>
            )}

            {mode === "feed" && feeds.length > 0 && (
              <p className="ivx-strip" role="status">
                <Info aria-hidden="true" />
                {copy.feedSummary(
                  feedCounts.updated,
                  feedCounts.skipped,
                  feedCounts.failed,
                )}
              </p>
            )}

            <PriceTable
              holdings={visible}
              valuations={valuations}
              entries={entries}
              onChange={updateEntry}
              mode={mode}
              result={shownResult}
              feeds={feeds}
              disabled={busy || saved}
            />

            {mode === "manual" && (
              <>
                <p className="ivx-strip ivp-info">
                  <Info aria-hidden="true" />
                  {p.blank}
                </p>
                <div className="ivp-ref">
                  <div className="ivx-field">
                    <span className="ivx-label" id="ivp-ref-label">
                      {p.reference}
                    </span>
                    <div className="ivp-ref-row">
                      <select
                        className="select"
                        aria-label={copy.bulkSource}
                        value={bulkSource}
                        disabled={busy || saved}
                        onChange={(e) =>
                          applySource(e.target.value as ManualPriceSource | "")
                        }
                      >
                        <option value="">{copy.bulkSourceKeep}</option>
                        {MANUAL_PRICE_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {p.sources[s]}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        aria-labelledby="ivp-ref-label"
                        aria-describedby="ivp-ref-hint"
                        maxLength={500}
                        inputMode="url"
                        autoComplete="off"
                        enterKeyHint="done"
                        disabled={busy || saved}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="https://… / No. laporan"
                      />
                    </div>
                    <small className="ivx-hint" id="ivp-ref-hint">
                      {copy.referenceHint}
                    </small>
                  </div>
                  <div className="ivx-field">
                    <span className="ivx-label">{copy.proof}</span>
                    <label className="ivx-file ivp-file">
                      <Paperclip aria-hidden="true" />
                      <span>{proof ? proof.name : copy.chooseFile}</span>
                      <input
                        type="file"
                        disabled={busy || saved}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (file && file.size > PROOF_LIMIT) {
                            setError(f.proofLimit);
                            e.target.value = "";
                            return;
                          }
                          setProof(file);
                        }}
                      />
                    </label>
                    <small className="ivx-hint">
                      {copy.proofTypes} · {p.proofNote}
                    </small>
                  </div>
                </div>

                <div className="ivp-cards">
                  <section className="ivp-card" aria-live="polite">
                    <span className="ivp-card-ic" aria-hidden="true">
                      <ChartColumnIncreasing />
                    </span>
                    <div>
                      <h3>{copy.summaryTitle}</h3>
                      <p className="ivp-card-lead">{summaryLine}</p>
                      <small>
                        {result && !fresh
                          ? copy.summaryStale
                          : copy.summaryNote}
                      </small>
                    </div>
                  </section>
                  <details className="ivp-card ivp-fx">
                    <summary>
                      <span className="ivp-card-ic" aria-hidden="true">
                        <Coins />
                      </span>
                      <span>
                        <h3>
                          {copy.fxTitle} <span>{copy.fxOptional}</span>
                        </h3>
                        <small>{p.fxNote}</small>
                      </span>
                      <ChevronDown className="ivp-chev" aria-hidden="true" />
                    </summary>
                    {fxByCurrency.length ? (
                      <ul>
                        {fxByCurrency.map((fx) => (
                          <li key={fx.currency}>
                            <strong>1 {fx.currency}</strong> ={" "}
                            {money(
                              fx.idrPerUnit,
                              "IDR",
                              locale,
                              hideBalance,
                              4,
                            )}{" "}
                            <small>
                              · {fx.rateDate} · {fx.source}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ivp-muted">{copy.fxNone}</p>
                    )}
                  </details>
                </div>

                <section
                  className="ivp-preview"
                  aria-labelledby="ivp-preview-title"
                >
                  <button
                    type="button"
                    className="ivp-preview-head"
                    aria-expanded={previewOpen}
                    onClick={() => setPreviewOpen((o) => !o)}
                  >
                    <Eye aria-hidden="true" />
                    <span>
                      <strong id="ivp-preview-title">
                        {copy.previewTitle}
                      </strong>
                      <small>{copy.previewHint}</small>
                    </span>
                    <ChevronDown className="ivp-chev" aria-hidden="true" />
                  </button>
                  {previewOpen &&
                    (shownResult ? (
                      <PriceResults
                        result={shownResult}
                        holdings={visible}
                        valuations={valuations}
                      />
                    ) : (
                      <p className="ivp-muted ivp-preview-empty">
                        {result && !fresh
                          ? copy.summaryStale
                          : copy.previewEmpty}
                      </p>
                    ))}
                </section>
              </>
            )}
            {error && (
              <p role="alert" className="error-text ivx-error">
                {error}
              </p>
            )}
          </div>
          <footer className="ivx-foot ivp-foot">
            <button
              type="button"
              className="btn btn--outline ivx-cancel"
              disabled={busy}
              onClick={onClose}
            >
              {saved ? copy.done : f.cancel}
            </button>
            {mode === "feed" ? (
              <button
                type="submit"
                className="btn btn--primary ivx-save"
                disabled={busy || !autoRows}
              >
                {pending === "refresh" ? c.loading : p.refresh}
              </button>
            ) : (
              <div className="ivp-foot-actions">
                <button
                  type="submit"
                  className="btn btn--outline ivp-preview-btn"
                  disabled={busy || !visible.length || saved}
                >
                  <Eye aria-hidden="true" />
                  {pending === "preview" ? c.loading : p.preview}
                </button>
                <button
                  type="button"
                  className="btn btn--primary ivx-save"
                  disabled={
                    busy || !fresh || !result?.updatedCount || result.saved
                  }
                  onClick={() => void run("bulk")}
                >
                  {pending === "bulk" ? f.saving : saved ? copy.saved : p.save}
                </button>
              </div>
            )}
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
