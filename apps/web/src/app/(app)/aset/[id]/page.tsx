"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  History,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
  DialogClose,
  DialogContent,
  PanelContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "./detail.css";
import {
  BentoCard,
  BentoGrid,
  BentoHero,
  DateField,
  GhostButton,
  HeroKpi,
  MiniList,
  MiniRow,
  PillButton,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
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
      <div data-page="aset-detail" className="ad-page">
        <Link href="/aset" className="ad-back ad-back-solo">
          <ArrowLeft className="size-3.5" aria-hidden="true" />{" "}
          {t.aset.detailBackLink}
        </Link>
        <p className="ad-empty">{t.aset.detailNotFound}</p>
      </div>
    );
  }

  const firstValue = rows.length > 0 ? Number(BigInt(rows[0].value)) : null;
  const nowValue = asset ? Number(BigInt(asset.currentValue)) : 0;
  const sinceFirst =
    firstValue && firstValue !== 0
      ? ((nowValue - firstValue) / firstValue) * 100
      : null;
  const docs = documents ?? [];

  return (
    <div data-page="aset-detail" className="ad-page">
      <BentoGrid className="ad-grid">
        <BentoHero
          className="ad-hero"
          valueAs="h1"
          currency={null}
          value={
            <span className="wm-money">
              {asset ? money.format(nowValue) : ""}
            </span>
          }
          caption={
            <>
              <Link href="/aset" className="ad-back">
                <ArrowLeft className="size-3.5" aria-hidden="true" />{" "}
                {t.aset.detailBackLink}
              </Link>
              <span className="ad-name">{asset?.name ?? "…"}</span>
            </>
          }
          controls={
            canManage && asset ? (
              <GhostButton lit onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden="true" />{" "}
                {t.aset.addHistoryButton}
              </GhostButton>
            ) : undefined
          }
          chart={
            <div className="ad-plot">
              {rows.length >= 2 ? (
                <HatchedBarChart
                  labels={rows.map((h) =>
                    dateFmt.format(new Date(h.recordedAt)),
                  )}
                  series={[
                    {
                      name: asset?.name ?? "",
                      data: rows.map((h) => Number(BigInt(h.value))),
                      color: "var(--wm-lime)",
                    },
                  ]}
                  format={money.formatCompact}
                  wide
                  ariaLabel={`${t.aset.detailChartTitle}: ${asset?.name ?? ""}`}
                />
              ) : (
                <p className="ad-empty">{t.aset.historyEmpty}</p>
              )}
            </div>
          }
          kpis={
            <>
              <HeroKpi
                label={t.aset.v2.detailKpiNow}
                value={
                  <span className="wm-money">{money.format(nowValue)}</span>
                }
              />
              <HeroKpi
                label={t.aset.v2.detailKpiFirst}
                value={
                  firstValue === null ? (
                    "—"
                  ) : (
                    <span className="wm-money">{money.format(firstValue)}</span>
                  )
                }
              />
              <HeroKpi
                label={t.aset.v2.detailKpiChange}
                value={
                  sinceFirst === null
                    ? "—"
                    : `${sinceFirst >= 0 ? "+" : ""}${sinceFirst.toFixed(2)}%`
                }
              />
            </>
          }
        />

        <BentoCard
          className="ad-docs"
          title={t.aset.documentsTitle}
          caption={`${docs.length} ${t.aset.v2.detailDocCount}`}
          action={
            canManage ? (
              <label className="wm-ghost-btn ad-upload">
                <Upload className="size-3.5" aria-hidden="true" />
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
        >
          {docs.length === 0 ? (
            <p className="ad-empty">{t.aset.documentsEmpty}</p>
          ) : (
            <ul className="ad-doclist">
              {docs.map((d) => (
                <li key={d.id} className="ad-doc">
                  <button
                    type="button"
                    className="ad-doc-open"
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
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                    <span>
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
                      className="ad-doc-del"
                      aria-label={t.aset.deleteDocumentAria}
                      onClick={() => void handleDeleteDoc(d.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        <BentoCard
          className="ad-hist"
          title={t.aset.detailHistoryTitle}
          caption={t.aset.v2.detailHistCaption}
        >
          {newestFirst.length === 0 ? (
            <p className="ad-empty">{t.aset.historyEmpty}</p>
          ) : (
            <MiniList>
              {newestFirst.map((h) => {
                const pct = h.changePercent ? Number(h.changePercent) : null;
                return (
                  <MiniRow
                    key={h.id}
                    icon={<History className="size-4" aria-hidden="true" />}
                    title={dateFmt.format(new Date(h.recordedAt))}
                    meta={`${t.aset.historyByPrefix}${h.recordedByName ?? t.aset.historySystemActor}${h.note ? ` · ${h.note}` : ""}`}
                    amount={
                      <span className="wm-money">
                        {money.format(Number(BigInt(h.value)))}
                        {pct !== null && (
                          <small className={pct >= 0 ? "ad-up" : "ad-down"}>
                            {pct >= 0 ? "+" : ""}
                            {pct.toFixed(2)}%
                          </small>
                        )}
                      </span>
                    }
                  />
                );
              })}
            </MiniList>
          )}
        </BentoCard>
      </BentoGrid>

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
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {t.aset.addHistoryDialogTitle}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {asset.name}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave && !mutation.isPending) mutation.mutate();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
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
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton
              type="submit"
              variant="primary"
              disabled={!canSave || mutation.isPending}
            >
              {t.aset.historySaveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}
