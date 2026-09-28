"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useMoney } from "@/hooks/use-money";
import {
  MoneyInput,
  moneyDigits,
  useMoneyField,
  withFxInputs,
} from "@/components/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard, DateField } from "@/components/wm";
import { TrendChart } from "@/components/charts/apex-presets";
import type {
  AssetAttachmentDto,
  AssetDto,
  AssetHistoryDto,
} from "@wealthme/contracts";
import {
  openAssetDocument,
  uploadAssetDocument,
} from "@/lib/asset-attachments";

/**
 * EPIC-033 group 3 (p16/p17) — one physical asset: its dated valuations
 * (who entered them, why), a value chart and an "Add History" entry that
 * takes either the new value or a percent change.
 */
export default function AssetDetailPage() {
  const { t, locale } = useLocale();
  const money = useMoney();
  const params = useParams<{ id: string }>();
  const assetId = params.id;
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? "";
  const { canManage } = useCanManage("Asset");
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: assets, isLoading } = useQuery<AssetDto[]>({
    queryKey: queryKeys.assets.all(familyGroupId),
    queryFn: () =>
      apiFetch<AssetDto[]>(`/family-groups/${familyGroupId}/assets`, { token }),
    enabled: !!token && !!familyGroupId,
  });
  const asset = assets?.find((a) => a.id === assetId) ?? null;

  const { data: history } = useQuery<AssetHistoryDto[]>({
    queryKey: queryKeys.assets.history(familyGroupId, assetId),
    queryFn: () =>
      apiFetch<AssetHistoryDto[]>(
        `/family-groups/${familyGroupId}/assets/${assetId}/history`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && !!assetId,
  });

  // EPIC-033 p14 — documents attached to this asset.
  const { data: documents } = useQuery<AssetAttachmentDto[]>({
    queryKey: [...queryKeys.assets.history(familyGroupId, assetId), "docs"],
    queryFn: () =>
      apiFetch<AssetAttachmentDto[]>(
        `/family-groups/${familyGroupId}/assets/${assetId}/attachments`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && !!assetId,
  });
  const [uploading, setUploading] = useState(false);
  async function invalidateDocs() {
    await queryClient.invalidateQueries({
      queryKey: [...queryKeys.assets.history(familyGroupId, assetId), "docs"],
    });
  }
  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAssetDocument(familyGroupId, assetId, file, token);
      toast.success(t.aset.toastDocumentUploaded);
      await invalidateDocs();
    } catch {
      toast.error(t.aset.toastDocumentFailed);
    } finally {
      setUploading(false);
    }
  }
  async function handleDeleteDoc(id: string) {
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/assets/${assetId}/attachments/${id}`,
        { method: "DELETE", token },
      );
      toast.success(t.aset.toastDocumentDeleted);
      await invalidateDocs();
    } catch {
      toast.error(t.aset.toastDocumentFailed);
    }
  }

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );
  const rows = history ?? [];
  const newestFirst = [...rows].reverse();

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.assets.history(familyGroupId, assetId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      }),
    ]);
  }

  if (!isLoading && !asset) {
    return (
      <div className="space-y-4">
        <Link href="/aset" className="card-link inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> {t.aset.detailBackLink}
        </Link>
        <div className="card p-6 text-[13px] text-muted-foreground">
          {t.aset.detailNotFound}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/aset"
            className="card-link inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" /> {t.aset.detailBackLink}
          </Link>
          <h1 className="section-title mt-1 truncate">{asset?.name ?? "…"}</h1>
          <div className="wm-money text-[22px] font-extrabold">
            {asset ? money.format(Number(BigInt(asset.currentValue))) : ""}
          </div>
        </div>
        {canManage && asset && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t.aset.addHistoryButton}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[260px_1fr]">
        {/* Date list */}
        <SectionCard title={t.aset.detailHistoryTitle} bodyClassName="pt-0">
          {newestFirst.length === 0 ? (
            <div className="py-3 text-[12.5px] text-muted-foreground">
              {t.aset.historyEmpty}
            </div>
          ) : (
            <ul className="divide-y">
              {newestFirst.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"
                >
                  <span className="text-muted-foreground">
                    {dateFmt.format(new Date(h.recordedAt))}
                  </span>
                  <span className="mono font-semibold">
                    {money.format(Number(BigInt(h.value)))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-3.5">
          {/* Chart */}
          <SectionCard title={t.aset.detailChartTitle}>
            {rows.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-muted-foreground">
                {t.aset.historyEmpty}
              </div>
            ) : (
              <TrendChart
                categories={rows.map((h) =>
                  dateFmt.format(new Date(h.recordedAt)),
                )}
                series={[
                  {
                    name: asset?.name ?? "",
                    data: rows.map((h) => Number(BigInt(h.value))),
                  },
                ]}
                height={260}
                ariaLabel={`${t.aset.detailChartTitle}: ${asset?.name ?? ""}`}
              />
            )}
          </SectionCard>

          {/* Documents (EPIC-033 p14) */}
          <SectionCard
            title={t.aset.documentsTitle}
            action={
              canManage ? (
                <label className="btn btn--outline btn--sm cursor-pointer">
                  <Upload className="size-3.5" />
                  {t.aset.uploadDocumentButton}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      void handleUpload(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : undefined
            }
            bodyClassName="pt-0"
          >
            {(documents ?? []).length === 0 ? (
              <div className="py-3 text-[12.5px] text-muted-foreground">
                {t.aset.documentsEmpty}
              </div>
            ) : (
              <ul className="divide-y">
                {(documents ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 text-left hover:underline"
                      aria-label={t.aset.openDocumentAria}
                      onClick={() =>
                        void openAssetDocument(
                          familyGroupId,
                          assetId,
                          d.id,
                          token,
                        )
                      }
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {d.mimeType
                          .replace("image/", "")
                          .replace("application/", "")
                          .toUpperCase()}
                        {" · "}
                        {Math.max(1, Math.ceil(d.size / 1024)).toLocaleString(
                          "id-ID",
                        )}{" "}
                        KB
                        {" · "}
                        {dateFmt.format(new Date(d.createdAt))}
                      </span>
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon text-destructive"
                        aria-label={t.aset.deleteDocumentAria}
                        onClick={() => void handleDeleteDoc(d.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Change list: who changed what */}
          <SectionCard title={t.aset.detailChangesTitle} bodyClassName="pt-0">
            {newestFirst.length === 0 ? (
              <div className="py-3 text-[12.5px] text-muted-foreground">
                {t.aset.historyEmpty}
              </div>
            ) : (
              <ul className="divide-y">
                {newestFirst.map((h) => {
                  const pct = h.changePercent ? Number(h.changePercent) : null;
                  return (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 text-[12.5px]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {money.format(Number(BigInt(h.value)))}
                          {pct !== null && (
                            <span
                              className={`mono ml-2 text-[11.5px] ${pct >= 0 ? "text-success" : "text-destructive"}`}
                            >
                              {pct >= 0 ? "+" : ""}
                              {pct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground">
                          {dateFmt.format(new Date(h.recordedAt))} ·{" "}
                          {t.aset.historyByPrefix}
                          {h.recordedByName ?? t.aset.historySystemActor}
                          {h.note ? ` · ${h.note}` : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {asset && (
        <AddHistoryDialog
          open={adding}
          asset={asset}
          familyGroupId={familyGroupId}
          token={token}
          onClose={() => setAdding(false)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

function AddHistoryDialog({
  open,
  asset,
  familyGroupId,
  token,
  onClose,
  onSaved,
}: {
  open: boolean;
  asset: AssetDto;
  familyGroupId: string;
  token: string | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, locale } = useLocale();
  const fieldId = useId();
  const [mode, setMode] = useState<"value" | "percent">("value");
  const valueField = useMoneyField();
  const [percent, setPercent] = useState("");
  const [recordedAt, setRecordedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<AssetHistoryDto>(
        `/family-groups/${familyGroupId}/assets/${asset.id}/history`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            ...(mode === "value"
              ? withFxInputs({ value: moneyDigits(valueField) }, [
                  ["value", valueField],
                ])
              : { changePercent: percent.replace(",", ".").trim() }),
            recordedAt: new Date(recordedAt).toISOString(),
            note: note.trim() || undefined,
          }),
        },
      ),
    onSuccess: async () => {
      toast.success(t.aset.toastHistorySaved);
      await onSaved();
      onClose();
    },
    onError: () => toast.error(t.aset.toastHistoryFailed),
  });

  const canSave =
    mode === "value"
      ? Number(moneyDigits(valueField) || "0") > 0 &&
        !valueField.resolved.isPending
      : /^-?\d+([.,]\d{1,2})?$/.test(percent.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog--sm">
        <DialogHeader>
          <DialogTitle>{t.aset.addHistoryDialogTitle}</DialogTitle>
          <DialogDescription>{asset.name}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="field">
            <span className="label" id={`${fieldId}-mode`}>
              {t.aset.historyModeValue} / {t.aset.historyModePercent}
            </span>
            <div
              className="segmented flex w-full"
              role="tablist"
              aria-labelledby={`${fieldId}-mode`}
            >
              {(
                [
                  ["value", t.aset.historyModeValue],
                  ["percent", t.aset.historyModePercent],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className="segmented__item flex-1"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {mode === "value" ? (
            <div className="field">
              <label className="label" htmlFor={`${fieldId}-value`}>
                {t.aset.historyValueLabel}
              </label>
              <MoneyInput field={valueField} id={`${fieldId}-value`} />
            </div>
          ) : (
            <div className="field">
              <label className="label" htmlFor={`${fieldId}-pct`}>
                {t.aset.historyPercentLabel}
              </label>
              <input
                id={`${fieldId}-pct`}
                className="input mono"
                inputMode="decimal"
                placeholder="-2,5"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
              <p className="hint">{t.aset.historyPercentHint}</p>
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-date`}>
              {t.aset.historyDateLabel}
            </label>
            <DateField
              id={`${fieldId}-date`}
              value={recordedAt}
              locale={locale}
              label={t.aset.historyDateLabel}
              max={new Date().toISOString().slice(0, 10)}
              onChange={setRecordedAt}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor={`${fieldId}-note`}>
              {t.aset.historyNoteLabel}
            </label>
            <input
              id={`${fieldId}-note`}
              type="text"
              className="input"
              placeholder={t.aset.historyNotePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn--primary disabled:opacity-60"
            disabled={!canSave || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t.aset.historySaveButton}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
