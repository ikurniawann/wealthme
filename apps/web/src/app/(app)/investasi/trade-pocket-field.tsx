"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wallet } from "lucide-react";
import type {
  PlatformAccountDto,
  PlatformPocketDto,
} from "@wealthme/contracts";
import type { InvestmentFormsCopy } from "@/i18n/investment-forms";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { useMyRole } from "@/hooks/use-my-role";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { PlatformForm } from "./platform-form";
import type { PortfolioMember } from "./portfolio-filters";
import { money } from "./portfolio-model";
import { tradeCopy } from "./trade-copy";
import { useInvestmentInvalidation } from "./use-investment-invalidation";

export interface PocketChoice {
  platform: PlatformAccountDto;
  pocket: PlatformPocketDto;
}

export const platformName = (p: PlatformAccountDto) =>
  p.label ?? p.platformName ?? p.customName ?? p.platformKey;

/** "Ajaib · RDN" — platform account plus the pocket's kind. */
export function pocketLabel(
  platform: PlatformAccountDto,
  pocket: PlatformPocketDto,
  f: Pick<InvestmentFormsCopy, PlatformPocketDto["pocketKind"]>,
) {
  return `${platformName(platform)} · ${f[pocket.pocketKind] ?? pocket.name}`;
}

/** Pockets a buy can debit / a sale can credit: same currency, open, visible. */
export function pocketChoices(
  platforms: PlatformAccountDto[],
  currency: string,
  platformId: string,
): PocketChoice[] {
  return platforms
    .filter((p) => !platformId || p.id === platformId)
    .flatMap((platform) =>
      (platform.pockets ?? [])
        .filter(
          (pocket) =>
            pocket.currency === currency &&
            pocket.status !== "closed" &&
            !pocket.balancesHidden,
        )
        .map((pocket) => ({ platform, pocket })),
    );
}

/**
 * "Kantong dana platform" picker shared by the add-investment drawer and the
 * buy/sell dialog. Never a dead end: with no usable pocket it explains why
 * and opens the platform form (the same one Top up uses) to add the platform
 * or the pocket; the created pocket is picked as soon as it loads.
 */
export function TradePocketField({
  id,
  platforms,
  currency,
  platformId,
  value,
  onPick,
  fg,
  token,
  invalid = false,
  required = true,
}: {
  id: string;
  platforms: PlatformAccountDto[];
  currency: string;
  /** Restrict to one platform account ("" = every eligible platform). */
  platformId: string;
  value: string;
  /** The platform is omitted for a pocket created here: it arrives with the
   *  next platforms refetch, and the caller resolves it from the pocket id. */
  onPick: (pocketId: string, platform?: PlatformAccountDto) => void;
  fg: string;
  token: string;
  invalid?: boolean;
  /** "Lengkapi data kepemilikan" may leave the pocket empty. */
  required?: boolean;
}) {
  const { t, locale } = useLocale();
  const f = t.investasi.forms;
  const copy = tradeCopy(locale);
  const { hideBalance } = useMoney();
  const { data: session } = useSession();
  const { myRole } = useMyRole();
  const { canManage } = useCanManage("Investment");
  const invalidate = useInvestmentInvalidation();
  const members = useQuery({
    queryKey: ["investment-members", fg, token],
    queryFn: () =>
      apiFetch<PortfolioMember[]>(`/family-groups/${fg}/members`, { token }),
    enabled: !!canManage,
  });
  const [adding, setAdding] = useState<{
    platform: PlatformAccountDto | null;
  } | null>(null);
  const choices = pocketChoices(platforms, currency, platformId);
  const restricted = platforms.find((p) => p.id === platformId) ?? null;

  const fmt = (v: string | null | undefined) =>
    money(v, "IDR", locale, hideBalance);
  const chosen = choices.find((c) => c.pocket.id === value);

  const dialog = adding && (
    <PlatformForm
      fg={fg}
      token={token}
      members={members.data ?? []}
      myUserId={session?.userId ?? ""}
      isMaster={myRole === "owner" || myRole === "spouse"}
      platform={adding.platform}
      onClose={() => setAdding(null)}
      onSaved={(created?: { pocketId?: string }) => {
        invalidate();
        if (created?.pocketId) onPick(created.pocketId);
      }}
    />
  );

  if (choices.length === 0) {
    const targets = restricted ? [restricted] : platforms.slice(0, 3);
    return (
      <div className="ivx-empty" role="status" id={id}>
        <span className="ivx-empty-ic" aria-hidden="true">
          <Wallet />
        </span>
        <div className="ivx-empty-text">
          <strong>
            {platforms.length === 0
              ? copy.noPlatformTitle
              : copy.noPocketTitle(currency)}
          </strong>
          <p>{canManage ? copy.noPocketBody : copy.noPocketReadOnly}</p>
          {canManage && (
            <div className="ivx-empty-actions">
              {targets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setAdding({ platform: p })}
                >
                  <Plus aria-hidden="true" />
                  {copy.addPocketTo(platformName(p))}
                </button>
              ))}
              {!restricted && (
                <button
                  type="button"
                  className={`btn ${targets.length ? "btn--outline" : "btn--primary"}`}
                  onClick={() => setAdding({ platform: null })}
                >
                  <Plus aria-hidden="true" />
                  {copy.addPlatformPocket}
                </button>
              )}
            </div>
          )}
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <>
      <select
        id={id}
        className="select"
        required={required}
        aria-invalid={invalid || undefined}
        value={chosen ? value : ""}
        onChange={(e) => {
          const next = choices.find((c) => c.pocket.id === e.target.value);
          if (next) onPick(next.pocket.id, next.platform);
        }}
      >
        <option value="">{f.choose}</option>
        {choices.map(({ platform, pocket }) => (
          <option key={pocket.id} value={pocket.id}>
            {pocketLabel(platform, pocket, f)} · {pocket.currency} ·{" "}
            {pocket.heldIncomplete ? "—" : fmt(pocket.availableBalance)}
          </option>
        ))}
      </select>
      {canManage && (
        <button
          type="button"
          className="ivx-link"
          onClick={() => setAdding({ platform: restricted })}
        >
          <Plus aria-hidden="true" />
          {restricted
            ? copy.addPocketTo(platformName(restricted))
            : copy.addPlatformPocket}
        </button>
      )}
      {dialog}
    </>
  );
}
