"use client";

import { useMemo, useState } from "react";
import { Plus, X, Link2, TriangleAlert, Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AddTile,
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTile,
  BentoTiles,
  GhostButton,
  HeroKpi,
  MiniList,
  MiniRow,
  PillButton,
  StatusBadge,
  TipsCard,
  Track,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { Split as SplitIcon } from "lucide-react";
import "./splitbill.css";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogClose,
  PanelContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/crud";
import {
  MoneyInput,
  idrPreview,
  toCanonicalAmount,
  useMoneyField,
  formatMoneyTyping,
} from "@/components/money";
import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import { formatAxisCompact, parseRupiah, formatRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  amountsMatchTotal,
  computeRemainder,
  splitEqually,
  splitRemainderEvenly,
  type CustomAmounts,
} from "./split-math";

import {
  formatScaled,
  parseMinor,
  type AccountDto,
  type SplitBillDto,
  type CreateSplitBillDto as BaseCreateSplitBillDto,
  type SplitParticipantDto,
  type UpdatePayoutAccountDto,
  type FxInput,
} from "@wealthme/contracts";

/** Task 10b (revisi I, Decision 10) — one currency per bill: totalAmount plus
 * every participant.N.amountOwed convert in that same currency. */
type CreateSplitBillDto = BaseCreateSplitBillDto & { fxInputs?: FxInput[] };

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#10B981,#06B6D4)",
  "linear-gradient(135deg,#F59E0B,#FBBF24)",
  "linear-gradient(135deg,#6366F1,#8B5CF6)",
  "linear-gradient(135deg,#EC4899,#F43F5E)",
];

type LocalParticipant = { localId: number; name: string };

let participantSeq = 0;
function makeParticipant(name: string): LocalParticipant {
  return { localId: ++participantSeq, name };
}

function computePaidAmount(split: SplitBillDto): number {
  return split.participants
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(BigInt(p.amountOwed)), 0);
}

function computePct(split: SplitBillDto): number {
  const total = Number(BigInt(split.totalAmount));
  if (total === 0) return 0;
  return Math.round((computePaidAmount(split) / total) * 100);
}

