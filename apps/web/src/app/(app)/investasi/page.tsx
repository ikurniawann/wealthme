"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";

import { SectionCard, CardLink, StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";

import type { InvestmentDto, InvestmentSummaryDto } from "@wealthme/contracts";

const TYPE_BADGE: Record<
  string,
  { variant: "info" | "purple" | "warning" | "success" | "gray"; label: string }
> = {
  saham: { variant: "info", label: "Saham" },
  reksa_dana: { variant: "purple", label: "Reksa Dana" },
  obligasi: { variant: "success", label: "Obligasi" },
  emas: { variant: "warning", label: "Emas" },
  kripto: { variant: "info", label: "Kripto" },
  lainnya: { variant: "gray", label: "Lainnya" },
};

const TYPE_LOGO_BG: Record<string, string> = {
  saham: "#0061AF",
  reksa_dana: "#7C3AED",
  obligasi: "#1E3A5F",
  emas: "#D97706",
  kripto: "#F97316",
  lainnya: "#6B7280",
};

const INVESTMENT_TYPES = [
  { value: "saham", label: "Saham" },
  { value: "reksa_dana", label: "Reksa Dana" },
  { value: "obligasi", label: "Obligasi" },
  { value: "emas", label: "Emas" },
  { value: "kripto", label: "Kripto" },
  { value: "lainnya", label: "Lainnya" },
] as const;

type InvestmentType = (typeof INVESTMENT_TYPES)[number]["value"];

interface AddInvestmentForm {
  ticker: string;
  name: string;
  type: InvestmentType;
  quantity: string;
  costBasisPerUnit: string;
}

function toLogoText(ticker: string): string {
  return ticker.slice(0, 4).toUpperCase();
}

function formatDecimalRupiah(value: string | null): string {
  if (!value) return "—";
  return formatRupiah(parseFloat(value));
}

function formatReturnPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="gap-0 p-5">
      <SkeletonBlock className="mb-1 h-3 w-28" />
      <SkeletonBlock className="h-7 w-40" />
      <SkeletonBlock className="mt-1 h-3 w-36" />
    </Card>
  );
}

function HoldingRowSkeleton() {
  return (
    <tr className="border-b last:border-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={`skeleton-${i}`} className="py-3 pr-3">
          <SkeletonBlock className="h-4 w-20" />
        </td>
      ))}
    </tr>
  );
}

