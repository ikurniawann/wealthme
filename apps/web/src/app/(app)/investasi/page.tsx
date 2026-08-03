"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { TrendingUp } from "lucide-react";

import {
  SectionCard,
  CardLink,
  StatusBadge,
  IconChip,
  CountUpRupiah,
  Rise,
} from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";

import type { InvestmentDto, InvestmentSummaryDto } from "@wealthme/contracts";

const TYPE_BADGE_VARIANT: Record<
  string,
  "info" | "purple" | "warning" | "success" | "gray"
> = {
  saham: "info",
  reksa_dana: "purple",
  obligasi: "success",
  emas: "warning",
  kripto: "info",
  lainnya: "gray",
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
  "saham",
  "reksa_dana",
  "obligasi",
  "emas",
  "kripto",
  "lainnya",
] as const;

type InvestmentType = (typeof INVESTMENT_TYPES)[number];

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
  editing,
}: {
  open: boolean;
  onClose: () => void;
  familyGroupId: string;
  token: string;
  editing?: InvestmentDto | null;
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AddInvestmentForm>(() =>
    editing
      ? {
          ticker: editing.ticker,
          name: editing.name,
          type: editing.type as InvestmentType,
          quantity: editing.quantity,
          costBasisPerUnit: editing.costBasisPerUnit,
        }
      : {
          ticker: "",
          name: "",
          type: "saham",
          quantity: "",
          costBasisPerUnit: "",
        },
  );

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
      const path = editing
        ? `/family-groups/${familyGroupId}/investments/${editing.id}`
        : `/family-groups/${familyGroupId}/investments`;
      await apiFetch(path, {
        method: editing ? "PATCH" : "POST",
        token,
        body: JSON.stringify(form),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      toast.success(
        editing ? t.investasi.toastUpdated : t.investasi.toastAdded,
      );
      onClose();
    } catch {
      toast.error(
        editing ? t.investasi.toastUpdateFailed : t.investasi.toastAddFailed,
      );
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
          <DialogTitle>
            {editing ? t.investasi.modalTitleEdit : t.investasi.modalTitleAdd}
          </DialogTitle>
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
              {t.investasi.fieldTickerLabel}
            </label>
            <input
              id="ticker"
              name="ticker"
              required
              value={form.ticker}
              onChange={handleChange}
              placeholder={t.investasi.fieldTickerPlaceholder}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground" htmlFor="name">
              {t.investasi.fieldNameLabel}
            </label>
            <input
              id="name"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder={t.investasi.fieldNamePlaceholder}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground" htmlFor="type">
              {t.investasi.fieldTypeLabel}
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            >
              {INVESTMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.investasi.typeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="quantity"
            >
              {t.investasi.fieldQuantityLabel}
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
              placeholder={t.investasi.fieldQuantityPlaceholder}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="costBasisPerUnit"
            >
              {t.investasi.fieldCostBasisLabel}
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
              placeholder={t.investasi.fieldCostBasisPlaceholder}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t.investasi.saving : t.investasi.saveButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InvestasiPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentDto | null>(
    null,
  );
  const [deletingHolding, setDeletingHolding] = useState<InvestmentDto | null>(
    null,
  );

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
      toast.error(t.investasi.errorLoad);
    }
  }, [holdingsError, t]);

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deletingHolding) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/investments/${deletingHolding.id}`,
        { method: "DELETE", token },
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      toast.success(t.investasi.toastDeleted);
    } catch {
      toast.error(t.investasi.toastDeleteFailed);
    } finally {
      setDeletingHolding(null);
    }
  }

  const isLoading = holdingsLoading || summaryLoading;

  return (
    <div className="space-y-4">
      {familyGroupId && token && (
        <AddInvestmentModal
          key={editingHolding?.id ?? "add"}
          open={modalOpen}
          editing={editingHolding}
          onClose={() => {
            setModalOpen(false);
            setEditingHolding(null);
          }}
          familyGroupId={familyGroupId}
          token={token}
        />
      )}
      <ConfirmDeleteDialog
        label={deletingHolding ? `"${deletingHolding.name}"` : null}
        onClose={() => setDeletingHolding(null)}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {isLoading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <Rise index={0}>
              <div className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <Card className="gap-0 p-5">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <IconChip
                      icon={TrendingUp}
                      className="bg-violet-100 text-violet-600"
                      size={34}
                      rounded="rounded-full"
                    />
                    {t.investasi.totalValueLabel}
                  </div>
                  <div className="mono text-[24px] font-black text-primary">
                    {summary?.totalCurrentValue != null ? (
                      <CountUpRupiah
                        value={parseFloat(summary.totalCurrentValue)}
                      />
                    ) : (
                      "—"
                    )}
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
                    {formatDecimalRupiah(summary?.totalReturnRp ?? null)}{" "}
                    {t.investasi.totalReturnSuffix}
                  </div>
                </Card>
              </div>
            </Rise>
            <Rise index={1}>
              <div className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <Card className="gap-0 p-5">
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    {t.investasi.todayReturnLabel}
                  </div>
                  <div
                    className={`mono text-[24px] font-black ${
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
                    {formatReturnPct(summary?.todayReturnPct ?? null)}{" "}
                    {t.investasi.vsYesterdaySuffix}
                  </div>
                </Card>
              </div>
            </Rise>
          </>
        )}
      </div>

      <SectionCard
        title={t.investasi.portfolioSectionTitle}
        action={
          <CardLink
            onClick={() => setModalOpen(true)}
            data-tour="add-investasi"
          >
            {t.investasi.addInvestmentLink}
          </CardLink>
        }
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[580px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableName}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableType}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableCapital}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableValue}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableReturn}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tablePercent}
                </th>
                <th className="py-2.5 font-semibold">
                  {t.investasi.tableAction}
                </th>
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
                    colSpan={7}
                    className="py-8 text-center text-[13px] text-muted-foreground"
                  >
                    {t.investasi.emptyState}{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary"
                      onClick={() => setModalOpen(true)}
                    >
                      {t.investasi.emptyStateCta}
                    </button>
                  </td>
                </tr>
              )}

              {holdings?.map((h, i) => {
                const variant = TYPE_BADGE_VARIANT[h.type] ?? "gray";
                const label =
                  t.investasi.typeLabels[h.type as InvestmentType] ?? h.type;
                const logoBg = TYPE_LOGO_BG[h.type] ?? "#6B7280";
                const totalCost =
                  parseFloat(h.costBasisPerUnit) * parseFloat(h.quantity);
                const isUp = parseFloat(h.returnRp ?? "0") >= 0;

                return (
                  <tr
                    key={h.id}
                    className="animate-rise border-b last:border-0"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
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
                      <StatusBadge variant={variant}>{label}</StatusBadge>
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
                      className={`py-3 pr-3 font-semibold whitespace-nowrap ${
                        isUp ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatReturnPct(h.returnPct)}
                    </td>
                    <td className="py-3">
                      <RowActions
                        onEdit={() => {
                          setEditingHolding(h);
                          setModalOpen(true);
                        }}
                        onDelete={() => setDeletingHolding(h)}
                      />
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
