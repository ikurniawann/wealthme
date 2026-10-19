"use client";
import {
  FX_CURRENCY_CODES,
  MARKETS,
  findInvestmentPlatform,
} from "@wealthme/contracts";
import type {
  FxCurrencyCode,
  InvestmentMarket,
  PlatformAccountDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import type { PortfolioMember } from "./portfolio-filters";
import type { PositionState } from "./position-state";

export function PositionAccountFields({
  value: s,
  onChange: set,
  platforms,
  members,
  isMaster,
}: {
  value: PositionState;
  onChange: (value: PositionState) => void;
  platforms: PlatformAccountDto[];
  members: PortfolioMember[];
  isMaster: boolean;
}) {
  const { t } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const platform = platforms.find((p) => p.id === s.platformId);
  const product =
    s.type === "saham"
      ? s.market === "IDX"
        ? "saham_idx"
        : "saham_us"
      : s.type;
  const available = (p: PlatformAccountDto) => {
    const catalog = findInvestmentPlatform(p.platformKey);
    return (
      !catalog ||
      catalog.key === "custom" ||
      catalog.products.some((v) => v === product)
    );
  };
  const pockets = (platform?.pockets ?? []).filter(
    (p) =>
      p.currency === s.currency && p.status !== "closed" && !p.balancesHidden,
  );
  return (
    <div className="iv-field-row">
      <label className="field">
        <span className="label">{f.instrumentName} *</span>
        <input
          className="input"
          required
          maxLength={200}
          value={s.name}
          onChange={(e) => set({ ...s, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="label">{c.owner}</span>
        <select
          className="select"
          disabled={!isMaster}
          value={s.owner}
          onChange={(e) => set({ ...s, owner: e.target.value })}
        >
          {isMaster && <option value="">{c.family}</option>}
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {["saham", "kripto"].includes(s.type) && (
        <>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={s.manual}
                onChange={(e) => set({ ...s, manual: e.target.checked })}
              />
              {f.manualInstrument}
            </span>
          </label>
          <label className="field">
            <span className="label">
              {f.ticker}
              {!s.manual ? " *" : ""}
            </span>
            <input
              className="input"
              required={!s.manual}
              maxLength={20}
              value={s.ticker}
              onChange={(e) =>
                set({ ...s, ticker: e.target.value.toUpperCase() })
              }
            />
          </label>
          {!s.manual && (
            <label className="field">
              <span className="label">{f.priceSymbol}</span>
              <input
                className="input"
                maxLength={100}
                value={s.priceSymbol}
                onChange={(e) => set({ ...s, priceSymbol: e.target.value })}
              />
            </label>
          )}
        </>
      )}
      <label className="field">
        <span className="label">{c.market} *</span>
        <select
          className="select"
          value={s.market}
          disabled={s.type !== "saham"}
          onChange={(e) => {
            const market = e.target.value as InvestmentMarket;
            set({
              ...s,
              market,
              currency: MARKETS[market].currency as FxCurrencyCode,
              unit: market === "IDX" ? "lot" : "base",
              platformId: "",
              pocketId: "",
            });
          }}
        >
          {(s.type === "saham" ? ["IDX", "NASDAQ", "NYSE"] : [s.market]).map(
            (m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="field">
        <span className="label">{f.currencyExecution} *</span>
        <select
          className="select"
          value={s.currency}
          onChange={(e) =>
            set({
              ...s,
              currency: e.target.value as FxCurrencyCode,
              pocketId: "",
              fx: "",
            })
          }
        >
          {FX_CURRENCY_CODES.map((cur) => (
            <option key={cur}>{cur}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">
          {c.platform}
          {s.mode === "buy" ? " *" : ""}
        </span>
        <select
          className="select"
          required={s.mode === "buy"}
          value={s.platformId}
          onChange={(e) => {
            const p = platforms.find((p) => p.id === e.target.value);
            set({
              ...s,
              platformId: e.target.value,
              pocketId: "",
              owner: isMaster && p ? (p.ownerUserId ?? "") : s.owner,
            });
          }}
        >
          <option value="">
            {s.mode === "buy" ? f.choose : f.optionalPlatform}
          </option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id} disabled={!available(p)}>
              {p.label ?? p.platformName ?? p.customName ?? p.platformKey}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">
          {f.pocket}
          {s.mode === "buy" ? " *" : ""}
        </span>
        <select
          className="select"
          required={s.mode === "buy"}
          value={s.pocketId}
          onChange={(e) => set({ ...s, pocketId: e.target.value })}
        >
          <option value="">{f.choose}</option>
          {pockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.currency}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
