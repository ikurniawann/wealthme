"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, CheckCheck } from "lucide-react";
import type { LiabilityDto } from "@wealthme/contracts";
import { SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

/**
 * EPIC-026 Wave 8 — prototype's second `.bento-side` card ("Perlu Perhatian"),
 * a stack of `.notice` links.
 *
 * Honest UI: the prototype's third notice is an insurance-premium due date.
 * Nothing in the dashboard/liability feeds carries an insurance premium due
 * date, so that row is omitted rather than faked. The two rows below are real
 * derivations from lists /persetujuan and /liabilitas already fetch.
 */
export function AttentionCard({
  isLoading,
  pendingApprovalsCount,
  nearestDueLiability,
}: {
  isLoading: boolean;
  pendingApprovalsCount: number;
  nearestDueLiability: LiabilityDto | undefined;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const hasNotices = pendingApprovalsCount > 0 || !!nearestDueLiability;

  return (
    <SectionCard
      title={t.beranda.needsAttentionTitle}
      bodyClassName="stack"
      // Hardening batch G5 (Von Restorff) — this is the one time-sensitive
      // card among ~9 otherwise visually-identical bento cards; give it a
      // warning accent when it actually has something to flag, so it
      // doesn't read the same as a plain white card like Budget's.
      className={
        hasNotices ? "border-warning/50 bg-warning-soft/40" : undefined
      }
    >
      {isLoading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-[42px] animate-pulse rounded-md bg-muted"
            aria-hidden="true"
          />
        ))
      ) : pendingApprovalsCount === 0 && !nearestDueLiability ? (
        <div className="t-md t-muted py-4 text-center">
          {t.beranda.noNotices}
        </div>
      ) : (
        <>
          {pendingApprovalsCount > 0 && (
            <button
              type="button"
              onClick={() => router.push("/persetujuan")}
              className="notice notice--warning w-full cursor-pointer items-center text-left"
            >
              <CheckCheck className="size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>{pendingApprovalsCount}</strong>{" "}
                {t.beranda.pendingApprovalsNotice}
              </span>
            </button>
          )}
          {nearestDueLiability && (
            <button
              type="button"
              onClick={() => router.push("/liabilitas")}
              className="notice notice--info w-full cursor-pointer items-center text-left"
            >
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>{nearestDueLiability.name}</strong>{" "}
                {t.beranda.liabilityDueNotice}{" "}
                {new Date(
                  // E2E round 1 bug 2 — prefer the real `nextDueDate` over
                  // the legacy manual `dueDate` field.
                  (nearestDueLiability.nextDueDate ??
                    nearestDueLiability.dueDate)!,
                ).toLocaleDateString(t.beranda.dateLocale, {
                  day: "numeric",
                  month: "short",
                })}
                .
              </span>
            </button>
          )}
        </>
      )}
    </SectionCard>
  );
}
