"use client";

import { useLayoutEffect, useRef, useState } from "react";
import "./anggaran.css";
import {
  Car,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  Landmark,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AddTile,
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTiles,
  GhostButton,
  HeroKpi,
  PillButton,
  Segmented,
  SeeAll,
  TipsCard,
  Track,
} from "@/components/wm";
import { MoneyCompact } from "@/components/wm/money-compact";
import { CategoryIcon } from "@/components/shell/tx-pickers";
import { IconPickerField } from "@/components/crud/icon-picker-field";
import { AdvancedDisclosure } from "@/components/crud/advanced-disclosure";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/crud/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { parseRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  MoneyInput,
  useMoneyField,
  moneyIdr,
  withFxInputs,
} from "@/components/money";

import type {
  BudgetDto,
  BudgetPeriod,
  CreateBudgetDto,
  UpdateBudgetDto,
  LiabilityDto,
  LiabilityType,
  InsuranceDto,
  InsuranceType,
  FxInput,
} from "@wealthme/contracts";
import type { Locale } from "@/i18n";

function budgetTone(dto: BudgetDto): "lime" | "orange" | "bad" {
  if (dto.isOverBudget) return "bad";
  if (dto.isNearLimit) return "orange";
  return "lime";
}

const ICON_OPTIONS = ["🎓", "🎨", "🎁", "🐶", "👶", "📚", "💪", "🙏"];

