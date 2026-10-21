"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Info, Lock } from "lucide-react";
import {
  MARKETS,
  effectiveMarketFor,
  findInvestmentPlatform,
} from "@wealthme/contracts";
import type {
  InvestmentDto,
  InvestmentMarket,
  PlatformAccountDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";
import { investmentWrite } from "../investment-api";
import { Field } from "../investment-fields";
import { DialogSection, InvestDialogShell } from "../dialog-shell";
import { dialogCopy } from "../dialog-copy";
import { TradePocketField, platformName } from "../trade-pocket-field";
import type { PortfolioMember } from "../portfolio-filters";

/**
 * "Lengkapi data kepemilikan": a legacy holding gets its market, platform
 * account and cash pocket so new transactions can be recorded. Quantities,
 * cost basis and history are untouched (the PATCH only sets labels).
 */
export function DetailMetadata({
  holding: h,
  platforms,
  members,
  isMaster,
  fg,
  token,
  onClose,
  onSaved,
}: {
  holding: InvestmentDto;
  platforms: PlatformAccountDto[];
  members: PortfolioMember[];
  isMaster: boolean;
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const d = t.investasi.detail;
  const f = t.investasi.forms;
  const copy = dialogCopy(locale);
  const markets: readonly InvestmentMarket[] =
    h.type === "saham"
      ? (["IDX", "NASDAQ", "NYSE"] as const)
      : [effectiveMarketFor(h.type, null, h.currency)];
  const [name, setName] = useState(h.name);
  const [ticker, setTicker] = useState(h.ticker);
  const [owner, setOwner] = useState(h.ownerUserId ?? "");
  // A non-stock holding has exactly one valid market: start on it.
  const [market, setMarket] = useState<InvestmentMarket | "">(
    h.market ?? (markets.length === 1 ? markets[0]! : ""),
  );
  const [platformId, setPlatform] = useState(h.platformAccountId ?? "");
  const [pocket, setPocket] = useState(h.cashAccountId ?? "");
  const [symbol, setSymbol] = useState(h.priceSymbol ?? "");
  const [manual, setManual] = useState(h.details?.manualInstrument ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const product =
    h.type === "saham" ? (market === "IDX" ? "saham_idx" : "saham_us") : h.type;
  const available = platforms.filter((p) => {
    const catalog = findInvestmentPlatform(p.platformKey);
    return (
      !catalog ||
      catalog.key === "custom" ||
      catalog.products.some((v) => v === product)
    );
  });
  // A pocket created from the empty state arrives without its platform:
  // resolve the owning account from the pocket.
  const platformOfPocket = pocket
    ? platforms.find((p) => p.pockets?.some((k) => k.id === pocket))?.id
    : undefined;
  const effectivePlatform = platformId || platformOfPocket || "";
  const priced = h.type === "saham" || h.type === "kripto";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await investmentWrite(
        `/family-groups/${fg}/investments/${h.id}/metadata`,
        {
          token,
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            ...(ticker.trim() ? { ticker: ticker.trim().toUpperCase() } : {}),
            market,
            platformAccountId: effectivePlatform || null,
            cashAccountId: pocket || null,
            ...(isMaster ? { ownerUserId: owner || null } : {}),
            priceSymbol: symbol.trim() || null,
            manualInstrument: manual,
          }),
        },
      );
      toast.success(d.metadataSaved);
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, f.failed));
      setBusy(false);
    }
  }

  return (
    <InvestDialogShell
      title={h.market ? d.editHolding : d.completeMetadata}
      subtitle={`${h.name} · ${copy.metaSub}`}
      icon={<ClipboardCheck />}
      busy={busy}
      submitLabel={f.save}
      onClose={onClose}
      onSubmit={save}
    >
      <div className="ivx-strip" data-multi="">
        <Info aria-hidden="true" />
        <p>
          <strong>{copy.metaWhy}</strong>
          <span>{copy.metaKeeps}</span>
        </p>
      </div>
      <DialogSection title={copy.identity}>
        <div className="ivx-grid">
          <Field label={f.instrumentName} required hint={copy.nameHint}>
            {(id) => (
              <input
                id={id}
                className="input"
                required
                maxLength={200}
                autoComplete="off"
                enterKeyHint="next"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label={f.ticker} required={priced && !manual}>
            {(id) => (
              <input
                id={id}
                className="input mono"
                required={priced && !manual}
                maxLength={20}
                pattern="[A-Za-z0-9._\-]+"
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint="next"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field
            label={c.owner}
            hint={isMaster ? copy.ownerHint : copy.ownerLocked}
          >
            {(id) => (
              <select
                id={id}
                className="select"
                disabled={!isMaster}
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="">{c.family}</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </DialogSection>
      <DialogSection title={copy.marketPlatform}>
        <div className="ivx-grid">
          <Field label={c.market} required hint={copy.currencyHint(h.currency)}>
            {(id) => (
              <div className="ivx-pair">
                <select
                  id={id}
                  className="select"
                  value={market}
                  required
                  onChange={(e) => {
                    setMarket(e.target.value as InvestmentMarket);
                    setPlatform("");
                    setPocket("");
                  }}
                >
                  <option value="">{f.choose}</option>
                  {markets.map((m) => (
                    <option key={m} value={m}>
                      {m} · {MARKETS[m].currency}
                    </option>
                  ))}
                </select>
                <span
                  className="ivx-chip"
                  role="note"
                  aria-label={copy.currencyChip(h.currency)}
                  title={copy.currencyChip(h.currency)}
                >
                  <Lock aria-hidden="true" />
                  {h.currency}
                </span>
              </div>
            )}
          </Field>
          <Field label={c.platform} hint={copy.platformHint}>
            {(id) => (
              <select
                id={id}
                className="select"
                value={effectivePlatform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setPocket("");
                }}
              >
                <option value="">{copy.platformAny}</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {platformName(p)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={f.pocket} hint={copy.pocketHint} wide>
            {(id) => (
              <TradePocketField
                id={id}
                platforms={available}
                currency={h.currency}
                platformId={effectivePlatform}
                value={pocket}
                required={false}
                onPick={(pocketId, platform) => {
                  setPocket(pocketId);
                  if (platform) setPlatform(platform.id);
                }}
                fg={fg}
                token={token}
              />
            )}
          </Field>
        </div>
      </DialogSection>
      {priced && (
        <DialogSection title={copy.priceSource}>
          <div className="ivx-grid">
            <Field label={f.priceSymbol} hint={copy.symbolHint} wide>
              {(id) => (
                <input
                  id={id}
                  className="input"
                  maxLength={100}
                  autoComplete="off"
                  autoCapitalize="characters"
                  enterKeyHint="done"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                />
              )}
            </Field>
          </div>
          <label className="ivx-check">
            <input
              type="checkbox"
              checked={manual}
              onChange={(e) => setManual(e.target.checked)}
            />
            {f.manualInstrument}
          </label>
        </DialogSection>
      )}
      {error && (
        <p role="alert" className="error-text ivx-error">
          {error}
        </p>
      )}
    </InvestDialogShell>
  );
}
