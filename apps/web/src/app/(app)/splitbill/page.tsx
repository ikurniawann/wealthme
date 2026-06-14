"use client";

import { useMemo, useState } from "react";
import { Plus, Share2, X, Link2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard, ProgressBar, StatusBadge } from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatAmountInput, parseRupiah, formatRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  SplitBillDto,
  CreateSplitBillDto,
  SplitParticipantDto,
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
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId as string | undefined;
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSplit, setSelectedSplit] = useState<SplitBillDto | null>(null);

  // Create modal state
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [method, setMethod] = useState<"equal" | "custom">("equal");
  const [participants, setParticipants] = useState<LocalParticipant[]>(() => [
    makeParticipant("Andi"),
    makeParticipant("Budi"),
    makeParticipant("Citra"),
  ]);
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>(
    {},
  );

  const totalNum = parseRupiah(total);
  const perPerson = useMemo(() => {
    if (participants.length === 0 || method !== "equal") return 0;
    return Math.round(totalNum / participants.length);
  }, [totalNum, participants.length, method]);

  function addParticipant() {
    const newP = makeParticipant(`Peserta ${participants.length + 1}`);
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
  }

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
      toast.success("Split Bill dibuat!");
      setCreateOpen(false);
      resetCreateForm();
      setSelectedSplit(created);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "Gagal membuat split bill");
    },
  });

  // Settle participant mutation
  const settleMutation = useMutation({
    mutationFn: ({
      splitId,
      participantId,
    }: {
      splitId: string;
      participantId: string;
    }) =>
      apiFetch<SplitParticipantDto>(
        `/family-groups/${familyGroupId}/split-bills/${splitId}/participants/${participantId}/settle`,
        { method: "PATCH", token, body: JSON.stringify({}) },
      ),
    onSuccess: (updated, { splitId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.splitBills.list(familyGroupId ?? ""),
      });
      // Update selectedSplit optimistically so the detail modal reflects the change
      setSelectedSplit((prev) => {
        if (!prev || prev.id !== splitId) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === updated.id
              ? { ...p, status: updated.status, paidAt: updated.paidAt }
              : p,
          ),
        };
      });
      toast.success("Peserta ditandai lunas");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "Gagal menandai lunas");
    },
  });

  function handleCreate() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.warning("Judul acara wajib diisi");
      return;
    }
    if (totalNum <= 0) {
      toast.warning("Total tagihan wajib diisi");
      return;
    }
    if (participants.length < 2) {
      toast.warning("Minimal 2 peserta");
      return;
    }

    let participantDtos: CreateSplitBillDto["participants"];
    if (method === "equal") {
      participantDtos = participants.map((p) => ({
        name: p.name.trim() || `Peserta`,
        amountOwed: perPerson,
      }));
    } else {
      participantDtos = participants.map((p) => ({
        name: p.name.trim() || `Peserta`,
        amountOwed: parseRupiah(customAmounts[p.localId] ?? "0"),
      }));
    }

    createMutation.mutate({
      title: trimmedTitle,
      totalAmount: totalNum,
      participants: participantDtos,
    });
  }

  function handleShareLink(split: SplitBillDto) {
    const url = `${window.location.origin}/split/${split.shareToken}`;
    void navigator.clipboard.writeText(url).then(() => {
      toast.success("Link disalin!");
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
          Patungan jadi gampang — kamu nalangin, mereka bayar balik
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!familyGroupId}
          className="h-auto px-[18px] py-2.5"
        >
          <Plus className="size-4" /> Buat Split Bill
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Total Ditalangin
          </div>
          <div className="text-[20px] font-black text-primary">
            {formatRupiah(totalDitalangin)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {activeSplits.length} split aktif
          </div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Sudah Dibayar
          </div>
          <div className="text-[20px] font-black text-success">
            {formatRupiah(totalTerkumpul)}
          </div>
          <div className="text-[11px] text-success">
            {totalDitalangin > 0
              ? `${Math.round((totalTerkumpul / totalDitalangin) * 100)}% terkumpul`
              : "0% terkumpul"}
          </div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Belum Dibayar
          </div>
          <div className="text-[20px] font-black text-destructive">
            {formatRupiah(totalBelum)}
          </div>
          <div className="text-[11px] text-destructive">
            {belumBayarCount} orang belum bayar
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          Gagal memuat data split bill. Silakan refresh halaman.
        </div>
      )}

      {/* Active splits */}
      <SectionCard title="Split Bill Aktif" bodyClassName="space-y-2.5">
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
            Belum ada split bill aktif. Klik &quot;Buat Split Bill&quot; untuk
            mulai.
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
                      {new Date(split.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {split.participants.length} orang
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-extrabold">
                      {formatRupiah(Number(BigInt(split.totalAmount)))}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {split.participants.length > 0
                        ? `${formatRupiah(Math.round(Number(BigInt(split.totalAmount)) / split.participants.length))}/org`
                        : ""}
                    </div>
                  </div>
                </div>
                <ProgressBar value={pct} color={barColor} className="mb-2" />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] text-muted-foreground">
                    <span className="font-bold" style={{ color: barColor }}>
                      {paidCount} dari {split.participants.length}
                    </span>{" "}
                    sudah bayar · {formatRupiah(computePaidAmount(split))}{" "}
                    terkumpul
                  </div>
                  <button
                    onClick={() => setSelectedSplit(split)}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-accent/70"
                  >
                    <Share2 className="size-3.5" /> Detail
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
            Cara kerja Split Bill
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Bikin tagihan, bagi rata atau custom, lalu kirim link ke teman.
            Mereka bisa bayar via transfer/e-wallet & kamu dapat notifikasi
            otomatis.
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
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            Buat Split Bill
          </DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Judul Acara
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="cth: Makan di Sushi Tei"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Total Tagihan
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
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Metode Bagi
              </label>
              <div className="flex gap-2">
                {(
                  [
                    ["equal", "Bagi Rata"],
                    ["custom", "Custom per Orang"],
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
                Peserta
              </label>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.localId} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) =>
                        renameParticipant(p.localId, e.target.value)
                      }
                      className={"flex-1 " + FIELD_CLASS}
                    />
                    {method === "equal" ? (
                      <span className="w-[88px] shrink-0 text-right text-[12.5px] font-semibold text-primary">
                        {formatRupiah(perPerson)}
                      </span>
                    ) : (
                      <div className="flex w-[100px] shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1.5 focus-within:border-primary">
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
                          className="w-full bg-transparent text-[12px] outline-none"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.localId)}
                      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Hapus ${p.name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addParticipant}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-primary bg-card py-2.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-accent"
              >
                <Plus className="size-4" /> Tambah Peserta
              </button>
            </div>

            {method === "equal" && (
              <div className="flex items-center gap-2 rounded-[10px] bg-accent px-3 py-2.5">
                <span className="text-[12px] text-muted-foreground">
                  Per orang:{" "}
                  <strong className="text-primary">
                    {formatRupiah(perPerson)}
                  </strong>
                </span>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Share2 className="size-4" />
              {createMutation.isPending ? "Membuat..." : "Buat & Bagikan Link"}
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
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          {selectedSplit && (
            <>
              <DialogTitle className="mb-4 text-[17px] font-extrabold">
                {selectedSplit.title}
              </DialogTitle>

              <div className="mb-4 rounded-[14px] bg-accent p-[18px] text-center">
                <div className="text-[11px] text-muted-foreground">
                  Total Tagihan
                </div>
                <div className="text-[26px] font-black text-primary">
                  {formatRupiah(Number(BigInt(selectedSplit.totalAmount)))}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  {selectedSplit.participants.length > 0
                    ? `${formatRupiah(Math.round(Number(BigInt(selectedSplit.totalAmount)) / selectedSplit.participants.length))} / orang`
                    : ""}{" "}
                  · {selectedSplit.participants.length} peserta
                </div>
              </div>

              <div className="mb-2 text-[12px] font-bold text-muted-foreground">
                Status Pembayaran
              </div>
              <div className="space-y-0">
                {selectedSplit.participants.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
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
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatRupiah(Number(BigInt(p.amountOwed)))}
                      </div>
                    </div>
                    {p.status === "paid" ? (
                      <StatusBadge variant="success">Lunas</StatusBadge>
                    ) : (
                      <button
                        onClick={() =>
                          settleMutation.mutate({
                            splitId: selectedSplit.id,
                            participantId: p.id,
                          })
                        }
                        disabled={settleMutation.isPending}
                        className="shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-success hover:text-success disabled:opacity-50"
                      >
                        Tandai Lunas
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="my-4 flex items-center gap-2.5 rounded-[10px] border border-dashed bg-background px-3.5 py-3">
                <Link2 className="size-4 shrink-0 text-primary" />
                <span className="mono flex-1 overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-muted-foreground">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/split/${selectedSplit.shareToken}`
                    : `/split/${selectedSplit.shareToken}`}
                </span>
                <button
                  onClick={() => handleShareLink(selectedSplit)}
                  className="shrink-0 cursor-pointer rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
                >
                  Salin
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
