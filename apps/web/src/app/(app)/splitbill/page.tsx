"use client";

import { useMemo, useState } from "react";
import { Plus, Share2, X, Link2 } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard, ProgressBar, StatusBadge } from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import { formatAmountInput, parseRupiah, formatRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  amountsMatchTotal,
  computeRemainder,
  splitRemainderEvenly,
  type CustomAmounts,
} from "./split-math";

import type {
  AccountDto,
  SplitBillDto,
  CreateSplitBillDto,
  SplitParticipantDto,
  UpdatePayoutAccountDto,
} from "@wealthme/contracts";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

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
  const [confirmTarget, setConfirmTarget] = useState<{
    splitId: string;
    participantId: string;
    participantName: string;
  } | null>(null);
  // Group F (task F3) — repairs a bill whose payoutAccountId is null or
  // points at a deleted account.
  const [editPayoutOpen, setEditPayoutOpen] = useState(false);
  const [editPayoutAccountId, setEditPayoutAccountId] = useState("");

  // Create modal state
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [method, setMethod] = useState<"equal" | "custom">("equal");
  // NOTE: "Andi"/"Budi"/"Citra" are example seed names for the participant
  // rows (freely editable by the user before creating the split), not UI
  // chrome — kept as-is in both locales like the `USER` mock profile name,
  // matching the value-locked example-data convention.
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

  const totalNum = parseRupiah(total);
  const participantIds = useMemo(
    () => participants.map((p) => p.localId),
    [participants],
  );
  const perPerson = useMemo(() => {
    if (participants.length === 0 || method !== "equal") return 0;
    return Math.round(totalNum / participants.length);
  }, [totalNum, participants.length, method]);
  // Live remainder for the custom-split calculator (item #10) — how much of
  // the total is still unallocated across the per-person amount inputs.
  const customRemainder = useMemo(
    () => computeRemainder(totalNum, participantIds, customAmounts),
    [totalNum, participantIds, customAmounts],
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

  // "Bagi rata sisa" — fills every participant who hasn't entered an amount
  // yet with an even share of whatever remains from the total.
  function handleSplitRemainderEvenly() {
    setCustomAmounts((prev) =>
      splitRemainderEvenly(totalNum, participantIds, prev),
    );
  }

  function resetCreateForm() {
    setTitle("");
    setTotal("");
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
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? t.splitbill.toastCreateFailedDefault);
    },
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
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? t.splitbill.toastSettleFailedDefault);
    },
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
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? t.splitbill.toastRevokeFailedDefault);
    },
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
      !amountsMatchTotal(totalNum, participantIds, customAmounts)
    ) {
      const diff = computeRemainder(totalNum, participantIds, customAmounts);
      const diffLabel =
        diff > 0
          ? `kurang ${formatRupiah(diff)}`
          : `lebih ${formatRupiah(Math.abs(diff))}`;
      toast.warning(
        `Jumlah per orang belum sama dengan total tagihan (${diffLabel}).`,
      );
      return;
    }

    let participantDtos: CreateSplitBillDto["participants"];
    if (method === "equal") {
      participantDtos = participants.map((p) => ({
        name: p.name.trim() || t.splitbill.defaultParticipantName,
        amountOwed: perPerson,
      }));
    } else {
      participantDtos = participants.map((p) => ({
        name: p.name.trim() || t.splitbill.defaultParticipantName,
        amountOwed: parseRupiah(customAmounts[p.localId] ?? "0"),
      }));
    }

    createMutation.mutate({
      title: trimmedTitle,
      totalAmount: totalNum,
      payoutAccountId,
      payoutInstructions: payoutInstructions.trim() || undefined,
      participants: participantDtos,
    });
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[13px] text-muted-foreground">
          {t.splitbill.headerDesc}
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!familyGroupId}
          className="h-auto px-[18px] py-2.5"
        >
          <Plus className="size-4" /> {t.splitbill.createButton}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.splitbill.totalDitalanginLabel}
          </div>
          <div className="text-[20px] font-black text-primary">
            {formatRupiah(totalDitalangin)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {activeSplits.length}
            {t.splitbill.activeSplitsSuffix}
          </div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.splitbill.sudahDibayarLabel}
          </div>
          <div className="text-[20px] font-black text-success">
            {formatRupiah(totalTerkumpul)}
          </div>
          <div className="text-[11px] text-success">
            {totalDitalangin > 0
              ? Math.round((totalTerkumpul / totalDitalangin) * 100)
              : 0}
            {t.splitbill.pctCollectedSuffix}
          </div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.splitbill.belumDibayarLabel}
          </div>
          <div className="text-[20px] font-black text-destructive">
            {formatRupiah(totalBelum)}
          </div>
          <div className="text-[11px] text-destructive">
            {belumBayarCount}
            {t.splitbill.peopleUnpaidSuffix}
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {t.splitbill.errorLoad}
        </div>
      )}

      {/* Active splits */}
      <SectionCard
        title={t.splitbill.activeSplitsTitle}
        bodyClassName="space-y-2.5"
      >
        {isLoading && (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[100px] animate-pulse rounded-[10px] border bg-muted"
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && activeSplits.length === 0 && (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.splitbill.emptyActiveSplits}
          </div>
        )}

        {!isLoading &&
          !isError &&
          activeSplits.map((split) => {
            const pct = computePct(split);
            const paidCount = split.participants.filter(
              (p) => p.status === "paid",
            ).length;
            const barColor = pct >= 75 ? "var(--success)" : "var(--warning)";
            return (
              <div key={split.id} className="rounded-[10px] border p-3.5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[14px] font-bold">{split.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(split.createdAt).toLocaleDateString(
                        locale === "en" ? "en-US" : "id-ID",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}{" "}
                      · {split.participants.length}
                      {t.splitbill.peopleCountSuffix}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-extrabold">
                      {formatRupiah(Number(BigInt(split.totalAmount)))}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {split.participants.length > 0
                        ? `${formatRupiah(Math.round(Number(BigInt(split.totalAmount)) / split.participants.length))}${t.splitbill.perOrgSuffix}`
                        : ""}
                    </div>
                  </div>
                </div>
                <ProgressBar value={pct} color={barColor} className="mb-2" />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] text-muted-foreground">
                    <span className="font-bold" style={{ color: barColor }}>
                      {paidCount}
                      {t.splitbill.paidOfMidText}
                      {split.participants.length}
                    </span>
                    {t.splitbill.paidStatusSuffix}
                    {formatRupiah(computePaidAmount(split))}
                    {t.splitbill.collectedSuffix}
                  </div>
                  <button
                    onClick={() => setSelectedSplit(split)}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-accent/70"
                  >
                    <Share2 className="size-3.5" /> {t.splitbill.detailButton}
                  </button>
                </div>
              </div>
            );
          })}
      </SectionCard>

      {/* Insight banner */}
      <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
        <div className="text-[24px]">💡</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            {t.splitbill.insightTitle}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t.splitbill.insightDesc}
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-[min(480px,calc(100%-2rem))] p-6 sm:max-w-[min(480px,calc(100%-2rem))]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            {t.splitbill.createButton}
          </DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.splitbill.fieldTitleLabel}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.splitbill.fieldTitlePlaceholder}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.splitbill.fieldTotalLabel}
              </label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={total}
                  onChange={(e) => setTotal(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="splitbill-payout-account"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.splitbill.fieldPayoutAccountLabel}
              </label>
              <select
                id="splitbill-payout-account"
                value={payoutAccountId}
                onChange={(e) => setPayoutAccountId(e.target.value)}
                className={FIELD_CLASS}
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
            </div>

            <div>
              <label
                htmlFor="splitbill-payout-instructions"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.splitbill.fieldPayoutInstructionsLabel}
              </label>
              <input
                id="splitbill-payout-instructions"
                type="text"
                value={payoutInstructions}
                onChange={(e) => setPayoutInstructions(e.target.value)}
                placeholder={t.splitbill.fieldPayoutInstructionsPlaceholder}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.splitbill.fieldMethodLabel}
              </label>
              <div className="flex gap-2">
                {(
                  [
                    ["equal", t.splitbill.methodEqualLabel],
                    ["custom", t.splitbill.methodCustomLabel],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    className={
                      "flex-1 cursor-pointer rounded-md px-3 py-2 text-[12.5px] font-semibold transition-colors " +
                      (method === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/70")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.splitbill.fieldParticipantsLabel}
              </label>
              <div className="space-y-2">
                {participants.map((p) => (
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
                      className={"min-w-0 flex-1 basis-[120px] " + FIELD_CLASS}
                    />
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {method === "equal" ? (
                        <span className="text-right text-[12.5px] font-semibold whitespace-nowrap text-primary">
                          {formatRupiah(perPerson)}
                        </span>
                      ) : (
                        <div className="flex w-[92px] shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1.5 focus-within:border-primary">
                          <span className="text-[11px] text-muted-foreground">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={customAmounts[p.localId] ?? ""}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [p.localId]: formatAmountInput(e.target.value),
                              }))
                            }
                            placeholder="0"
                            className="w-full min-w-0 bg-transparent text-[12px] outline-none"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeParticipant(p.localId)}
                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`${t.splitbill.removeParticipantAriaPrefix}${p.name}`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addParticipant}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-primary bg-card py-2.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-accent"
              >
                <Plus className="size-4" /> {t.splitbill.addParticipantButton}
              </button>
            </div>

            {method === "equal" && (
              <div className="flex items-center gap-2 rounded-[10px] bg-accent px-3 py-2.5">
                <span className="text-[12px] text-muted-foreground">
                  {t.splitbill.perPersonPrefix}
                  <strong className="text-primary">
                    {formatRupiah(perPerson)}
                  </strong>
                </span>
              </div>
            )}

            {method === "custom" && totalNum <= 0 && (
              <div className="rounded-[10px] bg-secondary px-3 py-2.5 text-[12px] text-muted-foreground">
                Isi total tagihan dulu untuk menghitung pembagian per orang.
              </div>
            )}
            {method === "custom" && totalNum > 0 && (
              <div
                className={
                  "flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 " +
                  (customRemainder === 0
                    ? "bg-success-soft"
                    : customRemainder > 0
                      ? "bg-accent"
                      : "bg-destructive/10")
                }
              >
                <span className="text-[12px] text-muted-foreground">
                  {customRemainder === 0 ? (
                    <strong className="text-success">
                      Pas! Sudah sama dengan total tagihan
                    </strong>
                  ) : customRemainder > 0 ? (
                    <>
                      Sisa:{" "}
                      <strong className="text-primary">
                        {formatRupiah(customRemainder)}
                      </strong>{" "}
                      dari total
                    </>
                  ) : (
                    <strong className="text-destructive">
                      Lebih {formatRupiah(Math.abs(customRemainder))} dari total
                    </strong>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleSplitRemainderEvenly}
                  disabled={customRemainder <= 0}
                  className="shrink-0 cursor-pointer rounded-md border border-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Bagi Rata Sisa
                </button>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Share2 className="size-4" />
              {createMutation.isPending
                ? t.splitbill.savingCreateLabel
                : t.splitbill.createAndShareButton}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / share modal */}
      <Dialog
        open={Boolean(selectedSplit)}
        onOpenChange={(o) => {
          if (!o) setSelectedSplit(null);
        }}
      >
        <DialogContent className="max-w-[min(480px,calc(100%-2rem))] p-6 sm:max-w-[min(480px,calc(100%-2rem))]">
          {selectedSplit && (
            <>
              <div className="mb-4 flex items-start justify-between gap-2">
                <DialogTitle className="text-[17px] font-extrabold">
                  {selectedSplit.title}
                </DialogTitle>
                {!selectedSplit.revokedAt && (
                  <button
                    onClick={() => handleRevoke(selectedSplit)}
                    disabled={revokeMutation.isPending}
                    className="shrink-0 cursor-pointer rounded-md border border-destructive/30 px-2.5 py-1 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {t.splitbill.revokeButton}
                  </button>
                )}
              </div>

              {selectedSplit.revokedAt && (
                <div className="mb-4 rounded-[10px] bg-destructive/10 px-3.5 py-2.5 text-[12px] text-destructive">
                  {t.splitbill.revokedNotice}
                </div>
              )}

              {/* Group F (task F3) — repairable: legacy bills (or a bill
                  whose payout account was later deleted) can have a null
                  payoutAccountId. create() requires one, so this is the
                  only way to fix it after the fact. */}
              {!selectedSplit.payoutAccountId && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-warning-soft px-3.5 py-2.5 text-[12px] text-warning">
                  <span>{t.splitbill.payoutAccountMissingNotice}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditPayout(selectedSplit)}
                    className="shrink-0 cursor-pointer rounded-md border border-warning/40 px-2.5 py-1 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/10"
                  >
                    {t.splitbill.editPayoutAccountButton}
                  </button>
                </div>
              )}

              <div className="mb-4 rounded-[14px] bg-accent p-[18px] text-center">
                <div className="text-[11px] text-muted-foreground">
                  {t.splitbill.fieldTotalLabel}
                </div>
                <div className="text-[26px] font-black text-primary">
                  {formatRupiah(Number(BigInt(selectedSplit.totalAmount)))}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  {selectedSplit.participants.length > 0
                    ? `${formatRupiah(Math.round(Number(BigInt(selectedSplit.totalAmount)) / selectedSplit.participants.length))}${t.splitbill.detailPerOrangSuffix}`
                    : ""}{" "}
                  · {selectedSplit.participants.length}
                  {t.splitbill.detailParticipantsSuffix}
                </div>
              </div>

              <div className="mb-2 text-[12px] font-bold text-muted-foreground">
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
                        {formatRupiah(Number(BigInt(p.amountOwed)))}
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Group F (task F3) — repair the payout account for a bill whose
          payoutAccountId is null or points at a deleted account. */}
      <Dialog open={editPayoutOpen} onOpenChange={setEditPayoutOpen}>
        <DialogContent className="max-w-[min(420px,calc(100%-2rem))] p-6 sm:max-w-[min(420px,calc(100%-2rem))]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            {t.splitbill.editPayoutAccountTitle}
          </DialogTitle>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="edit-payout-account"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.splitbill.fieldPayoutAccountLabel}
              </label>
              <select
                id="edit-payout-account"
                value={editPayoutAccountId}
                onChange={(e) => setEditPayoutAccountId(e.target.value)}
                className={FIELD_CLASS}
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
            </div>
            <Button
              onClick={handleSavePayoutAccount}
              disabled={
                !editPayoutAccountId || updatePayoutAccountMutation.isPending
              }
              className="w-full"
            >
              {updatePayoutAccountMutation.isPending
                ? t.splitbill.savingPayoutAccountLabel
                : t.splitbill.savePayoutAccountButton}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EPIC-023 Group F fix round (HIGH 1) — revoke is cosmetic (no money
          moves) but was already gated behind window.confirm; confirming a
          payment is irreversible (real income, no un-confirm endpoint) and
          previously fired on a single click. Both now share the SAME real
          confirmation dialog. */}
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
    </div>
  );
}
