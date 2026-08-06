"use client";

// EPIC-023 F3 (D21, US-SPLIT-5/6) — replaces the bill-wide public share page
// (EPIC-021 Group H, #8/#10). A single `SplitBill.shareToken` could not
// distinguish which recipient was asking, so it returned the WHOLE bill
// (familyGroupId + every participant's name/amount) through one link. This
// page now keys off a `SplitParticipant`'s OWN `shareToken` and renders
// ONLY that participant's own share, its payment destination, and lets
// them file a "saya sudah transfer" claim — which moves NO money (Honest
// UI mandate). Only the owner's confirmation (on the authenticated
// `/splitbill` page) ever posts real income. Standalone public route (no
// auth, no (app) shell), mirroring /join/[token].

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StatusBadge } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";

import type {
  ParticipantStatus,
  PublicSplitParticipantDto,
} from "@wealthme/contracts";

/** Split-bill amounts round-trip through the API as decimal strings (BigInt-backed). */
function toAmount(value: string): number {
  return Number(BigInt(value));
}

function isGoneError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status?: number }).status === 410
  );
}

// EPIC-023 Group F fix round (LOW 11) — `apiFetch` only attaches `status` to
// errors it constructs from an HTTP response; a network/DNS failure throws
// a bare `TypeError` with no `status` at all. Without this check, an
// offline user saw the exact same "link not found" copy as someone who
// mistyped the URL, with no hint that retrying might actually work.
function isNetworkError(err: unknown): boolean {
  return !(typeof err === "object" && err !== null && "status" in err);
}

export default function SplitBillSharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  // EPIC-023 Group F fix round (HIGH 6) — the actual view is a separate,
  // plain-props component (`SplitShareView`) specifically so it's testable
  // without `use()`'s Promise-based Suspense, which this app's Jest/jsdom
  // setup cannot resolve (a component test rendering this page directly
  // hangs on the "loading" fallback indefinitely — verified with a minimal
  // repro; a pre-existing test-environment limitation, not a bug in this
  // component). Production behavior is unchanged: Next's router still
  // resolves `params` the same way.
  const { shareToken } = use(params);
  return <SplitShareView shareToken={shareToken} />;
}

