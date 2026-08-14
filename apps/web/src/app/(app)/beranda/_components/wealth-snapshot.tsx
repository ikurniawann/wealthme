"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, Droplets, Landmark } from "lucide-react";
import type { LiabilityDto } from "@wealthme/contracts";
import { CardLink, SectionCard, StatusBadge } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import type { MoneyFormatters } from "./use-beranda-data";

/**
 * EPIC-025 N3-G1 / EPIC-026 Wave 8 — prototype's `.card.bento-snapshot`
 * ("Komposisi Kekayaan"): two `.snapshot-row`s plus the `.notice--warning`
 * due-date link. The liquid/non-liquid split is derived from the already
 * fetched `summary.accountSummary` — no new endpoint.
 */
export function WealthSnapshot({
  isLoading,
  liquidTotal,
  nonLiquidTotal,
  liquidPct,
  nonLiquidPct,
  nearestDueLiability,
  fmt,
}: {
  isLoading: boolean;
  liquidTotal: number;
  nonLiquidTotal: number;
  liquidPct: number;
  nonLiquidPct: number;
  nearestDueLiability: LiabilityDto | undefined;
  fmt: MoneyFormatters;
}) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <SectionCard
      className="bento-snapshot"
      title={t.beranda.wealthComposition}
      action={
        <CardLink onClick={() => router.push("/ringkasan")}>
          {t.beranda.viewSummaryLink}
        </CardLink>
      }
    >
      {isLoading ? (
        <div className="t-md t-muted flex h-[105px] items-center justify-center">
          {t.common.loading}
        </div>
      ) : (
        <>
          <div className="snapshot-row">
            <span className="snapshot-row__icon">
              <Droplets className="size-4" aria-hidden="true" />
            </span>
            <span className="snapshot-row__body">
              <span className="snapshot-row__label">
                {t.beranda.liquidAssets} · {liquidPct}%
              </span>
              <span className="snapshot-row__value mono">
                {fmt.moneyCompact(liquidTotal)}
              </span>
            </span>
            <StatusBadge variant="success">
              {t.beranda.liquidBadgeLabel}
            </StatusBadge>
          </div>

          <div className="snapshot-row">
            <span
              className="snapshot-row__icon"
              style={{ color: "var(--brand-purple)" }}
            >
              <Landmark className="size-4" aria-hidden="true" />
            </span>
            <span className="snapshot-row__body">
              <span className="snapshot-row__label">
                {t.beranda.nonLiquidAssets} · {nonLiquidPct}%
              </span>
              <span className="snapshot-row__value mono">
                {fmt.moneyCompact(nonLiquidTotal)}
              </span>
            </span>
            <StatusBadge variant="purple">
              {t.beranda.nonLiquidBadgeLabel}
            </StatusBadge>
          </div>

          {/* EPIC-025 N3 fidelity follow-up — the prototype's due-date notice
              link under the composition rows, reusing the same
              `nearestDueLiability` the "Perlu Perhatian" card also derives. */}
          {nearestDueLiability && (
            <button
              type="button"
              onClick={() => router.push("/liabilitas")}
              className="notice notice--warning w-full cursor-pointer items-center text-left"
            >
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>{nearestDueLiability.name}</strong>{" "}
                {t.beranda.liabilityDueNotice}{" "}
                {new Date(nearestDueLiability.dueDate!).toLocaleDateString(
                  t.beranda.dateLocale,
                  { day: "numeric", month: "short" },
                )}
                .
              </span>
            </button>
          )}
        </>
      )}
    </SectionCard>
  );
}
