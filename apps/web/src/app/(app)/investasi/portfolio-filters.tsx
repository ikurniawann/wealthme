"use client";
import { FX_CURRENCY_CODES, INVESTMENT_MARKET_KEYS } from "@wealthme/contracts";
import type { PlatformAccountDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { priceCopy } from "./price-copy";
import { TYPES } from "./portfolio-model";
import type { PortfolioFilters } from "./portfolio-model";

export interface PortfolioMember {
  userId: string;
  name: string;
}
export function PortfolioFilterBar({
  value,
  onChange,
  platforms,
  members,
}: {
  value: PortfolioFilters;
  onChange: (v: PortfolioFilters) => void;
  platforms: PlatformAccountDto[];
  members: PortfolioMember[];
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  // No platform accounts: say so instead of a select whose only choice is "all".
  const noPlatforms = !platforms.length;
  const fields: {
    key: keyof PortfolioFilters;
    label: string;
    options: { value: string; label: string }[];
  }[] = [
    {
      key: "ownerUserId",
      label: c.owner,
      options: members.map((m) => ({ value: m.userId, label: m.name })),
    },
    {
      key: "platformAccountId",
      label: c.platform,
      options: platforms.map((p) => ({
        value: p.id,
        label: p.label ?? p.platformName ?? p.customName ?? p.platformKey,
      })),
    },
    {
      key: "type",
      label: c.type,
      options: TYPES.map((type) => ({ value: type, label: c[type] })),
    },
    {
      key: "market",
      label: c.market,
      options: INVESTMENT_MARKET_KEYS.map((m) => ({ value: m, label: m })),
    },
    {
      key: "displayCurrency",
      label: c.currency,
      options: FX_CURRENCY_CODES.map((currency) => ({
        value: currency,
        label: currency,
      })),
    },
  ];
  return (
    <div className="iv-card iv-filters">
      {fields.map((f) => (
        <label className="field" key={f.key}>
          <span className="label">{f.label}</span>
          <select
            className="select"
            value={value[f.key]}
            disabled={f.key === "platformAccountId" && noPlatforms}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          >
            {f.key !== "displayCurrency" && (
              <option value="">
                {f.key === "platformAccountId" && noPlatforms
                  ? priceCopy(locale).noPlatformsShort
                  : c.all}
              </option>
            )}
            {f.options.map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
