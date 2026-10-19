"use client";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";
import { investmentWrite } from "../investment-api";
import type { PortfolioMember } from "../portfolio-filters";
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
  const { t } = useLocale();
  const c = t.investasi.v3;
  const d = t.investasi.detail;
  const f = t.investasi.forms;
  const [name, setName] = useState(h.name);
  const [owner, setOwner] = useState(h.ownerUserId ?? "");
  const [market, setMarket] = useState<InvestmentMarket | "">(h.market ?? "");
  const [platformId, setPlatform] = useState(h.platformAccountId ?? "");
  const [pocket, setPocket] = useState(h.cashAccountId ?? "");
  const [symbol, setSymbol] = useState(h.priceSymbol ?? "");
  const [manual, setManual] = useState(h.details?.manualInstrument ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = platforms.filter((p) => {
    const catalog = findInvestmentPlatform(p.platformKey);
    const product =
      h.type === "saham"
        ? market === "IDX"
          ? "saham_idx"
          : "saham_us"
        : h.type;
    return (
      !catalog ||
      catalog.key === "custom" ||
      catalog.products.some((v) => v === product)
    );
  });
  const pockets =
    available
      .find((p) => p.id === platformId)
      ?.pockets?.filter(
        (p) =>
          p.currency === h.currency &&
          p.status !== "closed" &&
          !p.balancesHidden,
      ) ?? [];
  const markets =
    h.type === "saham"
      ? (["IDX", "NASDAQ", "NYSE"] as const)
      : [effectiveMarketFor(h.type, null, h.currency)];
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
            market,
            platformAccountId: platformId || null,
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="iv-dialog">
        <form onSubmit={save}>
          <header className="iv-dialog-head">
            <DialogTitle>{d.completeMetadata}</DialogTitle>
            <DialogDescription>{d.metadataEffect}</DialogDescription>
          </header>
          <fieldset className="iv-form-body iv-event-fields" disabled={busy}>
            <label className="field">
              <span className="label">{f.instrumentName} *</span>
              <input
                className="input"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">{c.owner}</span>
              <select
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
            </label>
            <label className="field">
              <span className="label">{c.market} *</span>
              <select
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
            </label>
            <p>
              {d.currency}: {h.currency}
            </p>
            <label className="field">
              <span className="label">{c.platform}</span>
              <select
                className="select"
                value={platformId}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setPocket("");
                }}
              >
                <option value="">{f.choose}</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label ?? p.platformName ?? p.customName ?? p.platformKey}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">{f.pocket}</span>
              <select
                className="select"
                value={pocket}
                onChange={(e) => setPocket(e.target.value)}
              >
                <option value="">{f.choose}</option>
                {pockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.currency}
                  </option>
                ))}
              </select>
            </label>
            {(h.type === "saham" || h.type === "kripto") && (
              <>
                <label className="field">
                  <span className="label">{f.priceSymbol}</span>
                  <input
                    className="input"
                    maxLength={100}
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                  />
                </label>
                <label className="iv-check">
                  <input
                    type="checkbox"
                    checked={manual}
                    onChange={(e) => setManual(e.target.checked)}
                  />
                  {f.manualInstrument}
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </fieldset>
          <footer className="iv-form-footer">
            <button
              type="button"
              className="btn btn--outline"
              disabled={busy}
              onClick={onClose}
            >
              {f.cancel}
            </button>
            <button className="btn btn--primary" disabled={busy}>
              {busy ? f.saving : f.save}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
