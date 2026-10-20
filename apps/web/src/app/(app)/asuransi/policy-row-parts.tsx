"use client";

import { createElement } from "react";
import {
  Banknote,
  Car,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  HeartPulse,
  Home,
  MoreHorizontal,
  Pencil,
  Shield,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";

import {
  dueTone,
  fillCopy,
  formatDay,
  formatNative,
  isPayable,
  needsDueConfirmation,
  mainBenefit,
  maskPolicyNumber,
  nextDue,
  statusTone,
} from "./asuransi-model";

import type { InsuranceDto } from "@wealthme/contracts";

export type PolicyAction =
  | "detail"
  | "edit"
  | "pay"
  | "delete"
  /** Edit drawer focused on the dates (legacy due needs confirmation). */
  | "confirmDue";

const TYPE_ICON: Record<string, LucideIcon> = {
  jiwa: Shield,
  kesehatan: HeartPulse,
  kendaraan: Car,
  properti: Home,
  pendidikan: GraduationCap,
  lainnya: FileText,
};

export function PolicyMark({ policy }: { policy: InsuranceDto }) {
  return (
    <span className="ins3-mark" data-type={policy.type} aria-hidden="true">
      {createElement(TYPE_ICON[policy.type] ?? FileText)}
    </span>
  );
}

export function PolicyName({
  policy,
  onOpen,
}: {
  policy: InsuranceDto;
  onOpen?: () => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const masked = maskPolicyNumber(policy.policyNumber);
  return (
    <span className="ins3-name">
      {onOpen ? (
        <button type="button" className="ins3-name-btn" onClick={onOpen}>
          {policy.name}
        </button>
      ) : (
        <strong>{policy.name}</strong>
      )}
      <small>
        {policy.provider ?? c.noProvider}
        {masked ? ` · ${fillCopy(c.policyNo, { no: masked })}` : ""}
      </small>
    </span>
  );
}

export function KindAndType({ policy }: { policy: InsuranceDto }) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const pt = policy.policyType ?? "unset";
  return (
    <span className="ins3-kind">
      <span>{t.asuransi.typeLabels[policy.type] ?? policy.type}</span>
      <span className="ins3-badge" data-ptype={pt}>
        {c.policyTypes[pt]}
      </span>
    </span>
  );
}

export function People({ policy }: { policy: InsuranceDto }) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const insured = (policy.insured ?? []).map((i) => i.name).join(", ");
  return (
    <span className="ins3-people">
      {!policy.holderName && !insured ? (
        <span className="ins3-muted">{c.holderNone}</span>
      ) : (
        <>
          <span>{policy.holderName ?? "—"}</span>
          <small>/ {insured || c.insuredNone}</small>
        </>
      )}
    </span>
  );
}

/** Premiums are IDR (ruling S6); the policy currency is only a label. */
export function Premium({ policy }: { policy: InsuranceDto }) {
  const { t } = useLocale();
  const money = useMoney();
  return (
    <span className="ins3-premium">
      <span className="ins3-amount">
        {money.format(Number(policy.premiumAmount))}
      </span>
      <small>
        {t.asuransi.periodOptionLabels[policy.premiumPeriod] ??
          policy.premiumPeriod}
        {policy.currency !== "IDR" && (
          <span className="ins3-badge" data-tone="muted">
            {fillCopy(t.asuransi.v3.currencyBadge, { cur: policy.currency })}
          </span>
        )}
      </small>
    </span>
  );
}

export function MainBenefit({ policy }: { policy: InsuranceDto }) {
  const { t, locale } = useLocale();
  const b = mainBenefit(policy);
  if (!b) return <span className="ins3-muted">—</span>;
  return (
    <span className="ins3-benefit">
      <small>{b.label ?? t.asuransi.v3.benefitKinds[b.kind]}</small>
      <span className="ins3-amount">
        {formatNative(b.amount, b.currency, locale)}
      </span>
    </span>
  );
}

/** Next PREMIUM due only — coverage end never feeds this countdown. */
/**
 * A legacy due that looks like a coverage end: never a countdown or a
 * "jatuh tempo" date — a "Perlu dikonfirmasi" badge, why, and (optionally)
 * the quick action that opens the edit drawer on the dates.
 */
export function DueConfirm({
  onConfirm,
  showHelp = true,
}: {
  onConfirm?: () => void;
  showHelp?: boolean;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  return (
    <span className="ins3-due">
      <span className="ins3-chip" data-tone="warn">
        {c.dueConfirm}
      </span>
      {showHelp && <small className="ins3-muted">{c.dueConfirmHelp}</small>}
      {onConfirm && (
        <button type="button" className="ins3-link" onClick={onConfirm}>
          {c.dueConfirmAction}
        </button>
      )}
    </span>
  );
}

export function DueCell({
  policy,
  showDate = true,
  onConfirm,
}: {
  policy: InsuranceDto;
  showDate?: boolean;
  onConfirm?: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3;
  if (needsDueConfirmation(policy)) return <DueConfirm onConfirm={onConfirm} />;
  const due = nextDue(policy);
  const tone = dueTone(policy);
  const days = policy.daysUntilNextPremium ?? 0;
  const label =
    tone === "none"
      ? null
      : tone === "overdue"
        ? fillCopy(c.dueOverdue, { n: Math.abs(days) })
        : days === 0
          ? c.dueToday
          : fillCopy(c.dueIn, { n: days });
  return (
    <span className="ins3-due">
      {showDate && <span>{due ? formatDay(due, locale) : c.dueUnset}</span>}
      {label && (
        <span className="ins3-days" data-tone={tone}>
          <Clock aria-hidden="true" />
          {label}
        </span>
      )}
      {policy.paidThisPeriod && tone !== "overdue" && (
        <small className="ins3-paid">{c.paidPeriod}</small>
      )}
    </span>
  );
}

export function StatusPill({ policy }: { policy: InsuranceDto }) {
  const { t } = useLocale();
  return (
    <span className="ins3-status" data-tone={statusTone(policy.status)}>
      {t.asuransi.statusLabels[policy.status] ?? policy.status}
    </span>
  );
}

export function RowActions({
  policy,
  onAction,
}: {
  policy: InsuranceDto;
  onAction: (action: PolicyAction, policy: InsuranceDto) => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const label = fillCopy(c.rowMenu, { name: policy.name });
  return (
    <span className="ins3-actions">
      <button
        type="button"
        className="btn btn--outline btn--sm ins3-detail"
        onClick={() => onAction("detail", policy)}
      >
        {c.viewDetail}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="btn btn--ghost btn--icon ins3-menu-btn"
          aria-label={label}
          title={label}
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onAction("detail", policy)}>
              <Eye aria-hidden="true" /> {c.viewDetail}
            </DropdownMenuItem>
            {isPayable(policy) && (
              <DropdownMenuItem onClick={() => onAction("pay", policy)}>
                <Banknote aria-hidden="true" /> {c.pay}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onAction("edit", policy)}>
              <Pencil aria-hidden="true" /> {c.edit}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onAction("delete", policy)}
          >
            <Trash2 aria-hidden="true" /> {c.remove}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