export function SplitShareView({ shareToken }: { shareToken: string }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();

  const {
    data: participant,
    isLoading,
    isError,
    error,
  } = useQuery<PublicSplitParticipantDto>({
    queryKey: ["split-bill-participant-share", shareToken],
    queryFn: () =>
      apiFetch<PublicSplitParticipantDto>(
        `/split-bills/participant/${shareToken}`,
      ),
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: () =>
      apiFetch<PublicSplitParticipantDto>(
        `/split-bills/participant/${shareToken}/claim`,
        { method: "PATCH", body: JSON.stringify({}) },
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["split-bill-participant-share", shareToken],
        updated,
      );
      toast.success(t.splitbill.publicToastClaimed);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? t.splitbill.publicToastClaimFailedDefault);
    },
  });

  const revoked = isError && isGoneError(error);
  const networkError = isError && !revoked && isNetworkError(error);
  const notFound = isError && !revoked && !networkError;
  const amount = participant ? toAmount(participant.amountOwed) : 0;

  const statusLabel: Record<ParticipantStatus, string> = {
    pending: t.splitbill.publicStatusPendingLabel,
    claimed: t.splitbill.publicStatusClaimedLabel,
    paid: t.splitbill.publicStatusPaidLabel,
  };
  const statusVariant: Record<
    ParticipantStatus,
    "warning" | "info" | "success"
  > = {
    pending: "warning",
    claimed: "info",
    paid: "success",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[440px] rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {isLoading && (
          <div className="py-10 text-center text-[13px] text-muted-foreground">
            {t.splitbill.publicLoading}
          </div>
        )}

        {notFound && (
          <div className="py-6 text-center">
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent text-[26px]"
            >
              🔗
            </div>
            <h1 className="text-[17px] font-extrabold">
              {t.splitbill.publicNotFoundTitle}
            </h1>
            <div className="mt-2 text-[13px] text-muted-foreground">
              {t.splitbill.publicNotFoundDesc}
            </div>
          </div>
        )}

        {revoked && (
          <div className="py-6 text-center">
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-[26px]"
            >
              🚫
            </div>
            <h1 className="text-[17px] font-extrabold">
              {t.splitbill.publicRevokedTitle}
            </h1>
            <div className="mt-2 text-[13px] text-muted-foreground">
              {t.splitbill.publicRevokedDesc}
            </div>
          </div>
        )}

        {networkError && (
          <div className="py-6 text-center">
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-[26px]"
            >
              📡
            </div>
            <h1 className="text-[17px] font-extrabold">
              {t.splitbill.publicNetworkErrorTitle}
            </h1>
            <div className="mt-2 text-[13px] text-muted-foreground">
              {t.splitbill.publicNetworkErrorDesc}
            </div>
          </div>
        )}

        {participant && (
          <>
            <div className="mb-1 text-center text-[12px] font-semibold text-primary">
              {t.splitbill.publicEyebrow}
            </div>
            <h1 className="mb-4 text-center text-[19px] font-extrabold">
              {participant.billTitle}
            </h1>

            <div className="mb-4 rounded-[14px] bg-accent p-[18px] text-center">
              <div className="text-[11px] text-muted-foreground">
                {t.splitbill.publicYourShareLabel} —{" "}
                {participant.participantName}
              </div>
              <div className="text-[26px] font-black text-primary">
                {formatRupiah(amount)}
              </div>
              <div className="mt-1.5 flex justify-center">
                <StatusBadge variant={statusVariant[participant.status]}>
                  {statusLabel[participant.status]}
                </StatusBadge>
              </div>
            </div>

            <div className="mb-2 text-[12px] font-bold text-muted-foreground">
              {t.splitbill.publicPayoutTitle}
            </div>
            <div className="mb-4 rounded-[10px] border bg-background p-3.5 text-[13px]">
              {participant.payout.accountName ? (
                <div className="font-semibold">
                  {participant.payout.accountName}
                  {participant.payout.accountInstitution
                    ? ` · ${participant.payout.accountInstitution}`
                    : ""}
                  {participant.payout.accountMaskedNumber
                    ? ` · ${participant.payout.accountMaskedNumber}`
                    : ""}
                </div>
              ) : null}
              {participant.payout.instructions ? (
                <div className="mt-1 text-muted-foreground">
                  {t.splitbill.publicPayoutInstructionsLabel}:{" "}
                  {participant.payout.instructions}
                </div>
              ) : null}
              {!participant.payout.accountName &&
                !participant.payout.instructions &&
                (participant.payout.configured ? (
                  // EPIC-023 Group F fix round (HIGH 5) — the owner DID
                  // nominate a payout account (e.g. it was later deleted),
                  // so this is NOT "never configured" — telling the
                  // recipient it was never set up would be false.
                  <div className="text-muted-foreground">
                    {t.splitbill.publicPayoutUnavailable}
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    {t.splitbill.publicPayoutMissing}
                  </div>
                ))}
            </div>

            {participant.status === "pending" && (
              <div className="space-y-2">
                <button
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                  className="w-full cursor-pointer rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors disabled:opacity-50"
                >
                  {t.splitbill.publicClaimButton}
                </button>
                <div className="text-center text-[11px] text-muted-foreground">
                  {t.splitbill.publicClaimDisclaimer}
                </div>
              </div>
            )}

            {participant.status === "claimed" && (
              <div className="rounded-[10px] bg-accent px-3.5 py-3 text-center text-[12.5px] text-primary-strong">
                {t.splitbill.publicClaimedNotice}
              </div>
            )}

            {participant.status === "paid" && (
              <div className="rounded-[10px] bg-success-soft px-3.5 py-3 text-center text-[12.5px] text-success">
                {t.splitbill.publicPaidNotice}
              </div>
            )}
          </>
        )}

        <div className="mt-6 border-t pt-4 text-center text-[11px] text-muted-foreground">
          {t.splitbill.publicFooterPrefix}{" "}
          <span className="font-bold text-primary">WealthMe</span>{" "}
          {t.splitbill.publicFooterSuffix}
        </div>
      </div>
    </div>
  );
}
