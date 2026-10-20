import { Prisma } from "@prisma/client";

import { calendarDaysUntil } from "../common/utils/due-window.util";

import {
  daysBetween,
  dueNeedsConfirmation,
  monthlyEquivalent,
  premiumDueStatus,
  ymd,
} from "./premium-schedule.util";
import { computeUnitValue } from "./value/insurance-value.core";

import type {
  InsuranceBeneficiaryResponseDto,
  InsuranceResponseDto,
} from "./dto/insurance-response.dto";
import type {
  InsuranceBenefitDto,
  InsuranceInsuredDto,
  InsurancePaymentDto,
  InsuranceValuationDto,
} from "@wealthme/contracts";

/** Every relation a policy response needs, in display order. */
export const INSURANCE_INCLUDE = {
  beneficiaries: { orderBy: { createdAt: "asc" } },
  insured: { orderBy: { createdAt: "asc" } },
  benefits: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  funds: { orderBy: { createdAt: "asc" } },
  shares: { select: { userId: true } },
} satisfies Prisma.InsuranceInclude;

export type InsuranceWithRelations = Prisma.InsuranceGetPayload<{
  include: typeof INSURANCE_INCLUDE;
}>;

/**
 * EPIC-023 F1 (D14) — a linked member's CURRENT name/relationship, resolved
 * per request (see InsurancesService.resolveMemberLookup). Used for
 * beneficiaries, insured persons, holder and payer alike.
 */
export type MemberLookup = ReadonlyMap<
  string,
  { name: string; relationship: string | null }
>;