export default function SplitBillPage() {
  const { t, locale } = useLocale();
  const { handleError } = useApiError();
  const money = useMoney();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId as string | undefined;
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSplit, setSelectedSplit] = useState<SplitBillDto | null>(null);
  // EPIC-023 Group F fix round (HIGH 1) — revoking a link is cosmetic (no
  // money moves), but confirming a payment posts irreversible real income
  // with no un-confirm endpoint. Both now go through the SAME real
  // confirmation dialog (ConfirmDeleteDialog) instead of one being a
  // native `window.confirm` and the other firing on a single click.
  const [revokeTarget, setRevokeTarget] = useState<SplitBillDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SplitBillDto | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    splitId: string;
    participantId: string;
    participantName: string;
  } | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (splitId: string) =>
      apiFetch<void>(`/family-groups/${familyGroupId}/split-bills/${splitId}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: (_data, splitId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.splitBills.list(familyGroupId ?? ""),
      });
      setSelectedSplit((prev) => (prev && prev.id === splitId ? null : prev));
      toast.success(t.splitbill.toastSplitDeleted);
    },
    onError: handleError,
  });

  // Group F (task F3) — repairs a bill whose payoutAccountId is null or
  // points at a deleted account.
  const [editPayoutOpen, setEditPayoutOpen] = useState(false);
  const [editPayoutAccountId, setEditPayoutAccountId] = useState("");

  // Create modal state
  const [title, setTitle] = useState("");
  const totalField = useMoneyField();
  const [method, setMethod] = useState<"equal" | "custom">("equal");
  // NOTE: "Andi"/"Budi"/"Citra" are example seed names for the participant
  // rows (freely editable by the user before creating the split), not UI
  // chrome — kept as-is in both locales, matching the value-locked
  // example-data convention.
  const [participants, setParticipants] = useState<LocalParticipant[]>(() => [
    makeParticipant("Andi"),
    makeParticipant("Budi"),
    makeParticipant("Citra"),
  ]);
  const [customAmounts, setCustomAmounts] = useState<CustomAmounts>({});
  // EPIC-023 F3 (D21) — the account/instructions the owner nominates for
  // recipients to pay into; rendered on every participant's own share link
  // and credited for real once the owner confirms their claim.
  const [payoutAccountId, setPayoutAccountId] = useState("");
  const [payoutInstructions, setPayoutInstructions] = useState("");

  const billCurrency = totalField.currency;
  const billDecimals = totalField.decimals;
  /** Integer units in the bill currency: rupiah for IDR (unchanged parse), minor units otherwise. */
  const toUnits = (raw: string): number =>
    billCurrency === "IDR"
      ? parseRupiah(raw)
      : Number(parseMinor(toCanonicalAmount(raw) ?? "0", billCurrency));
  const totalNum = toUnits(totalField.raw);
  const customUnits = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(customAmounts).map(([k, v]) => [k, String(toUnits(v))]),
      ) as CustomAmounts,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toUnits closes over billCurrency, already a dep.
    [customAmounts, billCurrency],
  );
  const unitsLabel = (units: number): string =>
    billCurrency === "IDR"
      ? formatRupiah(units)
      : `${billCurrency} ${formatScaled(BigInt(units), billDecimals).replace(".", ",")}`;
  const participantIds = useMemo(
    () => participants.map((p) => p.localId),
    [participants],
  );
  // One exact share per participant (see `splitEqually`) — an uneven bill
  // leaves the first few people paying Rp 1 more, which is why each row shows
  // its OWN share rather than one rounded figure repeated down the list.
  const equalShares = useMemo(
    () =>
      method === "equal" ? splitEqually(totalNum, participants.length) : [],
    [totalNum, participants.length, method],
  );
  const perPerson = equalShares[equalShares.length - 1] ?? 0;
  // Live remainder for the custom-split calculator (item #10) — how much of
  // the total is still unallocated across the per-person amount inputs.
  const customRemainder = useMemo(
    () => computeRemainder(totalNum, participantIds, customUnits),
    [totalNum, participantIds, customUnits],
  );

  function addParticipant() {
    const newP = makeParticipant(
      `${t.splitbill.defaultParticipantName} ${participants.length + 1}`,
    );
    setParticipants((prev) => [...prev, newP]);
  }

  function removeParticipant(localId: number) {
    setParticipants((prev) =>
      prev.length > 2 ? prev.filter((p) => p.localId !== localId) : prev,
    );
    setCustomAmounts((prev) => {
      const next = { ...prev };
      delete next[localId];
      return next;
    });
  }

  function renameParticipant(localId: number, name: string) {
    setParticipants((prev) =>
      prev.map((p) => (p.localId === localId ? { ...p, name } : p)),
    );
  }

  /** A units-domain integer back into the bill currency's typed display string. */
  const unitsToRaw = (units: number): string =>
    billCurrency === "IDR"
      ? formatMoneyTyping(String(units), 0)
      : formatMoneyTyping(
          formatScaled(BigInt(units), billDecimals).replace(".", ","),
          billDecimals,
        );

  // "Bagi rata sisa" — fills every participant who hasn't entered an amount
  // yet with an even share of whatever remains from the total. Operates in
  // the bill currency's minor units, then converts each newly-filled share
  // back to a typed display string (Decision 10).
  function handleSplitRemainderEvenly() {
    const filled = splitRemainderEvenly(totalNum, participantIds, customUnits);
    setCustomAmounts((prev) => {
      const next = { ...prev };
      for (const id of participantIds) {
        if (filled[id] !== customUnits[id]) {
          // `filled[id]` is id-ID-grouped ("1.234"), not a plain number
          // string — `Number()` would misread the "." as a decimal point,
          // shrinking any fill >= 1000 minor units by ~1000x. `parseRupiah`
          // strips every non-digit, which is exact here since this fill is
          // always a non-negative integer unit count.
          const units = parseRupiah(filled[id]);
          next[id] = units > 0 ? unitsToRaw(units) : (prev[id] ?? "");
        }
      }
      return next;
    });
  }

  function resetCreateForm() {
    setTitle("");
    totalField.reset();
    setMethod("equal");
    setParticipants([
      makeParticipant("Andi"),
      makeParticipant("Budi"),
      makeParticipant("Citra"),
    ]);
    setCustomAmounts({});
    setPayoutAccountId("");
    setPayoutInstructions("");
  }

  // Accounts — the owner picks one as this bill's payout destination
  // (EPIC-023 F3 / D21), same pattern as /donation's optional source
  // account picker.
  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: familyGroupId
      ? queryKeys.accounts.all(familyGroupId)
      : ["accounts-disabled"],
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  // List query
  const {
    data: splits,
    isLoading,
    isError,
  } = useQuery<SplitBillDto[]>({
    queryKey: queryKeys.splitBills.list(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<SplitBillDto[]>(
        `/family-groups/${familyGroupId}/split-bills`,
        { token, signal },
      );
    },
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (dto: CreateSplitBillDto) =>
      apiFetch<SplitBillDto>(`/family-groups/${familyGroupId}/split-bills`, {
        method: "POST",
        token,
        body: JSON.stringify(dto),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.splitBills.list(familyGroupId ?? ""),
      });
      toast.success(t.splitbill.toastCreated);
      setCreateOpen(false);
      resetCreateForm();
      setSelectedSplit(created);
    },
    onError: handleError,
  });

  // EPIC-023 F3 (D21) — "confirm" (renamed from "settle"): posts a REAL
  // Transaction crediting the bill's payout account, not just a status
  // flip. "The owner confirms, and only then does it become real income."
  const confirmMutation = useMutation({
    mutationFn: ({
      splitId,
      participantId,
    }: {
      splitId: string;
      participantId: string;
    }) =>
      apiFetch<SplitParticipantDto>(
        `/family-groups/${familyGroupId}/split-bills/${splitId}/participants/${participantId}/confirm`,
        { method: "PATCH", token, body: JSON.stringify({}) },
      ),
    onSuccess: (updated, { splitId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.splitBills.list(familyGroupId ?? ""),
      });
      // Confirming posts a real income Transaction, so every account
      // balance view elsewhere must see the credited payout account too.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
      });
      // EPIC-023 Group F fix round (HIGH 2) — a real income Transaction was
      // posted; the dashboard summary and net worth (and the transaction
      // list itself) must reflect it too, same as donation/page.tsx's
      // identical create mutation does for the same class of side effect.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(familyGroupId ?? ""),
      });
      // Update selectedSplit optimistically so the detail modal reflects the change
      setSelectedSplit((prev) => {
        if (!prev || prev.id !== splitId) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === updated.id
              ? {
                  ...p,
                  status: updated.status,
                  claimedAt: updated.claimedAt,
                  paidAt: updated.paidAt,
                }
              : p,
          ),
        };
      });
      toast.success(t.splitbill.toastSettled);
    },
    onError: handleError,
  });

  // EPIC-023 F3 (D21) — "revocable": kills every participant's share link
  // for this bill at once.
  const revokeMutation = useMutation({
    mutationFn: (splitId: string) =>
      apiFetch<SplitBillDto>(
        `/family-groups/${familyGroupId}/split-bills/${splitId}/revoke`,
        { method: "PATCH", token, body: JSON.stringify({}) },
      ),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.splitBills.list(familyGroupId ?? ""),
      });
      setSelectedSplit((prev) =>
        prev && prev.id === updated.id ? updated : prev,
      );
      toast.success(t.splitbill.toastRevoked);
    },
    onError: handleError,
  });

  // Group F (task F3) — repairs a bill whose payoutAccountId is null or
  // points at a deleted account (create() requires one, but there was no
  // way to fix it afterward). Same tenant-scoped endpoint as create().
  const updatePayoutAccountMutation = useMutation({
    mutationFn: ({
      splitId,
      dto,
    }: {
      splitId: string;
      dto: UpdatePayoutAccountDto;
    }) =>
      apiFetch<SplitBillDto>(
        `/family-groups/${familyGroupId}/split-bills/${splitId}`,
        { method: "PATCH", token, body: JSON.stringify(dto) },
      ),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.splitBills.list(familyGroupId ?? ""),
      });
      setSelectedSplit((prev) =>
        prev && prev.id === updated.id ? updated : prev,
      );
      toast.success(t.splitbill.toastPayoutAccountUpdated);
      setEditPayoutOpen(false);
    },
    onError: (err: { message?: string }) => {
      toast.error(
        err.message ?? t.splitbill.toastPayoutAccountUpdateFailedDefault,
      );
    },
  });

  function handleRevoke(split: SplitBillDto) {
    setRevokeTarget(split);
  }

  function handleOpenEditPayout(split: SplitBillDto) {
    setEditPayoutAccountId(split.payoutAccountId ?? "");
    setEditPayoutOpen(true);
  }

  function handleSavePayoutAccount() {
    if (!selectedSplit || !editPayoutAccountId) return;
    updatePayoutAccountMutation.mutate({
      splitId: selectedSplit.id,
      dto: { payoutAccountId: editPayoutAccountId },
    });
  }

  function handleCreate() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.warning(t.splitbill.toastTitleRequired);
      return;
    }
    if (totalNum <= 0) {
      toast.warning(t.splitbill.toastTotalRequired);
      return;
    }
    if (participants.length < 2) {
      toast.warning(t.splitbill.toastMinParticipants);
      return;
    }
    if (!payoutAccountId) {
      toast.warning(t.splitbill.toastPayoutAccountRequired);
      return;
    }
    if (
      method === "custom" &&
      !amountsMatchTotal(totalNum, participantIds, customUnits)
    ) {
      const diff = computeRemainder(totalNum, participantIds, customUnits);
      const diffLabel =
        diff > 0
          ? `kurang ${unitsLabel(diff)}`
          : `lebih ${unitsLabel(Math.abs(diff))}`;
      toast.warning(
        `Jumlah per orang belum sama dengan total tagihan (${diffLabel}).`,
      );
      return;
    }
    if (totalField.resolved.isPending) return;

    const unitsPerParticipant: number[] =
      method === "equal"
        ? participants.map((_, i) => equalShares[i] ?? 0)
        : participants.map((p) => toUnits(customAmounts[p.localId] ?? "0"));
    const canonicalOf = (units: number) =>
      formatScaled(BigInt(units), billDecimals);
    const idrOf = (units: number): number =>
      billCurrency === "IDR"
        ? units
        : Number(
            idrPreview(canonicalOf(units), billCurrency, totalField.rates, 0) ??
              BigInt(0),
          );
    const participantDtos = participants.map((p, i) => ({
      name: p.name.trim() || t.splitbill.defaultParticipantName,
      amountOwed: idrOf(unitsPerParticipant[i] ?? 0),
    }));
    const base = {
      title: trimmedTitle,
      totalAmount: idrOf(totalNum),
      payoutAccountId,
      payoutInstructions: payoutInstructions.trim() || undefined,
      participants: participantDtos,
    };
    createMutation.mutate(
      billCurrency === "IDR"
        ? base
        : {
            ...base,
            fxInputs: [
              {
                field: "totalAmount",
                currency: billCurrency,
                amount: canonicalOf(totalNum),
              },
              ...unitsPerParticipant.map((u, i) => ({
                field: `participants.${i}.amountOwed`,
                currency: billCurrency,
                amount: canonicalOf(u),
              })),
            ],
          },
    );
  }

  // EPIC-023 F3 (D21) — each participant now has their OWN share link (a
  // bill-wide token cannot distinguish which recipient is asking), so this
  // copies ONE participant's link, not the whole bill's.
  function handleShareLink(participant: SplitParticipantDto) {
    const url = `${window.location.origin}/split/${participant.shareToken}`;
    void navigator.clipboard.writeText(url).then(() => {
      toast.success(t.splitbill.toastLinkCopied);
    });
  }

  // Stats derived from API data
  const activeSplits = splits?.filter((s) => s.status === "open") ?? [];
  // Prototype's "Riwayat" panel (docs/design/proto/splitbill.html `history`) —
  // every split no longer open (settled or revoked), newest-created first.
  const historySplits = (splits ?? [])
    .filter((s) => s.status !== "open")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const totalDitalangin = activeSplits.reduce(
    (s, split) => s + Number(BigInt(split.totalAmount)),
    0,
  );
  const totalTerkumpul = activeSplits.reduce(
    (s, split) => s + computePaidAmount(split),
    0,
  );
  const totalBelum = totalDitalangin - totalTerkumpul;
  const belumBayarCount = activeSplits
    .flatMap((s) => s.participants)
    .filter((p) => p.status === "pending").length;
  // "tightest-to-goal" split is the one the hero chart highlights, same as
  // the prototype's `hi` (highest pct) index.
  const highlightIndex =
    activeSplits.length > 0
      ? activeSplits.reduce(
          (best, split, i) =>
            computePct(split) > computePct(activeSplits[best]) ? i : best,
          0,
        )
      : undefined;
  // Prototype's `.sb-tip` card: the lowest-progress active split ("worst"),
  // same pick as `active.slice().sort(pct asc)[0]` in splitbill.html.
  const worstSplit =
    activeSplits.length > 0
      ? activeSplits.reduce((worst, split) =>
          computePct(split) < computePct(worst) ? split : worst,
        )
      : undefined;
  const pctAll =
    totalDitalangin > 0
      ? Math.round((totalTerkumpul / totalDitalangin) * 100)
      : 0;
  const tipMosaicFilled = Math.round((pctAll / 100) * 18);
  const tipMosaic = Array.from({ length: 18 }, (_, i) =>
    i < tipMosaicFilled ? "c" : i % 5 === 0 ? "b" : "",
  ) as ("a" | "b" | "c" | "o" | "")[];

  return (
    <BentoGrid className="sb-grid">
      <BentoHero
        className="sb-hero"
        currency={null}
        value={money.format(totalDitalangin)}
        caption={t.splitbill.headerDesc}
        controls={
          <>
            <GhostButton
              lit
              onClick={() => setCreateOpen(true)}
              disabled={!familyGroupId}
            >
              <Plus aria-hidden="true" /> {t.splitbill.createButton}
            </GhostButton>
            <div className="wm-legend" aria-hidden="true">
              <span>
                <i style={{ background: "var(--wm-lime)" }} />
                {t.splitbill.legendCollected}
              </span>
              <span>
                <i style={{ background: "var(--wm-ghost)" }} />
                {t.splitbill.legendTotal}
              </span>
            </div>
          </>
        }
        chart={
          activeSplits.length > 0 ? (
            <HatchedBarChart
              labels={activeSplits
                .slice(0, 5)
                .map((split) => split.title.split(" ")[0] ?? "")}
              series={[
                {
                  name: t.splitbill.legendTotal,
                  data: activeSplits
                    .slice(0, 5)
                    .map((split) => Number(BigInt(split.totalAmount))),
                  color: "var(--wm-ghost)",
                },
                {
                  name: t.splitbill.legendCollected,
                  data: activeSplits.slice(0, 5).map(computePaidAmount),
                  color: "var(--wm-lime)",
                },
              ]}
              highlight={highlightIndex}
              format={money.formatCompact}
              formatFull={money.format}
              axis={formatAxisCompact}
              wide
              ariaLabel={activeSplits
                .slice(0, 5)
                .map((split) => `${split.title} ${computePct(split)}%`)
                .join(", ")}
            />
          ) : (
            <p className="wm-cap">{t.splitbill.emptyActiveSplits}</p>
          )
        }
        kpis={
          <>
            <HeroKpi
              label={t.splitbill.sudahDibayarLabel}
              value={money.format(totalTerkumpul)}
              delta={
                <small className="wm-cap">{`${totalDitalangin > 0 ? Math.round((totalTerkumpul / totalDitalangin) * 100) : 0}${t.splitbill.pctCollectedSuffix}`}</small>
              }
            />
            <HeroKpi
              label={t.splitbill.belumDibayarLabel}
              value={money.format(totalBelum)}
              delta={
                <small className="wm-cap">{`${belumBayarCount}${t.splitbill.peopleUnpaidSuffix}`}</small>
              }
            />
            <HeroKpi
              label={t.splitbill.activeSplitsTitle}
              value={String(activeSplits.length)}
            />
          </>
        }
      />

      {/* "Riwayat" — EPIC prototype port (docs/design/proto/splitbill.html
          `.sb-hist`): settled/revoked splits, newest first. */}
      <BentoCard
        className="sb-hist"
        title={t.splitbill.historyTitle}
        caption={`${historySplits.length}${t.splitbill.historyCountSuffix}`}
      >
        <p className="wm-mid">
          {money.format(
            historySplits.reduce(
              (s, split) => s + Number(BigInt(split.totalAmount)),
              0,
            ),
          )}
        </p>
        <p className="wm-cap">{t.splitbill.historyTotalCaption}</p>
        <MiniList label={t.splitbill.historyTitle}>
          {historySplits.length === 0 && (
            <li className="wm-mini-row-empty">
              <small>{t.splitbill.emptyHistory}</small>
            </li>
          )}
          {historySplits.slice(0, 5).map((split) => (
            <MiniRow
              key={split.id}
              icon={<SplitIcon aria-hidden="true" />}
              title={split.title}
              meta={`${split.participants.length}${t.splitbill.peopleCountSuffix} · ${new Date(
                split.createdAt,
              ).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}`}
              amount={
                split.revokedAt ? (
                  <StatusBadge variant="danger">
                    {t.splitbill.badgeRevoked}
                  </StatusBadge>
                ) : (
                  <StatusBadge variant="success">
                    {t.splitbill.badgeSettled}
                  </StatusBadge>
                )
              }
              onClick={() => setSelectedSplit(split)}
            />
          ))}
        </MiniList>
      </BentoCard>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {t.splitbill.errorLoad}
        </div>
      )}

      {/* "Split aktif" — card grid, docs/design/proto/splitbill.html
          `.btiles`/`.btile` (replaces the old row-list). */}
      <BentoCard
        className="sb-active"
        title={t.splitbill.activeSplitsTitle}
        caption={t.splitbill.activeSplitsCaption}
      >
        {isLoading && (
          <div className="wm-btiles">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="wm-btile animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && (
          <BentoTiles>
            {activeSplits.length === 0 && (
              <div className="py-6 text-center text-[13px] text-muted-foreground">
                {t.splitbill.emptyActiveSplits}
              </div>
            )}
            {activeSplits.map((split) => {
              const pct = computePct(split);
              const paidCount = split.participants.filter(
                (p) => p.status === "paid",
              ).length;
              // Prototype's row-level status badge — priority order matches
              // its urgency: a missing payout account blocks confirmation
              // outright, so it outranks "still collecting".
              const rowBadge = !split.payoutAccountId ? (
                <StatusBadge variant="danger">
                  {t.splitbill.badgeNoPayoutAccount}
                </StatusBadge>
              ) : pct >= 100 ? (
                <StatusBadge variant="success">
                  {t.splitbill.badgeSettled}
                </StatusBadge>
              ) : (
                <StatusBadge variant="warning">
                  {t.splitbill.badgeUnpaid}
                </StatusBadge>
              );
              const createdOn = new Date(split.createdAt).toLocaleDateString(
                locale === "en" ? "en-US" : "id-ID",
                {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                },
              );
              return (
                <BentoTile
                  key={split.id}
                  onClick={() => setSelectedSplit(split)}
                  title={
                    <>
                      <span className="sb-tile-tt" title={split.title}>
                        {split.title}
                      </span>
                      <span className="sr-only"> {rowBadge}</span>
                    </>
                  }
                  value={`${pct}%`}
                >
                  <Track value={pct} />
                  <small>
                    {`${money.format(computePaidAmount(split))}${t.splitbill.collectedSuffix} ${t.splitbill.paidOfMidText}${money.format(Number(BigInt(split.totalAmount)))} · ${split.participants.length}${t.splitbill.peopleCountSuffix}`}
                  </small>
                  <small>
                    {`${paidCount}${t.splitbill.paidOfMidText}${split.participants.length}${t.splitbill.peopleCountSuffix} · ${t.splitbill.createdOnPrefix}${createdOn}`}
                  </small>
                </BentoTile>
              );
            })}
            <AddTile onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              {t.splitbill.addSplitTileLabel}
            </AddTile>
          </BentoTiles>
        )}
      </BentoCard>

      {/* Contextual tip card — docs/design/proto/splitbill.html `#tipT`/`#tipP`:
          the lowest-progress active split ("worst"), its remaining amount,
          and a mosaic sized to overall collected %. Replaces the old static
          "Cara kerja Split Bill" explainer. */}
      <TipsCard
        className="sb-tip"
        title={
          worstSplit
            ? `${worstSplit.title}${t.splitbill.tipTitleSuffix} ${computePct(worstSplit)}%`
            : activeSplits.length > 0
              ? t.splitbill.tipAllOnTrack
              : t.splitbill.tipNoActiveSplits
        }
        mosaic={tipMosaic}
      >
        {worstSplit
          ? `${t.splitbill.tipRemainingPrefix}${money.format(Number(BigInt(worstSplit.totalAmount)) - computePaidAmount(worstSplit))}${t.splitbill.tipRemainingMid}${worstSplit.participants.filter((p) => p.status !== "paid").length}${t.splitbill.tipRemainingPeopleSuffix}`
          : t.splitbill.tipInviteHint}
      </TipsCard>

      {/* Create modal */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreateForm();
        }}
      >
        {/* EPIC-026 — composition ported 1:1 from the prototype's
            `dlg-buat-split` (docs/prototype/pages/splitbill.html:185):
            title + `.dialog__desc`, `.field` stack in the prototype's order
            (judul → total → rekening tujuan (+hint) → instruksi → metode
            (`.segmented`) → peserta), a `.notice` summary line, and a
            `.dialog__footer` with Batal / Buat & Bagikan Link. */}
        <PanelContent variant="side" className="wm-form-panel">
          <header className="wm-panel-head">
            <div className="min-w-0">
              <DialogTitle className="wm-panel-title">
                {t.splitbill.createButton}
              </DialogTitle>
              <DialogDescription className="wm-panel-desc">
                {t.splitbill.createDialogDesc}
              </DialogDescription>
            </div>
            <DialogClose className="wm-panel-x" aria-label={t.common.close}>
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="wm-panel-body wm-form">
              <div className="wm-form__grid">
                <label className="field">
                  <span className="label">{t.splitbill.fieldTitleLabel}</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t.splitbill.fieldTitlePlaceholder}
                    className="input"
                  />
                </label>

                <div className="field">
                  <label className="label" htmlFor="splitbill-total">
                    {t.splitbill.fieldTotalLabel}
                  </label>
                  <MoneyInput field={totalField} id="splitbill-total" />
                </div>

                <div className="field">
                  <label className="label" htmlFor="splitbill-payout-account">
                    {t.splitbill.fieldPayoutAccountLabel}
                  </label>
                  <select
                    id="splitbill-payout-account"
                    value={payoutAccountId}
                    onChange={(e) => setPayoutAccountId(e.target.value)}
                    className="select"
                  >
                    <option value="">
                      {t.splitbill.fieldPayoutAccountPlaceholder}
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <span className="hint">
                    {t.splitbill.fieldPayoutAccountHint}
                  </span>
                </div>

                <div className="field">
                  <label
                    className="label"
                    htmlFor="splitbill-payout-instructions"
                  >
                    {t.splitbill.fieldPayoutInstructionsLabel}
                  </label>
                  <input
                    id="splitbill-payout-instructions"
                    type="text"
                    value={payoutInstructions}
                    onChange={(e) => setPayoutInstructions(e.target.value)}
                    placeholder={t.splitbill.fieldPayoutInstructionsPlaceholder}
                    className="input"
                  />
                </div>

                <div className="field">
                  <span className="label">{t.splitbill.fieldMethodLabel}</span>
                  <div
                    className="segmented w-full"
                    role="tablist"
                    aria-label={t.splitbill.fieldMethodLabel}
                  >
                    {(
                      [
                        ["equal", t.splitbill.methodEqualLabel],
                        ["custom", t.splitbill.methodCustomLabel],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={method === key}
                        onClick={() => setMethod(key)}
                        className="segmented__item flex-1"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <span className="label">
                    {t.splitbill.fieldParticipantsLabel} ({participants.length})
                  </span>
                  <div className="space-y-2">
                    {participants.map((p, i) => (
                      <div
                        key={p.localId}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) =>
                            renameParticipant(p.localId, e.target.value)
                          }
                          className="input min-w-0 flex-1 basis-[120px]"
                          aria-label={`${t.splitbill.fieldParticipantsLabel} ${p.name}`}
                        />
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                          {method === "equal" ? (
                            <span className="mono text-right text-[12.5px] font-semibold whitespace-nowrap text-primary">
                              {unitsLabel(equalShares[i] ?? 0)}
                            </span>
                          ) : (
                            <input
                              inputMode={
                                billDecimals > 0 ? "decimal" : "numeric"
                              }
                              value={customAmounts[p.localId] ?? ""}
                              onChange={(e) =>
                                setCustomAmounts((prev) => ({
                                  ...prev,
                                  [p.localId]: formatMoneyTyping(
                                    e.target.value,
                                    billDecimals,
                                  ),
                                }))
                              }
                              placeholder={
                                billCurrency === "IDR" ? "0" : billCurrency
                              }
                              aria-label={`${t.splitbill.fieldTotalLabel} ${p.name}`}
                              className="input mono w-[104px] shrink-0 text-[12px]"
                            />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeParticipant(p.localId)}
                            aria-label={`${t.splitbill.removeParticipantAriaPrefix}${p.name}`}
                          >
                            <X className="size-[15px]" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addParticipant}
                    className="btn--block mt-2.5"
                  >
                    <Plus className="size-[15px]" />{" "}
                    {t.splitbill.addParticipantButton}
                  </Button>

                  {method === "equal" && (
                    <div className="notice mt-2.5">
                      <span>
                        {t.splitbill.perPersonPrefix}
                        <strong className="mono t-primary">
                          {unitsLabel(perPerson)}
                        </strong>
                      </span>
                    </div>
                  )}

                  {method === "custom" && totalNum <= 0 && (
                    <div className="notice mt-2.5">
                      <span>{t.splitbill.remainderNeedTotalNote}</span>
                    </div>
                  )}
                  {method === "custom" && totalNum > 0 && (
                    <div
                      className={
                        "notice row row--between mt-2.5 " +
                        (customRemainder === 0
                          ? "notice--info"
                          : customRemainder > 0
                            ? "notice--warning"
                            : "notice--danger")
                      }
                    >
                      <span>
                        {customRemainder === 0 ? (
                          <strong>{t.splitbill.remainderExactLabel}</strong>
                        ) : customRemainder > 0 ? (
                          <>
                            {t.splitbill.remainderLeftPrefix}
                            <strong className="mono">
                              {unitsLabel(customRemainder)}
                            </strong>
                          </>
                        ) : (
                          <>
                            {t.splitbill.remainderOverPrefix}
                            <strong className="mono">
                              {unitsLabel(Math.abs(customRemainder))}
                            </strong>
                            {t.splitbill.remainderOverSuffix}
                          </>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSplitRemainderEvenly}
                        disabled={customRemainder <= 0}
                        className="shrink-0"
                      >
                        {t.splitbill.splitRemainderButton}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* polish-j batch 7a item 12 — `.dialog__footer` only sticks at
              <=768px (design-system.css's own mobile media query); above
              that, `.dialog` itself is the scrolling box (`max-height:
              85dvh; overflow-y: auto`, unchanged), so a local Tailwind
              class here — not a design-system.css/dialog.tsx edit — pins
              the footer to that same scrolling box's bottom edge at
              desktop widths too, mirroring the mobile block's own
              negative-margin + padding technique. */}
            <div className="wm-panel-foot">
              {/* Same teardown as the Escape/backdrop path above
                (`onOpenChange` → `resetCreateForm`), so cancelling never
                leaves a half-filled form behind for the next open. */}
              <PillButton
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
              >
                {t.common.cancel}
              </PillButton>
              <PillButton
                type="button"
                variant="primary"
                onClick={handleCreate}
                disabled={
                  createMutation.isPending || totalField.resolved.isPending
                }
              >
                {createMutation.isPending
                  ? t.splitbill.savingCreateLabel
                  : t.splitbill.createAndShareButton}
              </PillButton>
            </div>
          </div>
        </PanelContent>
      </Dialog>

      {/* Detail / share modal */}
      <Dialog
        open={Boolean(selectedSplit)}
        onOpenChange={(o) => {
          if (!o) setSelectedSplit(null);
        }}
      >
        {/* EPIC-026 — composition ported from the prototype's
            `dlg-detail-split` (docs/prototype/pages/splitbill.html:276):
            the total/participants/per-person line moves into the
            `.dialog__desc`, the payout warning becomes a
            `.notice.notice--warning` with a triangle-alert icon, the
            participant list sits under a `.section-title`, and "Cabut Semua
            Link" moves from the header into the `.dialog__footer` next to
            Tutup, matching the prototype's outline/destructive pair. */}
        <PanelContent variant="side" className="wm-form-panel">
          {selectedSplit && (
            <>
              <header className="wm-panel-head">
                <div className="min-w-0">
                  <DialogTitle className="wm-panel-title">
                    {selectedSplit.title}
                  </DialogTitle>
                  <DialogDescription className="wm-panel-desc">
                    <span className="mono">
                      {money.format(Number(BigInt(selectedSplit.totalAmount)))}
                    </span>
                    {" · "}
                    {selectedSplit.participants.length}
                    {t.splitbill.detailParticipantsSuffix}
                    {selectedSplit.participants.length > 0 && (
                      <>
                        {" · "}
                        <span className="mono">
                          {money.format(
                            Math.round(
                              Number(BigInt(selectedSplit.totalAmount)) /
                                selectedSplit.participants.length,
                            ),
                          )}
                        </span>
                        {t.splitbill.detailPerOrangSuffix}
                      </>
                    )}
                  </DialogDescription>
                </div>
                <DialogClose className="wm-panel-x" aria-label={t.common.close}>
                  <X aria-hidden="true" />
                </DialogClose>
              </header>

              <div className="wm-panel-body">
                {selectedSplit.revokedAt && (
                  <div className="notice notice--danger">
                    <span>{t.splitbill.revokedNotice}</span>
                  </div>
                )}

                {/* Group F (task F3) — repairable: legacy bills (or a bill
                    whose payout account was later deleted) can have a null
                    payoutAccountId. create() requires one, so this is the
                    only way to fix it after the fact. */}
                {!selectedSplit.payoutAccountId && (
                  <div className="notice notice--warning mt-2.5 flex-wrap items-center">
                    <TriangleAlert
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1">
                      {t.splitbill.payoutAccountMissingNotice}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditPayout(selectedSplit)}
                      className="shrink-0"
                    >
                      {t.splitbill.editPayoutAccountButton}
                    </Button>
                  </div>
                )}

                <div className="section-title mt-[18px] mb-2 text-[14px]">
                  {t.splitbill.statusPaymentTitle}
                </div>
                <div className="space-y-0">
                  {selectedSplit.participants.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center gap-2 border-b py-2.5 last:border-b-0"
                    >
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{
                          background:
                            AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                        }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 basis-[100px]">
                        <div className="truncate text-[13px] font-semibold">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {money.format(Number(BigInt(p.amountOwed)))}
                        </div>
                      </div>
                      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {p.status === "claimed" && (
                          <StatusBadge variant="warning">
                            {t.splitbill.claimedBadge}
                          </StatusBadge>
                        )}
                        {p.status === "paid" ? (
                          <StatusBadge variant="success">
                            {t.splitbill.paidBadge}
                          </StatusBadge>
                        ) : (
                          <button
                            onClick={() =>
                              setConfirmTarget({
                                splitId: selectedSplit.id,
                                participantId: p.id,
                                participantName: p.name,
                              })
                            }
                            disabled={confirmMutation.isPending}
                            className="shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-success hover:text-success disabled:opacity-50"
                          >
                            {t.splitbill.markPaidButton}
                          </button>
                        )}
                        <button
                          onClick={() => handleShareLink(p)}
                          disabled={Boolean(selectedSplit.revokedAt)}
                          aria-label={`${t.splitbill.participantLinkLabel}${p.name}`}
                          title={
                            selectedSplit.revokedAt
                              ? t.splitbill.copyDisabledRevokedTitle
                              : undefined
                          }
                          className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Link2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="wm-panel-foot">
                <button
                  type="button"
                  className="sb-del-btn"
                  onClick={() => setDeleteTarget(selectedSplit)}
                  disabled={deleteMutation.isPending}
                  aria-label={`${t.splitbill.deleteSplitButton} ${selectedSplit.title}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t.splitbill.deleteSplitButton}
                </button>
                <PillButton onClick={() => setSelectedSplit(null)}>
                  {t.splitbill.detailCloseButton}
                </PillButton>
                {!selectedSplit.revokedAt && (
                  <PillButton
                    variant="danger"
                    onClick={() => handleRevoke(selectedSplit)}
                    disabled={revokeMutation.isPending}
                  >
                    {t.splitbill.revokeButton}
                  </PillButton>
                )}
              </div>
            </>
          )}
        </PanelContent>
      </Dialog>

      {/* Group F (task F3) — repair the payout account for a bill whose
          payoutAccountId is null or points at a deleted account.
          App-only dialog (the prototype edits the payout account inline in
          `dlg-detail-split`), so it follows the prototype's *conventions*:
          title + `.dialog__desc`, one `.field` with a `.hint`, and a
          `dialog--sm` box with a Batal / Simpan `.dialog__footer`.
          The prototype's companion "Instruksi Pembayaran" input is omitted
          here — `UpdatePayoutAccountDto` carries only `payoutAccountId`, so
          rendering it would silently drop whatever the user typed. */}
      <Dialog open={editPayoutOpen} onOpenChange={setEditPayoutOpen}>
        <PanelContent variant="side" className="wm-form-panel">
          <header className="wm-panel-head">
            <div className="min-w-0">
              <DialogTitle className="wm-panel-title">
                {t.splitbill.editPayoutAccountTitle}
              </DialogTitle>
              <DialogDescription className="wm-panel-desc">
                {t.splitbill.editPayoutAccountDesc}
              </DialogDescription>
            </div>
            <DialogClose className="wm-panel-x" aria-label={t.common.close}>
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="wm-panel-body wm-form">
              <div className="wm-form__grid">
                <div className="field">
                  <label className="label" htmlFor="edit-payout-account">
                    {t.splitbill.fieldPayoutAccountLabel}
                  </label>
                  <select
                    id="edit-payout-account"
                    value={editPayoutAccountId}
                    onChange={(e) => setEditPayoutAccountId(e.target.value)}
                    className="select"
                  >
                    <option value="">
                      {t.splitbill.fieldPayoutAccountPlaceholder}
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <span className="hint">
                    {t.splitbill.fieldPayoutAccountHint}
                  </span>
                </div>
              </div>
            </div>
            <div className="wm-panel-foot">
              <PillButton
                type="button"
                onClick={() => setEditPayoutOpen(false)}
              >
                {t.common.cancel}
              </PillButton>
              <PillButton
                type="button"
                variant="primary"
                onClick={handleSavePayoutAccount}
                disabled={
                  !editPayoutAccountId || updatePayoutAccountMutation.isPending
                }
              >
                {updatePayoutAccountMutation.isPending
                  ? t.splitbill.savingPayoutAccountLabel
                  : t.splitbill.savePayoutAccountButton}
              </PillButton>
            </div>
          </div>
        </PanelContent>
      </Dialog>

      {/* EPIC-023 Group F fix round (HIGH 1) — revoke is cosmetic (no money
          moves) but was already gated behind window.confirm; confirming a
          payment is irreversible (real income, no un-confirm endpoint) and
          previously fired on a single click. Both now share the SAME real
          confirmation dialog. */}
      <ConfirmDeleteDialog
        label={deleteTarget ? deleteTarget.title : null}
        title={t.splitbill.deleteSplitConfirmTitle}
        body={t.splitbill.deleteSplitConfirmMessage}
        confirmLabel={t.splitbill.deleteSplitConfirmButton}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
      <ConfirmDeleteDialog
        label={revokeTarget ? revokeTarget.title : null}
        title={t.splitbill.revokeConfirmTitle}
        body={t.splitbill.revokeConfirmMessage}
        confirmLabel={t.splitbill.revokeConfirmButton}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
        }}
      />
      <ConfirmDeleteDialog
        label={confirmTarget ? confirmTarget.participantName : null}
        title={`${t.splitbill.confirmPaymentTitlePrefix}${confirmTarget?.participantName ?? ""}?`}
        body={t.splitbill.confirmPaymentBody}
        confirmLabel={t.splitbill.confirmPaymentButton}
        confirmVariant="default"
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) {
            confirmMutation.mutate({
              splitId: confirmTarget.splitId,
              participantId: confirmTarget.participantId,
            });
          }
        }}
      />
    </BentoGrid>
  );
}