/** 1 / 2 / 2.5 / 5 / 10 × 10^n — the tick top the prototype rounds to. */
function ceilNice(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Hero chart ported 1:1 from the prototype's `chart()` (anggaran.html:80) —
 * NOT the shared `HatchedBarChart` (grouped side-by-side bars), because the
 * prototype draws an OVERLAID pair per category: a ghost bar for the limit,
 * a hatched bar on top for what's spent, only the tightest category lit.
 * Capped at the 6 highest-usage categories so bars/labels stay readable
 * (prototype's own data never exceeds a handful; this account can have 13+).
 * The SVG draws in real pixels: its box is measured (ResizeObserver) and used
 * as the viewBox with the default `preserveAspectRatio`, so the 11px labels
 * are never scaled non-uniformly. The box starts at a 700x230 fallback and is
 * only replaced by a measured size > 0, so the ghost (limit) bars always draw
 * even before/without a measurement (an earlier measured version went blank
 * when every `spentAmount` was 0). Only the hatched overlay and the
 * top-category highlight are conditional on spend > 0. This SVG is a direct
 * child of `.wm-chart-wrap`, so it picks up the existing
 * `.wm-chart-wrap > svg { position:absolute; inset:0; width:100%; height:100% }`
 * rule the shared chart components already rely on (bento.css). */
function BudgetHeroChart({
  budgets,
  ariaLabel,
  emptyLabel,
}: {
  budgets: BudgetDto[];
  ariaLabel: string;
  emptyLabel: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { formatAxis } = useMoney();
  const [box, setBox] = useState({ w: 700, h: 230 });
  const hasData = budgets.length > 0;
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0) {
        setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasData]);

  if (!hasData) {
    return <p className="wm-cap">{emptyLabel}</p>;
  }

  const top6 = [...budgets]
    .sort((a, b) => b.usagePercent - a.usagePercent)
    .slice(0, 6);

  const { w: W, h: H } = box;
  const left = 58;
  const topPad = 34;
  const bottomPad = 26;
  // Ghost bars scale by max(limit, spent) across the visible set — always a
  // real, positive number even when every `spentAmount` is 0.
  const max = Math.max(
    1,
    ...top6.map((b) => Math.max(b.limitAmount, b.spentAmount)),
  );
  const top = ceilNice(max);
  const y = (v: number) =>
    topPad + ((top - v) / top) * (H - topPad - bottomPad);
  const band = (W - left) / top6.length;
  const barW = Math.min(56, band * 0.62);
  // The tightest category is only "lit" (hatched + % tag) once something
  // has actually been spent — with a fresh/empty month every bar is a
  // plain ghost column, no fabricated emphasis on a 0% category.
  const hiIndex = top6.reduce(
    (best, b, i) =>
      b.spentAmount > 0 &&
      (best < 0 || b.usagePercent > (top6[best]?.usagePercent ?? -1))
        ? i
        : best,
    -1,
  );

  // Labels that would overlap are dropped, never squashed: the lit category
  // keeps its label, the rest are added left to right while they fit.
  const labelOf = (b: BudgetDto) => b.categoryName.split(" ")[0] ?? "";
  const halfWidth = (i: number) =>
    ((top6[i] ? labelOf(top6[i]).length : 0) * (i === hiIndex ? 6.9 : 6.4)) / 2;
  const shownLabels: number[] = hiIndex >= 0 ? [hiIndex] : [];
  top6.forEach((_, i) => {
    if (i === hiIndex) return;
    const fits = shownLabels.every(
      (j) => Math.abs(i - j) * band >= halfWidth(i) + halfWidth(j) + 4,
    );
    if (fits) shownLabels.push(i);
  });
  const showLabel = (i: number) => shownLabels.includes(i);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
      role="img"
      aria-label={ariaLabel}
    >
      <g aria-hidden="true">
        <defs>
          <pattern
            id="ag-hatch-orange"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={8} height={8} fill="var(--wm-orange)" />
            <rect width={2} height={8} fill="rgba(255,255,255,.28)" />
          </pattern>
          <pattern
            id="ag-hatch-bad"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={8} height={8} fill="var(--wm-bad)" />
            <rect width={2} height={8} fill="rgba(255,255,255,.28)" />
          </pattern>
        </defs>
        {[0, top / 2, top].map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--cgrid)"
              strokeDasharray={t ? "3 4" : undefined}
            />
            <text
              x={left - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              style={{ fill: "var(--ctext)", fontSize: 11 }}
            >
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {top6.map((b, i) => {
          const x = left + band * i + band / 2 - barW / 2;
          const on = i === hiIndex;
          const tone = b.isOverBudget ? "bad" : "orange";
          const label = labelOf(b);
          return (
            <g key={b.id} style={{ animationDelay: `${i * 40}ms` }}>
              <title>{b.categoryName}</title>
              <rect
                x={x}
                y={y(b.limitAmount)}
                width={barW}
                height={Math.max(0, y(0) - y(b.limitAmount))}
                rx={8}
                fill="var(--cghost)"
              />
              {b.spentAmount > 0 && (
                <rect
                  x={x}
                  y={y(Math.min(b.spentAmount, max))}
                  width={barW}
                  height={Math.max(3, y(0) - y(b.spentAmount))}
                  rx={8}
                  fill={on ? `url(#ag-hatch-${tone})` : "var(--ctext)"}
                  opacity={on ? 1 : 0.28}
                />
              )}
              {showLabel(i) && (
                <text
                  x={x + barW / 2}
                  y={H - 8}
                  textAnchor="middle"
                  style={
                    on
                      ? {
                          fill: "var(--cstrong)",
                          fontSize: 11,
                          fontWeight: 500,
                        }
                      : { fill: "var(--ctext)", fontSize: 11 }
                  }
                >
                  {label}
                </text>
              )}
              {on &&
                (() => {
                  const text = `${b.usagePercent}%`;
                  const pillW = Math.max(48, text.length * 8 + 16);
                  const cx = x + barW / 2;
                  const px = Math.max(0, Math.min(W - pillW, cx - pillW / 2));
                  const py = y(Math.max(b.spentAmount, b.limitAmount)) - 28;
                  return (
                    <g>
                      <rect
                        x={px}
                        y={py}
                        width={pillW}
                        height={22}
                        rx={11}
                        fill="var(--cstrong)"
                      />
                      <text
                        x={px + pillW / 2}
                        y={py + 15}
                        textAnchor="middle"
                        style={{
                          fill: "var(--cbg)",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {text}
                      </text>
                    </g>
                  );
                })()}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Proto's card is `.btile` (a clickable button) with ONE compact footer
// line, a line icon on a white rounded square (`.ci`), and no inline
// edit/delete affordances — "Ketuk kartu untuk ubah batas" (anggaran.html:44).
// Edit opens the side panel; delete moved into that panel's footer.
function BudgetTile({
  dto,
  canManage,
  onEdit,
}: {
  dto: BudgetDto;
  canManage: boolean;
  onEdit: () => void;
}) {
  const { t } = useLocale();
  const tone = budgetTone(dto);
  return (
    <button
      type="button"
      className="wm-btile ag-tile"
      data-tone={tone}
      disabled={!canManage}
      onClick={canManage ? onEdit : undefined}
      aria-label={
        canManage
          ? `${t.anggaran.editAriaLabelPrefix}${dto.categoryName}`
          : undefined
      }
    >
      <span className="wm-btile-tt">
        <span className="wm-ci">
          <CategoryIcon name={dto.categoryName} />
        </span>
        <span className="ag-name">{dto.categoryName}</span>
      </span>
      <span className="wm-pv ag-pv">{dto.usagePercent}%</span>
      <Track value={dto.usagePercent} fill={tone} />
      <small className="ag-foot">
        {dto.isOverBudget ? (
          <MoneyCompact
            prefix={t.anggaran.categoryFooterOverBudgetPrefix}
            value={dto.spentAmount - dto.limitAmount}
          />
        ) : (
          <MoneyCompact
            prefix={t.anggaran.categoryFooterRemainingPrefix}
            value={dto.remainingAmount}
          />
        )}
        {" · "}
        <MoneyCompact value={dto.limitAmount} />
      </small>
    </button>
  );
}

function BudgetSkeleton() {
  return (
    <div className="ag-skeleton" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="wm-btile animate-pulse" />
      ))}
    </div>
  );
}

// EPIC-023 E2 — mirrors transaction-dialog.tsx's local `AccountDto` shape.
type AccountDto = { id: string; name: string; institution: string | null };

type Obligation = {
  kind: "liability" | "insurance";
  id: string;
  name: string;
  amountDue: number;
  paidThisPeriod: boolean;
  // EPIC-025 N3 rework — prototype's row icon + due-date text
  // (`docs/prototype/pages/anggaran.html`'s "Kewajiban Bulan Ini"). Both
  // derived from real fields already on the DTO (`type` → icon,
  // `dueDate`/`renewalDate` → due date) — no fabricated data.
  dueDate: string | null;
  icon: LucideIcon;
};

// EPIC-025 N3 rework, line-icon pass — one lucide icon per liability/
// insurance `type`, matching the prototype's per-row icon on a neutral
// square (anggaran.html's `.ic`, not a colored emoji glyph). Falls back to
// a generic document icon for any type not explicitly mapped.
const LIABILITY_ICONS: Record<LiabilityType, LucideIcon> = {
  kpr: Home,
  kartu_kredit: CreditCard,
  pinjaman_pribadi: Landmark,
  kendaraan: Car,
  lainnya: FileText,
};
const INSURANCE_ICONS: Record<InsuranceType, LucideIcon> = {
  jiwa: ShieldCheck,
  kesehatan: Stethoscope,
  kendaraan: Car,
  properti: Home,
  pendidikan: GraduationCap,
  lainnya: FileText,
};

/**
 * EPIC-023 E2 (D11, US-LIAB-3) — "this period's obligations" is built by
 * listing active liabilities/insurances directly (NOT derived from the
 * `Budget` rows themselves): every liability in a family shares ONE FIXED
 * budget line per category (`LiabilitiesService.create()`'s doc comment),
 * so a single Budget row cannot unambiguously identify "which liability" for
 * a per-item Pay action. The underlying obligation lists (already tenant-
 * scoped, already carrying `paidThisPeriod` from EPIC-023 E2's backend
 * change) give an unambiguous 1:1 Pay target per row instead.
 */
function toObligations(
  liabilities: LiabilityDto[],
  insurances: InsuranceDto[],
): Obligation[] {
  const fromLiabilities: Obligation[] = liabilities
    .filter(
      (l) => Number(l.minimumPayment) > 0 && Number(l.remainingBalance) > 0,
    )
    .map((l) => ({
      kind: "liability",
      id: l.id,
      name: l.name,
      // EPIC-023 Task E retry (MEDIUM 7) — truncate once, here, so the
      // amount the row DISPLAYS (`money.format(obligation.amountDue)`) is
      // byte-identical to the amount the pay mutation POSTS
      // (`String(Math.trunc(obligation.amountDue))`) instead of the two
      // computing the truncation independently and drifting apart.
      amountDue: Math.trunc(
        Number(l.currentInstallmentAmount ?? l.minimumPayment),
      ),
      paidThisPeriod: l.paidThisPeriod,
      // fix-round1 (Minor) — `dueDate` is the legacy manual field the KPR
      // form never sets; `nextDueDate` (same anchor rule /liabilitas uses)
      // is the real "next due" value when present.
      dueDate: l.nextDueDate ?? l.dueDate,
      icon: LIABILITY_ICONS[l.type] ?? FileText,
    }));
  const fromInsurances: Obligation[] = insurances
    .filter((i) => i.status === "aktif" && Number(i.premiumAmount) > 0)
    .map((i) => ({
      kind: "insurance",
      id: i.id,
      name: i.name,
      amountDue: Number(i.premiumAmount),
      paidThisPeriod: i.paidThisPeriod,
      dueDate: i.renewalDate,
      icon: INSURANCE_ICONS[i.type] ?? FileText,
    }));
  return [...fromLiabilities, ...fromInsurances];
}

function formatLocaleDate(
  iso: string,
  locale: Locale,
  month: "short" | "long" = "long",
): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month,
    year: "numeric",
  });
}

/** Compact due date, no year — proto's obligations row ("4 Okt"), distinct
 * from `formatLocaleDate`'s full "4 Oktober 2026" used by the pay dialog. */
function formatDueShort(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
  });
}

function PayObligationDialog({
  obligation,
  accounts,
  sourceAccountId,
  onSourceAccountChange,
  isPending,
  onClose,
  onConfirm,
}: {
  obligation: Obligation | null;
  accounts: AccountDto[];
  sourceAccountId: string;
  onSourceAccountChange: (id: string) => void;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  return (
    <Dialog
      open={obligation !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      {/* EPIC-026 — composition ported 1:1 from the prototype's `dlg-pay`
          (docs/prototype/pages/anggaran.html:454): `dialog--sm` box, title +
          `.dialog__desc`, a `.notice` carrying name / amount / due date, one
          `.field` source-account select, and a Batal / Bayar Sekarang
          `.dialog__footer`. */}
      <DialogContent className="dialog--sm">
        <DialogTitle>{t.anggaran.obligationsPayDialogTitle}</DialogTitle>
        <DialogDescription>
          {t.anggaran.obligationsPayDialogDesc}
        </DialogDescription>
        {obligation && (
          <DialogBody>
            <div className="notice">
              <div className="flex-1">
                <div className="t-xs t-muted">{obligation.name}</div>
                <div className="t-xl t-black mono">
                  {money.format(obligation.amountDue)}
                </div>
                {/* EPIC-026 Wave 4 — prototype's pay-dialog notice carries the
                    due date under the amount (`dlg-pay`, anggaran.html:463);
                    same `dueDate` the row already renders. */}
                {obligation.dueDate && (
                  <div className="t-xs t-muted">
                    {t.anggaran.obligationsDueDateNoticePrefix}
                    {formatLocaleDate(obligation.dueDate, locale)}
                  </div>
                )}
              </div>
            </div>
            <div className="field mt-3">
              <label className="label" htmlFor="obligation-source-account">
                {t.anggaran.obligationsSourceAccountLabel}
              </label>
              <select
                id="obligation-source-account"
                value={sourceAccountId}
                onChange={(e) => onSourceAccountChange(e.target.value)}
                className="select"
              >
                <option value="">
                  {t.anggaran.obligationsSourceAccountPlaceholder}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.institution ? ` (${a.institution})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={isPending || !sourceAccountId} onClick={onConfirm}>
            {isPending
              ? t.anggaran.obligationsPayProcessing
              : t.anggaran.obligationsPayConfirmButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObligationRow({
  obligation,
  index,
  onPay,
}: {
  obligation: Obligation;
  index: number;
  onPay: () => void;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const Icon = obligation.icon;
  const dueDateLabel = obligation.dueDate
    ? formatDueShort(obligation.dueDate, locale)
    : null;
  // Proto's obligations row (anggaran.html's `obList`): a neutral line-icon
  // square, ONE meta line ("Rp 545.000 · 4 Okt" — no year, no "jatuh
  // tempo" prefix), and a lime "Bayar" pill. Keeps the original `<div>`
  // nesting depth (row > icon + content > name-row/meta-row) rather than
  // `MiniRow`'s span-based shape, since several regression tests scope
  // themselves off that nesting (`getByText(name).closest("div")…`).
  // `Rise`'s own wrapper is a <div>, invalid as a direct <ul> child — apply
  // its stagger animation inline on the <li> instead.
  return (
    <li className="animate-rise" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex items-center gap-3 py-3 ag-ob-row">
        <div className="wm-ic">
          <Icon aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
            <span>{obligation.name}</span>
          </div>
          <div className="mono text-[11.5px] text-muted-foreground">
            {money.format(obligation.amountDue)}
            {dueDateLabel && ` · ${dueDateLabel}`}
          </div>
        </div>
        {/* An already-paid obligation is a neutral, non-interactive status
            (no second Pay click possible); an open one gets the shared
            outline "Bayar" pill — forest commit is reserved for the page
            primary, same rule as Liabilitas. */}
        {obligation.paidThisPeriod ? (
          <span className="wm-paid-note ag-ob-paid">
            {t.anggaran.obligationsAlreadyPaidButton}
          </span>
        ) : (
          <PillButton className="wm-pay-sm ag-ob-pay" onClick={onPay}>
            {t.anggaran.obligationsPayButton}
          </PillButton>
        )}
      </div>
    </li>
  );
}

/**
 * EPIC-023 E2 (D11, US-LIAB-3) — "this period's obligations" list with a
 * Pay action + source-account picker, calling the REAL liability/insurance
 * pay endpoints. Section is hidden entirely when there are no obligations
 * (Honest UI — no empty promise of a feature with nothing to show).
 */
export function ObligationsSection({
  familyGroupId,
  token,
}: {
  familyGroupId: string;
  token: string | undefined;
}) {
  const { t } = useLocale();
  const { handleError } = useApiError();
  const money = useMoney();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Obligation | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState("");

  const { data: liabilities = [] } = useQuery<LiabilityDto[]>({
    queryKey: queryKeys.liabilities.all(familyGroupId),
    queryFn: () =>
      apiFetch<LiabilityDto[]>(`/family-groups/${familyGroupId}/liabilities`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const { data: insurances = [] } = useQuery<InsuranceDto[]>({
    queryKey: queryKeys.insurances.all(familyGroupId),
    queryFn: () =>
      apiFetch<InsuranceDto[]>(`/family-groups/${familyGroupId}/insurances`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const payMutation = useMutation({
    mutationFn: (params: {
      obligation: Obligation;
      sourceAccountId: string;
    }) => {
      const path =
        params.obligation.kind === "liability"
          ? `/family-groups/${familyGroupId}/liabilities/${params.obligation.id}/pay`
          : `/family-groups/${familyGroupId}/insurances/${params.obligation.id}/pay`;
      const body: { sourceAccountId: string; amount?: string } = {
        sourceAccountId: params.sourceAccountId,
      };
      // Liability pay() requires an explicit amount (variable balance); the
      // insurance side defaults to premiumAmount when omitted. `amountDue`
      // is already truncated in `toObligations` (MEDIUM 7) — posting it
      // as-is here keeps this value byte-identical to what the row and the
      // dialog displayed, instead of truncating a second time and risking
      // the two drifting apart.
      if (params.obligation.kind === "liability") {
        body.amount = String(params.obligation.amountDue);
      }
      return apiFetch(path, {
        token,
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      // Paying moves money — invalidate every view it can change, mirroring
      // transaction-dialog.tsx's invalidation set.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liabilities.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liabilities.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["reports", familyGroupId],
      });
      setTarget(null);
      setSourceAccountId("");
      toast.success(t.anggaran.obligationsToastPaySuccess);
    },
    onError: handleError,
  });

  const obligations = toObligations(liabilities, insurances);
  if (obligations.length === 0) return null;

  // EPIC-025 N3 rework — prototype's right-aligned section summary
  // ("3 dari 5 belum dibayar · Rp 5.945.000"), derived from the same
  // obligations list already rendered below — no new data.
  const unpaid = obligations.filter((o) => !o.paidThisPeriod);
  const unpaidTotal = unpaid.reduce((sum, o) => sum + o.amountDue, 0);

  return (
    <BentoCard
      className="ag-ob"
      title={t.anggaran.obligationsSectionTitle}
      // Proto's `.cap` is just "{N} belum dibayar" (anggaran.html:37) — the
      // total moves into its own `.mid` headline below, matching the
      // "Riwayat" card's `wm-mid` pattern (splitbill/page.tsx:667).
      caption={`${unpaid.length}${t.anggaran.obligationsSummaryMidSuffix.replace(/\s*·\s*$/, "")}`}
    >
      <p className="wm-mid">{money.format(unpaidTotal)}</p>
      <ul className="wm-mini-list ag-ob-list">
        {obligations.map((o, i) => (
          <ObligationRow
            key={`${o.kind}-${o.id}`}
            obligation={o}
            index={i}
            onPay={() => setTarget(o)}
          />
        ))}
      </ul>
      <PayObligationDialog
        obligation={target}
        accounts={accounts}
        sourceAccountId={sourceAccountId}
        onSourceAccountChange={setSourceAccountId}
        isPending={payMutation.isPending}
        onClose={() => {
          setTarget(null);
          setSourceAccountId("");
        }}
        onConfirm={() => {
          if (target && sourceAccountId) {
            payMutation.mutate({ obligation: target, sourceAccountId });
          }
        }}
      />
      <SeeAll href="/liabilitas">{t.anggaran.v2.seeAllObligations}</SeeAll>
    </BentoCard>
  );
}

export default function AnggaranPage() {
  const { t, locale } = useLocale();
  const { handleError } = useApiError();
  const money = useMoney();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<"pct" | "left">("pct");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_OPTIONS[0] ?? "🎓");
  const amountField = useMoneyField();
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");
  // EPIC-022 C2 — the API already exposed PATCH/DELETE for a budget;
  // `editing`/`deletingBudget` drive the two dialogs that finally reach them.
  const [editing, setEditing] = useState<BudgetDto | null>(null);
  const editField = useMoneyField({ isEdit: true });
  const [editPeriod, setEditPeriod] = useState<BudgetPeriod>("monthly");
  const [deletingBudget, setDeletingBudget] = useState<BudgetDto | null>(null);
  // A budget has no fields of its own beyond amount + period: the icon, the
  // kind and the COA mapping all live on the Category it belongs to, and this
  // dialog was already creating that Category silently — as `kind: "expense"`
  // with whatever COA account the server defaulted to. These make that
  // creation explicit, so "add a budget" and "add a COA category" are the same
  // act rather than one quietly implying the other.
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [coaAccountId, setCoaAccountId] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  // F3 — CASL only grants "manage Category" to owner/spouse; a `member` has
  // "manage Budget" but only "read Category". The dialog used to always
  // create a brand-new Category first regardless of role, so a member could
  // never finish adding a budget (403 on the category POST). When the
  // signed-in role can't create a category, this flow instead requires
  // picking one of the family's EXISTING categories of the chosen kind.
  const { canManage: canManageCategory } = useCanManage("Category");
  const [existingCategoryId, setExistingCategoryId] = useState("");
  // F3 — CASL grants "manage Budget" to owner/spouse/member; admin_staff
  // (and any role without a Budget grant at all) is read-only.
  const { canManage: canManageBudget } = useCanManage("Budget");

  const {
    data: budgets,
    isLoading,
    isError,
  } = useQuery<BudgetDto[]>({
    queryKey: queryKeys.budgets.all(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<BudgetDto[]>(`/family-groups/${familyGroupId}/budgets`, {
        token,
        signal,
      });
    },
    enabled: !!token && !!familyGroupId,
  });

  // Same query key as /mastercoa and /masterdata so the cache is shared —
  // this dialog now offers the same COA account list those pages do.
  const { data: coaAccounts } = useQuery<
    Array<{ id: string; code: string; name: string; direction: string }>
  >({
    queryKey: ["coa-accounts", familyGroupId],
    queryFn: () =>
      apiFetch<
        Array<{ id: string; code: string; name: string; direction: string }>
      >(`/family-groups/${familyGroupId}/coa-accounts`, { token }),
    enabled: !!token && !!familyGroupId,
    staleTime: 60_000,
  });

  // Offering every account here would let the user pick the one pairing that
  // is never right — an expense category on an INCOME account (or the
  // reverse), which reports then group under the wrong direction. The API
  // rejects it too (categories.service.ts), but a dropdown that cannot make
  // the mistake beats an error after pressing Save.
  //
  // TRANSFER accounts stay available for BOTH types on purpose: the seeded
  // chart maps "Cicilan KPR" and "Tabungan & Investasi" — both `expense` — to
  // TRANSFER accounts, because paying down principal is spending in cashflow
  // terms but a balance-sheet transfer, not a P&L line.
  const selectableCoaAccounts = (coaAccounts ?? []).filter((a) =>
    kind === "income" ? a.direction !== "EXPENSE" : a.direction !== "INCOME",
  );

  // F3 fix — a member (manage Budget, read-only Category) picks from the
  // family's EXISTING categories instead of the create-a-category flow
  // below. Same query key as /masterdata and /mastercoa so the cache (and
  // any category just added there) is shared.
  const { data: allCategories } = useQuery<
    Array<{ id: string; name: string; kind: "income" | "expense" }>
  >({
    queryKey: ["categories", familyGroupId],
    queryFn: () =>
      apiFetch<Array<{ id: string; name: string; kind: "income" | "expense" }>>(
        `/family-groups/${familyGroupId}/categories`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && canManageCategory === false,
    staleTime: 60_000,
  });
  const selectableCategories = (allCategories ?? []).filter(
    (c) => c.kind === kind,
  );

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      icon: string;
      limitAmount: number;
      period: BudgetPeriod;
      kind: "income" | "expense";
      coaAccountId: string;
      isPrivate: boolean;
      existingCategoryId: string;
      fxInputs?: FxInput[];
    }) => {
      if (!familyGroupId) throw new Error("familyGroupId missing");

      let categoryId: string;
      if (canManageCategory === false) {
        // Member flow — never POST /categories (403s on "manage Category");
        // the picker above already restricts this to an existing category.
        if (!payload.existingCategoryId) {
          throw new Error(t.anggaran.errorCategoryRequired);
        }
        categoryId = payload.existingCategoryId;
      } else {
        try {
          const cat = await apiFetch<{ id: string }>(
            `/family-groups/${familyGroupId}/categories`,
            {
              method: "POST",
              token,
              body: JSON.stringify({
                name: payload.name,
                kind: payload.kind,
                icon: payload.icon,
                isPrivate: payload.isPrivate,
                // "" means "let the server default by kind" — omitted rather
                // than sent as an empty string, which the uuid validator rejects.
                ...(payload.coaAccountId
                  ? { coaAccountId: payload.coaAccountId }
                  : {}),
              }),
            },
          );
          categoryId = cat.id;
        } catch (err) {
          const apiErr = err as { status?: number; message?: string };
          if (apiErr.status === 409) {
            const cats = await apiFetch<Array<{ id: string; name: string }>>(
              `/family-groups/${familyGroupId}/categories?kind=${payload.kind}`,
              { token },
            );
            const match = cats.find(
              (c) => c.name.toLowerCase() === payload.name.toLowerCase(),
            );
            if (!match)
              throw new Error(t.anggaran.errorCategoryNotFoundAfterConflict);
            categoryId = match.id;
          } else {
            throw err;
          }
        }
      }

      const dto: CreateBudgetDto = {
        categoryId,
        period: payload.period,
        limitAmount: payload.limitAmount,
        ...(payload.fxInputs ? { fxInputs: payload.fxInputs } : {}),
      };
      return apiFetch<BudgetDto>(`/family-groups/${familyGroupId}/budgets`, {
        method: "POST",
        token,
        body: JSON.stringify(dto),
      });
    },
    onSuccess: (budget) => {
      if (familyGroupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.all(familyGroupId),
        });
      }
      setOpen(false);
      resetForm();
      toast.success(
        `${t.anggaran.toastCategoryAddedPrefix}${budget.categoryName}${t.anggaran.toastCategoryAddedSuffix}`,
      );
    },
    onError: handleError,
  });

  // EPIC-022 C2 — edit an existing budget's limit/period. The category
  // itself is not editable here (the API's `UpdateBudgetDto` has no
  // `categoryId` field — a budget belongs to the category it was created
  // for), matching `/anggaran`'s own model of "one budget per category".
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      limitAmount: number;
      period: BudgetPeriod;
      fxInputs?: FxInput[];
    }) => {
      if (!familyGroupId) throw new Error("familyGroupId missing");
      const dto: UpdateBudgetDto = {
        limitAmount: payload.limitAmount,
        period: payload.period,
        ...(payload.fxInputs ? { fxInputs: payload.fxInputs } : {}),
      };
      return apiFetch<BudgetDto>(
        `/family-groups/${familyGroupId}/budgets/${payload.id}`,
        { method: "PATCH", token, body: JSON.stringify(dto) },
      );
    },
    onSuccess: () => {
      if (familyGroupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.all(familyGroupId),
        });
      }
      setEditing(null);
      toast.success(t.anggaran.toastUpdated);
    },
    onError: handleError,
  });

  function openEdit(budget: BudgetDto) {
    setEditing(budget);
    editField.reset(String(budget.limitAmount));
    setEditPeriod(budget.period);
  }

  function handleSaveEdit() {
    if (!editing) return;
    if (editField.resolved.isPending) return;
    const limitAmount = moneyIdr(editField, parseRupiah);
    if (limitAmount <= 0) {
      toast.warning(t.anggaran.toastAmountInvalid);
      return;
    }
    updateMutation.mutate(
      withFxInputs(
        {
          id: editing.id,
          limitAmount,
          period: editPeriod,
        },
        [["limitAmount", editField]],
      ),
    );
  }

  async function handleDeleteBudget() {
    if (!familyGroupId || !token || !deletingBudget) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/budgets/${deletingBudget.id}`,
        { token, method: "DELETE" },
      );
      toast.success(t.anggaran.toastDeleted);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all(familyGroupId),
      });
    } catch (err: unknown) {
      handleError(err);
    } finally {
      setDeletingBudget(null);
    }
  }

  function resetForm() {
    setName("");
    setIcon(ICON_OPTIONS[0] ?? "🎓");
    amountField.reset();
    setPeriod("monthly");
    setKind("expense");
    setCoaAccountId("");
    setIsPrivate(false);
    setExistingCategoryId("");
  }

  function handleSave() {
    // F3 fix — a member picks an existing category instead of naming a new
    // one; the create-a-category fields below don't apply to that flow.
    if (canManageCategory === false) {
      if (!existingCategoryId) {
        toast.warning(t.anggaran.errorCategoryRequired);
        return;
      }
    } else if (!name.trim()) {
      toast.warning(t.anggaran.toastNameRequired);
      return;
    }
    const limitAmount = moneyIdr(amountField, parseRupiah);
    if (limitAmount <= 0) {
      toast.warning(t.anggaran.toastAmountInvalid);
      return;
    }
    if (!familyGroupId) {
      toast.error(t.anggaran.toastNoFamilyGroup);
      return;
    }
    if (amountField.resolved.isPending) return;
    createMutation.mutate(
      withFxInputs(
        {
          name: name.trim(),
          icon,
          limitAmount,
          period,
          kind,
          coaAccountId,
          isPrivate,
          existingCategoryId,
        },
        [["limitAmount", amountField]],
      ),
    );
  }

  const totalLimit = budgets?.reduce((s, b) => s + b.limitAmount, 0) ?? 0;
  const totalSpent = budgets?.reduce((s, b) => s + b.spentAmount, 0) ?? 0;
  const totalRemaining = Math.max(0, totalLimit - totalSpent);
  const overBudgetItems = budgets?.filter((b) => b.isOverBudget) ?? [];
  const nearLimitItems = budgets?.filter((b) => b.isNearLimit) ?? [];

  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const usagePct =
    totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  const sortedBudgets = (budgets ?? [])
    .slice()
    .sort((x, y) =>
      sort === "pct"
        ? y.usagePercent - x.usagePercent
        : y.remainingAmount - x.remainingAmount,
    );
  const monthLabel = now.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    month: "long",
  });
  const worst = overBudgetItems[0] ?? nearLimitItems[0];
  const mosaicFilled = Math.round((Math.min(usagePct, 100) / 100) * 18);
  const mosaic = Array.from({ length: 18 }, (_, i) =>
    i < mosaicFilled
      ? usagePct >= 100
        ? "o"
        : i > mosaicFilled - 4
          ? "c"
          : "a"
      : i % 5 === 0
        ? "b"
        : "",
  ) as ("a" | "b" | "c" | "o" | "")[];

  return (
    <BentoGrid className="ag-grid">
      <BentoHero
        className="ag-hero"
        currency={null}
        value={money.format(Math.abs(totalLimit - totalSpent))}
        caption={`${totalLimit >= totalSpent ? t.anggaran.v2.leftCap : t.anggaran.v2.overCap} ${monthLabel}`}
        controls={
          // Proto's `.hero-ctrl` is itself a column (buttons row, legend
          // row below, both right-aligned) — `wm-hero-ctrl` only right-
          // aligns its own direct children, so without this wrapper the
          // month pill / button / legend all sat on ONE wrapping flex row
          // (anggaran.html:22-24).
          <div className="ag-hero-ctrl">
            <div className="ag-ctrl-row">
              <span className="wm-ghost-btn ag-month">{monthLabel}</span>
              {canManageBudget && (
                <GhostButton
                  lit
                  onClick={() => setOpen(true)}
                  disabled={!familyGroupId}
                >
                  <Plus aria-hidden="true" /> {t.anggaran.addCategoryButton}
                </GhostButton>
              )}
            </div>
            <div className="wm-legend" aria-hidden="true">
              <span>
                <i style={{ background: "var(--wm-lime)" }} />
                {t.anggaran.v2.legendSpent}
              </span>
              <span>
                <i style={{ background: "var(--wm-ghost)" }} />
                {t.anggaran.v2.legendLimit}
              </span>
            </div>
          </div>
        }
        chart={
          <BudgetHeroChart
            budgets={budgets ?? []}
            ariaLabel={t.anggaran.categoryBarChartTitle}
            emptyLabel={t.anggaran.v2.chartEmpty}
          />
        }
        kpis={
          <>
            <HeroKpi
              label={t.anggaran.v2.kpiLimit}
              value={money.format(totalLimit)}
              delta={
                <small className="wm-cap">
                  {budgets?.length ?? 0}
                  {t.anggaran.categoriesSuffix}
                </small>
              }
            />
            <HeroKpi
              label={t.anggaran.v2.kpiSpent}
              value={money.format(totalSpent)}
              delta={
                <small className="wm-cap">
                  {usagePct}% {t.anggaran.v2.ofLimit}
                </small>
              }
            />
            <HeroKpi
              label={t.anggaran.v2.kpiSafe}
              value={money.format(
                daysLeft > 0
                  ? Math.round(totalRemaining / daysLeft)
                  : totalRemaining,
              )}
              delta={
                <small className="wm-cap">
                  {daysLeft}
                  {t.anggaran.daysSuffix.toLowerCase()}
                </small>
              }
            />
          </>
        }
      />

      {familyGroupId && (
        <ObligationsSection familyGroupId={familyGroupId} token={token} />
      )}

      <BentoCard
        className="ag-cats"
        title={t.anggaran.categoryBreakdownTitle}
        caption={t.anggaran.v2.tilesCaption}
        action={
          <Segmented
            label={t.anggaran.v2.sortLabel}
            value={sort}
            onChange={setSort}
            options={[
              { value: "pct", label: t.anggaran.v2.sortUsed },
              { value: "left", label: t.anggaran.v2.sortLeft },
            ]}
          />
        }
      >
        {isLoading && <BudgetSkeleton />}
        {isError && (
          <p role="alert" className="ag-state ag-state-bad">
            {t.anggaran.errorLoad}
          </p>
        )}
        {!isLoading && !isError && (!budgets || budgets.length === 0) && (
          <p className="ag-state">{t.anggaran.emptyState}</p>
        )}
        {!isLoading && !isError && budgets && budgets.length > 0 && (
          <BentoTiles>
            {sortedBudgets.map((b) => (
              <BudgetTile
                key={b.id}
                dto={b}
                canManage={!!canManageBudget}
                onEdit={() => openEdit(b)}
              />
            ))}
            {canManageBudget && (
              <AddTile onClick={() => setOpen(true)}>
                <Plus aria-hidden="true" /> {t.anggaran.v2.addTile}
              </AddTile>
            )}
          </BentoTiles>
        )}
      </BentoCard>

      <TipsCard
        className="ag-alert"
        title={
          worst
            ? worst.isOverBudget
              ? `${worst.categoryName}${t.anggaran.overBudgetMidText}${worst.usagePercent - 100}${t.anggaran.overBudgetSuffix}`
              : `${worst.categoryName}${t.anggaran.nearLimitMidText}${worst.usagePercent}${t.anggaran.nearLimitSuffix}`
            : t.anggaran.v2.alertOkTitle
        }
        mosaic={mosaic}
        action={<SeeAll href="/transaksi">{t.anggaran.v2.alertSeeTx}</SeeAll>}
      >
        {worst
          ? worst.isOverBudget
            ? t.anggaran.overBudgetDesc
            : t.anggaran.nearLimitDesc
          : t.anggaran.v2.alertOkBody}
      </TipsCard>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* EPIC-026 — composition ported 1:1 from the prototype's
            `dlg-budget` (docs/prototype/pages/anggaran.html:386): title +
            `.dialog__desc`, then `.field` Nama Kategori → `.field` Ikon
            (a row of `.btn--outline.btn--icon` toggles) → a `.field-row`
            pairing Budget per Bulan with Periode → `.dialog__footer`.
            The prototype's "Tipe Anggaran" select and "Peringatan 80%"
            switch stay CUT: CreateBudgetDto has no budgetType (it derives
            from the category's COA) and no notification-threshold field
            exists — rendering either would silently drop the user's input. */}
        <PanelContent variant="side" className="wm-form-panel">
          <header className="wm-panel-head">
            <div className="min-w-0">
              <DialogTitle className="wm-panel-title">
                {t.anggaran.modalAddTitle}
              </DialogTitle>
              <DialogDescription className="wm-panel-desc">
                {t.anggaran.modalAddDesc}
              </DialogDescription>
            </div>
            <DialogClose className="wm-panel-x" aria-label={t.common.close}>
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="wm-panel-body wm-form">
              <div className="wm-form__grid">
                {/* polish-j batch 7a item 2 — Budget (this dialog's actual
                point) now leads; Tipe/COA/Privat/Ikon collapse under "Opsi
                lanjutan" for the owner flow, since a default (expense, auto
                COA, not private) already covers most budgets. */}
                {/* F3 fix — a member can "manage Budget" but only "read
                Category": the create-a-category fields below would 403 on
                submit, so a member instead picks an existing category of
                the chosen kind (see `existingCategoryId` above). */}
                {canManageCategory !== false && (
                  <div className="field">
                    <label className="label" htmlFor="budget-name">
                      {t.anggaran.fieldCategoryNameLabel}
                    </label>
                    <input
                      id="budget-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.anggaran.fieldCategoryNamePlaceholder}
                      className="input"
                    />
                  </div>
                )}
                {canManageCategory === false && (
                  <div className="field">
                    <label className="label" htmlFor="budget-existing-category">
                      {t.anggaran.fieldExistingCategoryLabel}
                    </label>
                    <select
                      id="budget-existing-category"
                      value={existingCategoryId}
                      onChange={(e) => setExistingCategoryId(e.target.value)}
                      className="select"
                    >
                      <option value="">
                        {t.anggaran.existingCategoryPlaceholder}
                      </option>
                      {selectableCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {selectableCategories.length === 0 && (
                      <span className="hint block">
                        {t.anggaran.existingCategoryEmptyOption}
                      </span>
                    )}
                  </div>
                )}
                {/* EPIC-026 Wave 4 — prototype puts amount + periode side by
                side in a `field-row` (anggaran.html:410). */}
                <div className="wm-form__grid--two">
                  <div className="field mt-0">
                    <label className="label" htmlFor="budget-amount">
                      {t.anggaran.fieldAmountLabel}
                    </label>
                    <MoneyInput field={amountField} id="budget-amount" />
                  </div>
                  <div className="field mt-0">
                    <label className="label" htmlFor="budget-period">
                      {t.anggaran.fieldPeriodLabel}
                    </label>
                    <select
                      id="budget-period"
                      value={period}
                      onChange={(e) =>
                        setPeriod(e.target.value as BudgetPeriod)
                      }
                      className="select"
                    >
                      <option value="monthly">
                        {t.anggaran.periodLabels.monthly}
                      </option>
                      <option value="weekly">
                        {t.anggaran.periodLabels.weekly}
                      </option>
                      <option value="yearly">
                        {t.anggaran.periodLabels.yearly}
                      </option>
                    </select>
                  </div>
                </div>
                {canManageCategory !== false && (
                  <AdvancedDisclosure label={t.common.advancedOptions}>
                    {/* The category half of the form. These were previously
                    decided for the user — always `expense`, always the
                    server's default COA account, never private — even
                    though the budget's whole identity comes from the
                    category it creates. */}
                    <div className="wm-form__grid--two">
                      <div className="field mt-0">
                        <label className="label" htmlFor="budget-kind">
                          {t.anggaran.fieldKindLabel}
                        </label>
                        <select
                          id="budget-kind"
                          value={kind}
                          onChange={(e) => {
                            setKind(e.target.value as "income" | "expense");
                            // The previously chosen account/category may not be
                            // offered for the new kind; fall back rather than
                            // silently submitting a value no longer in the list.
                            setCoaAccountId("");
                            setExistingCategoryId("");
                          }}
                          className="select"
                        >
                          <option value="expense">{t.common.expense}</option>
                          <option value="income">{t.common.income}</option>
                        </select>
                      </div>
                      <div className="field mt-0">
                        <label className="label" htmlFor="budget-coa">
                          {t.anggaran.fieldCoaLabel}
                        </label>
                        <select
                          id="budget-coa"
                          value={coaAccountId}
                          onChange={(e) => setCoaAccountId(e.target.value)}
                          className="select"
                        >
                          <option value="">
                            {t.anggaran.coaAutoOptionLabel}
                          </option>
                          {selectableCoaAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} · {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="field mt-0">
                      {/* polish-j batch 6 item 2 — switch first (left), label +
                      hint after (right), matching crud-modal.tsx's toggle
                      branch and every other visibility toggle in the app. */}
                      <div className="row mt-0 gap-[9px]">
                        <Switch
                          checked={isPrivate}
                          onCheckedChange={setIsPrivate}
                          aria-label={t.anggaran.fieldPrivateLabel}
                        />
                        <span>
                          <span className="label">
                            {t.anggaran.fieldPrivateLabel}
                          </span>
                          <span className="hint block">
                            {t.anggaran.fieldPrivateHint}
                          </span>
                        </span>
                      </div>
                    </div>
                    {/* The fixed 8-emoji grid that used to live here is gone: a
                    category whose icon is a boat or a violin was simply not
                    expressible. Same component the master-data category
                    dialog uses, so the two no longer disagree about what an
                    icon is; batch 7a item 1 collapses it behind a 40px
                    trigger button instead of an always-open grid. */}
                    <IconPickerField
                      label={t.anggaran.iconLabel}
                      value={icon}
                      onChange={setIcon}
                      searchPlaceholder={t.common.emojiSearchPlaceholder}
                      noResultsLabel={t.common.emojiNoResults}
                      loadingLabel={t.common.emojiLoading}
                      ariaLabel={t.anggaran.iconGroupAriaLabel}
                    />
                  </AdvancedDisclosure>
                )}
              </div>
            </div>
            <div className="wm-panel-foot">
              <PillButton type="button" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </PillButton>
              <PillButton
                type="submit"
                variant="primary"
                disabled={
                  createMutation.isPending || amountField.resolved.isPending
                }
              >
                {createMutation.isPending
                  ? t.anggaran.savingLabel
                  : t.anggaran.saveCategoryButton}
              </PillButton>
            </div>
          </form>
        </PanelContent>
      </Dialog>

      {/* EPIC-022 C2 — edit an existing budget's limit/period. Only the
          fields `UpdateBudgetDto` actually accepts are offered — the
          category name/icon/kind belong to the Category this budget was
          created for and are read-only here, same restriction the API
          itself enforces. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(nextOpen) => !nextOpen && setEditing(null)}
      >
        <PanelContent variant="side" className="wm-form-panel">
          <header className="wm-panel-head">
            <div className="min-w-0">
              <DialogTitle className="wm-panel-title">
                {t.anggaran.modalEditTitle}
              </DialogTitle>
              <DialogDescription className="wm-panel-desc">
                {t.anggaran.modalEditDesc}
              </DialogDescription>
            </div>
            <DialogClose className="wm-panel-x" aria-label={t.common.close}>
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEdit();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="wm-panel-body wm-form">
              {editing && (
                <div className="wm-form__grid">
                  <div className="field">
                    <span className="label">
                      {t.anggaran.fieldCategoryNameLabel}
                    </span>
                    <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                      <CategoryIcon name={editing.categoryName} />
                      <span>{editing.categoryName}</span>
                    </div>
                  </div>
                  <div className="wm-form__grid--two">
                    <div className="field mt-0">
                      <label className="label" htmlFor="budget-edit-amount">
                        {t.anggaran.fieldAmountLabel}
                      </label>
                      <MoneyInput field={editField} id="budget-edit-amount" />
                    </div>
                    <div className="field mt-0">
                      <label className="label" htmlFor="budget-edit-period">
                        {t.anggaran.fieldPeriodLabel}
                      </label>
                      <select
                        id="budget-edit-period"
                        value={editPeriod}
                        onChange={(e) =>
                          setEditPeriod(e.target.value as BudgetPeriod)
                        }
                        className="select"
                      >
                        <option value="monthly">
                          {t.anggaran.periodLabels.monthly}
                        </option>
                        <option value="weekly">
                          {t.anggaran.periodLabels.weekly}
                        </option>
                        <option value="yearly">
                          {t.anggaran.periodLabels.yearly}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="wm-panel-foot">
              {/* Proto's "Ketuk kartu untuk ubah batas" — delete lives in
                  the edit panel the card click opens, not as an inline
                  trash icon on the card (anggaran.html's `inlineEdit`). */}
              {editing && (
                <PillButton
                  type="button"
                  variant="danger"
                  className="ag-panel-delete"
                  onClick={() => {
                    setDeletingBudget(editing);
                    setEditing(null);
                  }}
                  aria-label={`${t.anggaran.deleteAriaLabelPrefix}${editing.categoryName}`}
                >
                  <Trash2 aria-hidden="true" />
                </PillButton>
              )}
              <PillButton type="button" onClick={() => setEditing(null)}>
                {t.common.cancel}
              </PillButton>
              <PillButton
                type="submit"
                variant="primary"
                disabled={
                  updateMutation.isPending || editField.resolved.isPending
                }
              >
                {updateMutation.isPending
                  ? t.anggaran.savingLabel
                  : t.anggaran.saveChangesButton}
              </PillButton>
            </div>
          </form>
        </PanelContent>
      </Dialog>

      <ConfirmDeleteDialog
        label={deletingBudget ? `"${deletingBudget.categoryName}"` : null}
        title={t.anggaran.deleteDialogTitle}
        body={t.anggaran.deleteDialogBody}
        confirmLabel={t.anggaran.deleteDialogConfirm}
        onClose={() => setDeletingBudget(null)}
        onConfirm={handleDeleteBudget}
      />
    </BentoGrid>
  );
}