function toBeneficiaryDto(
  row: InsuranceWithRelations["beneficiaries"][number],
  lookup: MemberLookup,
): InsuranceBeneficiaryResponseDto {
  const linked = row.memberUserId ? lookup.get(row.memberUserId) : undefined;
  // An orphaned link (member removed) is reported as unlinked, keeping the
  // stored name/relationship as the frozen last-known copy.
  const isOrphaned = row.memberUserId !== null && !linked;
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    name: linked?.name ?? row.name,
    relationship: linked?.relationship ?? row.relationship,
    sharePercent: row.sharePercent.toString(),
    memberUserId: isOrphaned ? null : row.memberUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toInsuredDto(
  row: InsuranceWithRelations["insured"][number],
  lookup: MemberLookup,
): InsuranceInsuredDto {
  const linked = row.memberUserId ? lookup.get(row.memberUserId) : undefined;
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    name: linked?.name ?? row.name,
    relationship: linked?.relationship ?? row.relationship,
    memberUserId: row.memberUserId && linked ? row.memberUserId : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBenefitDto(
  row: InsuranceWithRelations["benefits"][number],
): InsuranceBenefitDto {
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    kind: row.kind,
    label: row.label,
    amount: row.amount?.toString() ?? null,
    currency: row.currency,
    period: row.period,
    note: row.note,
    isPrimary: row.isPrimary,
    confirmed: row.confirmed,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInsuranceDto(
  row: InsuranceWithRelations,
  ctx: {
    lookup?: MemberLookup;
    paidThisPeriod?: boolean;
    /** Latest paid dueDate (see dueNeedsConfirmation); null = none. */
    lastPaidDueDate?: Date | null;
    today: Date;
  },
): InsuranceResponseDto {
  const lookup = ctx.lookup ?? new Map();
  const holder = row.holderUserId ? lookup.get(row.holderUserId) : undefined;
  const payer = row.payerUserId ? lookup.get(row.payerUserId) : undefined;
  const monthly = monthlyEquivalent(
    new Prisma.Decimal(row.premiumAmount.toString()),
    row.premiumPeriod,
  );
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    name: row.name,
    provider: row.provider,
    type: row.type,
    status: row.status,
    coverageAmount: row.coverageAmount?.toString() ?? null,
    premiumAmount: row.premiumAmount.toString(),
    premiumPeriod: row.premiumPeriod,
    renewalDate: row.renewalDate?.toISOString() ?? null,
    autoRenewDate: row.autoRenewDate,
    policyNumber: row.policyNumber,
    daysUntilRenewal: row.renewalDate
      ? calendarDaysUntil(row.renewalDate)
      : null,
    notes: row.notes,
    currency: row.currency,
    beneficiaries: row.beneficiaries.map((b) => toBeneficiaryDto(b, lookup)),
    paidThisPeriod: ctx.paidThisPeriod ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    policyType: row.policyType,
    nextPremiumDueDate: ymd(row.nextPremiumDueDate),
    policyRenewalDate: ymd(row.policyRenewalDate),
    premiumPaymentEndDate: ymd(row.premiumPaymentEndDate),
    coverageStartDate: ymd(row.coverageStartDate),
    coverageEndDate: ymd(row.coverageEndDate),
    daysUntilNextPremium: row.nextPremiumDueDate
      ? daysBetween(ctx.today, row.nextPremiumDueDate)
      : null,
    premiumDueStatus: premiumDueStatus(row.nextPremiumDueDate, ctx.today),
    dueNeedsConfirmation: dueNeedsConfirmation(
      row,
      ctx.today,
      ctx.lastPaidDueDate ?? null,
    ),
    monthlyEquivalentPremium: monthly?.toDecimalPlaces(2).toFixed(2) ?? null,
    holderUserId: row.holderUserId,
    holderName: holder?.name ?? row.holderName,
    payerUserId: row.payerUserId,
    payerName: payer?.name ?? row.payerName,
    insured: row.insured.map((i) => toInsuredDto(i, lookup)),
    paymentAccountId: row.paymentAccountId,
    benefits: row.benefits.map(toBenefitDto),
    funds: row.funds.map((f) => ({
      id: f.id,
      insuranceId: f.insuranceId,
      code: f.code,
      name: f.name,
      currency: f.currency,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    includeInNetWorth: row.includeInNetWorth,
    sharedWithUserIds: row.shares.map((s) => s.userId),
  };
}

/** Every member id a set of policies references (one batched lookup). */
export function referencedMemberIds(rows: InsuranceWithRelations[]): string[] {
  return rows
    .flatMap((r) => [
      ...r.beneficiaries.map((b) => b.memberUserId),
      ...r.insured.map((i) => i.memberUserId),
      r.holderUserId,
      r.payerUserId,
    ])
    .filter((id): id is string => !!id);
}

export function toPaymentDto(row: {
  id: string;
  insuranceId: string;
  dueDate: Date | null;
  paidAt: Date;
  amount: Prisma.Decimal;
  currency: string;
  accountId: string | null;
  transactionId: string | null;
  createdAt: Date;
}): InsurancePaymentDto {
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    dueDate: ymd(row.dueDate),
    paidAt: row.paidAt.toISOString(),
    amount: row.amount.toString(),
    currency: row.currency,
    accountId: row.accountId,
    transactionId: row.transactionId,
    createdAt: row.createdAt.toISOString(),
  };
}

type ValuationRecord = Prisma.InsuranceValuationGetPayload<object>;

export function toValuationDto(row: ValuationRecord): InsuranceValuationDto {
  const { computedValue, warning } = computeUnitValue(row);
  const dec = (d: Prisma.Decimal | null) => d?.toString() ?? null;
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    fundId: row.fundId,
    currency: row.currency,
    units: dec(row.units),
    navPerUnit: dec(row.navPerUnit),
    navDate: ymd(row.navDate),
    unitsDate: ymd(row.unitsDate),
    reportedValue: dec(row.reportedValue),
    cashValue: dec(row.cashValue),
    surrenderEstimate: dec(row.surrenderEstimate),
    maturityBenefit: dec(row.maturityBenefit),
    guaranteed: row.guaranteed,
    effectiveDate: ymd(row.effectiveDate) ?? "",
    source: row.source,
    documentId: row.documentId,
    page: row.page,
    snippet: row.snippet,
    status: row.status,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    computedValue: computedValue?.toString() ?? null,
    warning,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