function AddInvestmentModal({
  open,
  onClose,
  familyGroupId,
  token,
}: {
  open: boolean;
  onClose: () => void;
  familyGroupId: string;
  token: string;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AddInvestmentForm>({
    ticker: "",
    name: "",
    type: "saham",
    quantity: "",
    costBasisPerUnit: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/family-groups/${familyGroupId}/investments`, {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      toast.success("Investasi ditambahkan");
      setForm({
        ticker: "",
        name: "",
        type: "saham",
        quantity: "",
        costBasisPerUnit: "",
      });
      onClose();
    } catch {
      toast.error("Gagal menambahkan investasi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Investasi</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="ticker"
            >
              Ticker
            </label>
            <input
              id="ticker"
              name="ticker"
              required
              value={form.ticker}
              onChange={handleChange}
              placeholder="contoh: BBCA"
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground" htmlFor="name">
              Nama
            </label>
            <input
              id="name"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="contoh: Bank Central Asia"
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground" htmlFor="type">
              Jenis
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            >
              {INVESTMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="quantity"
            >
              Jumlah (lot/unit)
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              required
              min="0"
              step="any"
              value={form.quantity}
              onChange={handleChange}
              placeholder="contoh: 10"
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="costBasisPerUnit"
            >
              Harga Beli per Unit (Rp)
            </label>
            <input
              id="costBasisPerUnit"
              name="costBasisPerUnit"
              type="number"
              required
              min="0"
              step="any"
              value={form.costBasisPerUnit}
              onChange={handleChange}
              placeholder="contoh: 9500"
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InvestasiPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;

  const apiUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

  const {
    data: holdings,
    isLoading: holdingsLoading,
    isError: holdingsError,
  } = useQuery<InvestmentDto[]>({
    queryKey: [...queryKeys.investments.all(familyGroupId ?? ""), token ?? ""],
    queryFn: () =>
      apiFetch<InvestmentDto[]>(`/family-groups/${familyGroupId}/investments`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const { data: summary, isLoading: summaryLoading } =
    useQuery<InvestmentSummaryDto>({
      queryKey: [
        ...queryKeys.investments.summary(familyGroupId ?? ""),
        token ?? "",
      ],
      queryFn: () =>
        apiFetch<InvestmentSummaryDto>(
          `/family-groups/${familyGroupId}/investments/summary`,
          { token },
        ),
      enabled: !!token && !!familyGroupId,
    });

  // Live price updates via Socket.io — join family-group room for tenant isolation
  useEffect(() => {
    if (!familyGroupId || !token) return;

    const socket = io(`${apiUrl}/prices`, {
      transports: ["websocket"],
      query: { familyGroupId },
      auth: { token },
    });

    socket.on("priceUpdate", () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [familyGroupId, token, queryClient, apiUrl]);

  // Show error toast on holdings fetch failure
  useEffect(() => {
    if (holdingsError) {
      toast.error("Gagal memuat data investasi. Silakan refresh halaman.");
    }
  }, [holdingsError]);

  const isLoading = holdingsLoading || summaryLoading;

  return (
    <div className="space-y-4">
      {familyGroupId && token && (
        <AddInvestmentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          familyGroupId={familyGroupId}
          token={token}
        />
      )}

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {isLoading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <Card className="gap-0 p-5">
              <div className="mb-1 text-[11px] text-muted-foreground">
                Total Nilai Investasi
              </div>
              <div className="text-[24px] font-black text-primary">
                {formatDecimalRupiah(summary?.totalCurrentValue ?? null)}
              </div>
              <div
                className={`mt-1 text-[12px] ${
                  (summary?.totalReturnPct ?? 0) >= 0
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {(summary?.totalReturnPct ?? 0) >= 0 ? "▲" : "▼"}{" "}
                {formatReturnPct(summary?.totalReturnPct ?? null)} ·{" "}
                {formatDecimalRupiah(summary?.totalReturnRp ?? null)} total
                return
              </div>
            </Card>
            <Card className="gap-0 p-5">
              <div className="mb-1 text-[11px] text-muted-foreground">
                Return Hari Ini
              </div>
              <div
                className={`text-[24px] font-black ${
                  (summary?.todayReturnPct ?? 0) >= 0
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {formatDecimalRupiah(summary?.todayReturnRp ?? null)}
              </div>
              <div
                className={`mt-1 text-[12px] ${
                  (summary?.todayReturnPct ?? 0) >= 0
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {formatReturnPct(summary?.todayReturnPct ?? null)} dari kemarin
              </div>
            </Card>
          </>
        )}
      </div>

      <SectionCard
        title="Portofolio"
        action={
          <CardLink onClick={() => setModalOpen(true)}>
            + Tambah Investasi
          </CardLink>
        }
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[580px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-3 font-semibold">Nama</th>
                <th className="py-2.5 pr-3 font-semibold">Jenis</th>
                <th className="py-2.5 pr-3 font-semibold">Modal</th>
                <th className="py-2.5 pr-3 font-semibold">Nilai</th>
                <th className="py-2.5 pr-3 font-semibold">Return</th>
                <th className="py-2.5 font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <HoldingRowSkeleton key={`row-skeleton-${i}`} />
                ))}

              {!isLoading && !holdingsError && holdings?.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-[13px] text-muted-foreground"
                  >
                    Belum ada investasi.{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary"
                      onClick={() => setModalOpen(true)}
                    >
                      Tambah sekarang
                    </button>
                  </td>
                </tr>
              )}

              {holdings?.map((h) => {
                const badge = TYPE_BADGE[h.type] ?? {
                  variant: "gray" as const,
                  label: h.type,
                };
                const logoBg = TYPE_LOGO_BG[h.type] ?? "#6B7280";
                const totalCost =
                  parseFloat(h.costBasisPerUnit) * parseFloat(h.quantity);
                const isUp = parseFloat(h.returnRp ?? "0") >= 0;

                return (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex size-8 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                          style={{ background: logoBg }}
                        >
                          {toLogoText(h.ticker)}
                        </div>
                        <div>
                          <div className="font-semibold">{h.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {h.ticker}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge variant={badge.variant}>
                        {badge.label}
                      </StatusBadge>
                    </td>
                    <td className="mono py-3 pr-3 whitespace-nowrap">
                      {formatRupiah(totalCost)}
                    </td>
                    <td className="mono py-3 pr-3 font-extrabold whitespace-nowrap">
                      {formatDecimalRupiah(h.currentValue)}
                    </td>
                    <td
                      className={`mono py-3 pr-3 whitespace-nowrap ${
                        isUp ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatDecimalRupiah(h.returnRp)}
                    </td>
                    <td
                      className={`py-3 font-semibold whitespace-nowrap ${
                        isUp ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatReturnPct(h.returnPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
