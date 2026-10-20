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
import { Field } from "./investment-fields";
import type { PortfolioMember } from "./portfolio-filters";
import type { PositionState } from "./position-state";
import { platformName } from "./trade-pocket-field";

/** Catalog product key a platform must offer for this position. */
function productFor(s: PositionState) {
  if (s.type !== "saham") return s.type;
  return s.market === "IDX" ? "saham_idx" : "saham_us";
}

/** Platforms whose catalog offers the product (custom ones always do). */
export function platformsFor(
  platforms: PlatformAccountDto[],
  s: PositionState,
): PlatformAccountDto[] {
  const product = productFor(s);
  return platforms.filter((p) => {
    const catalog = findInvestmentPlatform(p.platformKey);
    return (
      !catalog ||
      catalog.key === "custom" ||
      catalog.products.some((v) => v === product)
    );
  });
}

/** Owner, platform account, market, currency and instrument identity. */
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
  const usable = platformsFor(platforms, s);
  const listed = ["saham", "kripto"].includes(s.type);
  return (
    <>
      <Field label={c.owner}>
        {(id) => (
          <select
            id={id}
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
        )}
      </Field>
      <Field label={c.platform} required={s.mode === "buy"}>
        {(id) => (
          <select
            id={id}
            className="select"
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
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {platformName(p)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={c.market} required>
        {(id) => (
          <select
            id={id}
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
                quantity: "",
                platformId: "",
                pocketId: "",
                fx: "",
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
        )}
      </Field>
      <Field label={f.currencyExecution} required>
        {(id) => (
          <select
            id={id}
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
        )}
      </Field>
      {listed && (
        <Field label={f.ticker} required={!s.manual}>
          {(id) => (
            <input
              id={id}
              className="input mono"
              enterKeyHint="next"
              required={!s.manual}
              maxLength={20}
              autoCapitalize="characters"
              autoComplete="off"
              value={s.ticker}
              onChange={(e) =>
                set({ ...s, ticker: e.target.value.toUpperCase() })
              }
            />
          )}
        </Field>
      )}
      <Field label={f.instrumentName} required>
        {(id) => (
          <input
            id={id}
            className="input"
            enterKeyHint="next"
            required
            maxLength={200}
            value={s.name}
            onChange={(e) => set({ ...s, name: e.target.value })}
          />
        )}
      </Field>
      {listed && !s.manual && (
        <Field label={f.priceSymbol}>
          {(id) => (
            <input
              id={id}
              className="input mono"
              enterKeyHint="next"
              maxLength={100}
              autoComplete="off"
              value={s.priceSymbol}
              onChange={(e) => set({ ...s, priceSymbol: e.target.value })}
            />
          )}
        </Field>
      )}
      {listed && (
        <label className="ivx-check" data-wide>
          <input
            type="checkbox"
            checked={s.manual}
            onChange={(e) => set({ ...s, manual: e.target.checked })}
          />
          <span>{f.manualInstrument}</span>
        </label>
      )}
    </>
  );
}
