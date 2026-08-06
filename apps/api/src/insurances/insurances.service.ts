import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import { effectiveBudgetType } from "../common/utils/effective-budget-type.util";
import { ownCategoryName } from "../common/utils/own-category-name.util";
import {
  currentPaymentPeriodBounds,
  type PaymentPeriod,
} from "../common/utils/payment-period.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
import { ownerNotifPrefs } from "../notifications/notification-prefs";
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from "../notifications/notification-sender.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// H5 (group E retry round 4) — mirrors LiabilitiesService's own import.
import { checkBudgetAlert } from "../transactions/transaction-alerts.util";

import { nextRenewalDate } from "./next-renewal-date.util";

import type { CreateInsuranceBeneficiaryDto } from "./dto/create-insurance-beneficiary.dto";
import type { CreateInsuranceDto } from "./dto/create-insurance.dto";
import type {
  InsuranceBeneficiaryResponseDto,
  InsuranceResponseDto,
  InsuranceSummaryResponseDto,
} from "./dto/insurance-response.dto";
import type { PayInsuranceDto } from "./dto/pay-insurance.dto";
import type { UpdateInsuranceDto } from "./dto/update-insurance.dto";
import type { PremiumPeriod } from "@prisma/client";

type TxClient = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

// EPIC-023 group E retry (HIGH 3) — a DEDICATED insurance-premium expense
// account. GENERIC_COA_CHART (every real family) now provisions "20010"
// (Premi Asuransi) via the group-E-retry migration, mirroring loans' "20009"
// (Bunga Pinjaman, A1/A2) exactly. "20099" (Pengeluaran Lainnya) — the
// generic catch-all `defaultCoaCodeForCategory` falls back to for ANY
// unmatched expense category — is GONE from this list: reusing it used to
// silently hijack whatever user-made category/budget already lived on that
// shared bucket (increment its limit, flip it FIXED, and block its
// deletion). The demo seed's richer chart provides "21104" (Asset & Other
// Insurance), which was already a genuinely dedicated code, unchanged.
//
// HIGH 11 (group E retry round 3) — ORDER IS THE PREFERENCE, not
// lexical/alphabetical. `resolveOwnPremiumCategoryId` below tries "21104"
// FIRST: a family whose chart already provisions the richer, purpose-built
// "21104" must keep using it for every new policy, never get silently
// switched to the generic "20010" the migration also inserts for everyone
// just because "20010" < "21104" as a string. A family with only "20010"
// (the common case — every real GENERIC_COA_CHART family) falls through to
// it.
const INSURANCE_PREMIUM_COA_PRIORITY = ["21104", "20010"];

type BeneficiaryRow = {
  id: string;
  insuranceId: string;
  name: string;
  relationship: string;
  sharePercent: { toString(): string };
  memberUserId: string | null;
  createdAt: Date;
};

type InsuranceRow = {
  id: string;
  familyGroupId: string;
  name: string;
  provider: string | null;
  type: string;
  status: string;
  coverageAmount: bigint | null;
  premiumAmount: bigint;
  premiumPeriod: string;
  renewalDate: Date | null;
  autoRenewDate: boolean;
  policyNumber: string | null;
  notes: string | null;
  currency: string;
  premiumCategoryId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  beneficiaries?: BeneficiaryRow[];
};

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

// EPIC-023 F1 (D14, US-INS-5) — live-link resolution. `Member.relationship`
// is an 8-value enum (kinship) while `InsuranceBeneficiary.relationship` is
// free text (also serving non-members) — reconciled by NOT changing the
// column's type: a member's enum value ("istri", "anak", ...) is already a
// valid free-text string, so the SAME column can hold either. What makes a
// linked beneficiary "live" is this map, built fresh on every read from the
// CURRENT Member/User rows — never from what was typed/copied at write
// time. A beneficiary's stored `name`/`relationship` remain the source of
// truth only while `memberUserId` is null (a non-member); the moment it is
// set, this lookup overrides them, so a later name or relationship change
// on the member is reflected without ever touching the beneficiary row.
type MemberLookup = ReadonlyMap<
  string,
  { name: string; relationship: string | null }
>;

function toBeneficiaryDto(
  row: BeneficiaryRow,
  lookup: MemberLookup,
): InsuranceBeneficiaryResponseDto {
  const linked = row.memberUserId ? lookup.get(row.memberUserId) : undefined;
  // EPIC-023 Group F fix round (MEDIUM 8) — a `memberUserId` that no longer
  // resolves (the linked member was removed from the family) is an
  // ORPHANED link, not a live one: null it out so a consumer can tell "live
  // link, name/relationship are current" apart from "the link broke, this
  // is a frozen last-known copy". Falling back to the stored `name`/
  // `relationship` already happens below; without this, `memberUserId`
  // would keep claiming a link that no longer exists.
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

function toInsuranceDto(
  row: InsuranceRow,
  // Group F (F1/D14) — resolves a linked beneficiary's CURRENT name and
  // relationship from `Member`; group E (E2) — whether this policy's premium
  // is already paid for its own `premiumPeriod`. Both are per-request and
  // batched by the caller, so neither is fetched per row here.
  lookup: MemberLookup = new Map(),
  paidThisPeriod = false,
): InsuranceResponseDto {
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
    daysUntilRenewal: row.renewalDate ? daysUntil(row.renewalDate) : null,
    notes: row.notes,
    currency: row.currency,
    beneficiaries: (row.beneficiaries ?? []).map((b) =>
      toBeneficiaryDto(b, lookup),
    ),
    paidThisPeriod,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function monthlyAmount(premiumAmount: bigint, premiumPeriod: string): bigint {
  if (premiumPeriod === "quarterly") return premiumAmount / BigInt(3);
  if (premiumPeriod === "yearly") return premiumAmount / BigInt(12);
  return premiumAmount;
}

// EPIC-021 Group D (#14) — beneficiaries are optional and percentages may be
// partially allocated; only reject when the sum exceeds 100, mirroring the
// warisan heir rule (Decision #9: same beneficiary shape/rule as heirs).
function validateSharePercent(beneficiaries: { sharePercent: number }[]): void {
  const total = beneficiaries.reduce((sum, b) => sum + b.sharePercent, 0);
  if (total > 100) {
    throw new BadRequestException(`Total sharePercent (${total}) exceeds 100`);
  }
}

@Injectable()
export class InsurancesService {
  private readonly logger = new Logger(InsurancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    // H5 (group E retry round 4) — needed for `pay()`'s new
    // `checkBudgetAlert` call, mirroring `LiabilitiesService`'s own
    // constructor.
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly notificationSender: NotificationSenderPort,
  ) {}

  // TS review fix #1 — tenant-scoped lookup so a beneficiary's optional
  // memberUserId can never reference a user from another family group.
  private async assertMemberInFamilyGroup(
    familyGroupId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.member.findFirst({
      where: { userId, familyGroupId },
    });
    if (!member) {
      throw new BadRequestException(
        "memberUserId does not reference a member of this family group",
      );
    }
  }

  private async assertBeneficiaryMembersInFamilyGroup(
    familyGroupId: string,
    beneficiaries: { memberUserId?: string }[],
  ): Promise<void> {
    for (const beneficiary of beneficiaries) {
      if (beneficiary.memberUserId) {
        await this.assertMemberInFamilyGroup(
          familyGroupId,
          beneficiary.memberUserId,
        );
      }
    }
  }

  // EPIC-023 F1 (D14) — batch-resolve the CURRENT name/relationship for
  // every linked `memberUserId` across a set of beneficiary rows, so the
  // response always reflects the member's live record (see `MemberLookup`
  // above). One query regardless of how many beneficiaries/policies are
  // being serialized.
  private async resolveMemberLookup(
    familyGroupId: string,
    memberUserIds: readonly (string | null)[],
  ): Promise<MemberLookup> {
    const ids = Array.from(
      new Set(memberUserIds.filter((id): id is string => !!id)),
    );
    if (ids.length === 0) return new Map();

    const members = await this.prisma.member.findMany({
      where: { familyGroupId, userId: { in: ids } },
      include: { user: { select: { name: true } } },
    });

    return new Map(
      members.map((m) => [
        m.userId,
        { name: m.user.name, relationship: m.relationship },
      ]),
    );
  }

  async findAll(familyGroupId: string): Promise<InsuranceResponseDto[]> {
    const rows = await this.prisma.insurance.findMany({
      where: { familyGroupId },
      include: { beneficiaries: true },
      orderBy: { createdAt: "asc" },
    });
    // Both lookups are batched across the whole page (one query each), not
    // per row: group F's live-linked beneficiary names and group E's
    // paid-this-period set.
    const [lookup, paidSet] = await Promise.all([
      this.resolveMemberLookup(
        familyGroupId,
        rows.flatMap((r) => r.beneficiaries.map((b) => b.memberUserId)),
      ),
      this.paidThisPeriodIds(
        familyGroupId,
        rows.map((r) => ({ id: r.id, premiumPeriod: r.premiumPeriod })),
      ),
    ]);

    return rows.map((r) => toInsuranceDto(r, lookup, paidSet.has(r.id)));
  }

  /**
   * EPIC-023 E2 — set of insurance ids with at least one premium payment
   * (`Transaction.insuranceId`, E1) `occurredAt` in the CURRENT period FOR
   * THAT POLICY'S OWN `premiumPeriod`. Mirrors
   * `LiabilitiesService.paidThisPeriodIds`.
   *
   * CRITICAL 2 (group E retry round 3) — this used to hardcode a calendar-
   * month window regardless of `premiumPeriod`, so a `yearly` policy paid
   * in January read as unpaid again starting in February. Different
   * policies can have different periods, so the ids are bucketed by period
   * first and one `findMany` runs per DISTINCT period actually present
   * (at most 3 — monthly/quarterly/yearly), not per policy.
   */
  private async paidThisPeriodIds(
    familyGroupId: string,
    insurances: { id: string; premiumPeriod: string }[],
  ): Promise<Set<string>> {
    if (insurances.length === 0) return new Set();

    const byPeriod = new Map<PaymentPeriod, string[]>();
    for (const ins of insurances) {
      const period = ins.premiumPeriod as PaymentPeriod;
      const bucket = byPeriod.get(period) ?? [];
      bucket.push(ins.id);
      byPeriod.set(period, bucket);
    }

    const paid = new Set<string>();
    for (const [period, ids] of byPeriod) {
      const { periodStart, periodEnd } = currentPaymentPeriodBounds(period);
      const rows = await this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          insuranceId: { in: ids },
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
        select: { insuranceId: true },
        distinct: ["insuranceId"],
      });
      for (const r of rows) paid.add(r.insuranceId!);
    }
    return paid;
  }

  async getSummary(
    familyGroupId: string,
  ): Promise<InsuranceSummaryResponseDto> {
    const rows = await this.prisma.insurance.findMany({
      where: { familyGroupId },
      select: { status: true, premiumAmount: true, premiumPeriod: true },
    });

    const active = rows.filter((r) => r.status === "aktif");
    const totalMonthlyPremium = active.reduce(
      (sum, r) => sum + monthlyAmount(r.premiumAmount, r.premiumPeriod),
      BigInt(0),
    );

    return {
      activePolicies: active.length,
      totalMonthlyPremium: totalMonthlyPremium.toString(),
      currency: "IDR",
    };
  }

  /**
   * EPIC-023 E2 (D11, US-LIAB-3), redesigned by the group E retry (HIGH 4)
   * — creating a policy auto-creates THIS POLICY'S OWN FIXED budget line
   * for its premium. See `LiabilitiesService.create()`'s doc comment for
   * the full HIGH 4 reasoning (per-obligation `Category`, never shared) —
   * it applies identically here, with `premiumCategoryId` in place of
   * `principalCategoryId`.
   */
  async create(
    familyGroupId: string,
    dto: CreateInsuranceDto,
  ): Promise<InsuranceResponseDto> {
    if (dto.beneficiaries && dto.beneficiaries.length > 0) {
      validateSharePercent(dto.beneficiaries);
      await this.assertBeneficiaryMembersInFamilyGroup(
        familyGroupId,
        dto.beneficiaries,
      );
    }

    const premiumAmount = BigInt(dto.premiumAmount);
    const premiumPeriod = dto.premiumPeriod ?? "monthly";

    const insurance = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runCreate(tx, familyGroupId, dto, premiumAmount, premiumPeriod),
    );

    void this.maybeNotifyRenewal(
      familyGroupId,
      insurance.name,
      insurance.renewalDate,
    );

    // Group F (F1/D14) — a beneficiary linked to a family member must come
    // back with that member's CURRENT name and relationship, not the copy
    // just written. `create()` was restructured by group E so the row is
    // built inside `runCreate`; the lookup belongs here, where the DTO is.
    const lookup = await this.resolveMemberLookup(
      familyGroupId,
      (insurance.beneficiaries ?? []).map((b) => b.memberUserId),
    );
    return toInsuranceDto(insurance, lookup);
  }

  private async runCreate(
    tx: TxClient,
    familyGroupId: string,
    dto: CreateInsuranceDto,
    premiumAmount: bigint,
    premiumPeriod: PremiumPeriod,
  ): Promise<InsuranceRow> {
    const created = await tx.insurance.create({
      data: {
        familyGroupId,
        name: dto.name,
        provider: dto.provider ?? null,
        type: dto.type,
        status: dto.status ?? "aktif",
        coverageAmount: dto.coverageAmount ? BigInt(dto.coverageAmount) : null,
        premiumAmount,
        premiumPeriod,
        renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
        autoRenewDate: dto.autoRenewDate ?? false,
        policyNumber: dto.policyNumber ?? null,
        notes: dto.notes ?? null,
        currency: dto.currency ?? "IDR",
        beneficiaries:
          dto.beneficiaries && dto.beneficiaries.length > 0
            ? { create: dto.beneficiaries.map(toBeneficiaryCreateInput) }
            : undefined,
      },
      include: { beneficiaries: true },
    });

    const monthlyContribution = monthlyAmount(premiumAmount, premiumPeriod);
    if (monthlyContribution > BigInt(0)) {
      await this.syncPremiumBudgetLine(
        tx,
        familyGroupId,
        created,
        monthlyContribution,
      );
    }

    return created;
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateInsuranceDto,
  ): Promise<InsuranceResponseDto> {
    const existing = await this.prisma.insurance.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Insurance not found");
    }

    if (dto.beneficiaries && dto.beneficiaries.length > 0) {
      validateSharePercent(dto.beneficiaries);
      await this.assertBeneficiaryMembersInFamilyGroup(
        familyGroupId,
        dto.beneficiaries,
      );
    }

    const updated = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runUpdate(tx, familyGroupId, id, dto),
    );

    void this.maybeNotifyRenewal(
      familyGroupId,
      updated.name,
      updated.renewalDate,
    );

    const lookup = await this.resolveMemberLookup(
      familyGroupId,
      (updated.beneficiaries ?? []).map((b) => b.memberUserId),
    );
    return toInsuranceDto(updated, lookup);
  }

  /**
   * HIGH 4 fix — mirrors `LiabilitiesService.runUpdate()`: the premium
   * contribution (monthly-normalised) is re-derived every call and synced
   * to THIS policy's own budget line — created if it did not exist,
   * re-derived (never merely incremented) if it did, removed if the new
   * contribution is 0.
   */
  private async runUpdate(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: UpdateInsuranceDto,
  ): Promise<InsuranceRow> {
    // Re-read fresh inside the (possibly retried) transaction.
    const existing = await tx.insurance.findUniqueOrThrow({
      where: { id, familyGroupId },
    });

    if (dto.beneficiaries !== undefined) {
      await tx.insuranceBeneficiary.deleteMany({ where: { insuranceId: id } });
    }

    const premiumAmount = dto.premiumAmount
      ? BigInt(dto.premiumAmount)
      : existing.premiumAmount;
    const premiumPeriod = dto.premiumPeriod ?? existing.premiumPeriod;

    const updated = await tx.insurance.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        provider:
          dto.provider !== undefined
            ? (dto.provider ?? null)
            : existing.provider,
        type: dto.type ?? existing.type,
        status: dto.status ?? existing.status,
        coverageAmount:
          dto.coverageAmount !== undefined
            ? dto.coverageAmount
              ? BigInt(dto.coverageAmount)
              : null
            : existing.coverageAmount,
        premiumAmount,
        premiumPeriod,
        renewalDate:
          dto.renewalDate !== undefined
            ? dto.renewalDate
              ? new Date(dto.renewalDate)
              : null
            : existing.renewalDate,
        autoRenewDate: dto.autoRenewDate ?? existing.autoRenewDate,
        policyNumber:
          dto.policyNumber !== undefined
            ? (dto.policyNumber ?? null)
            : existing.policyNumber,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
        currency: dto.currency ?? existing.currency,
        beneficiaries:
          dto.beneficiaries !== undefined && dto.beneficiaries.length > 0
            ? { create: dto.beneficiaries.map(toBeneficiaryCreateInput) }
            : undefined,
      },
      include: { beneficiaries: true },
    });

    const monthlyContribution = monthlyAmount(premiumAmount, premiumPeriod);
    await this.syncPremiumBudgetLine(
      tx,
      familyGroupId,
      { ...updated, premiumCategoryId: existing.premiumCategoryId },
      monthlyContribution,
    );

    return updated;
  }

  /**
   * Creates, re-derives, or removes this policy's OWN FIXED budget line so
   * `limitAmount` always equals ITS current monthly-normalised premium —
   * mirrors `LiabilitiesService.syncPrincipalBudgetLine`.
   */
  private async syncPremiumBudgetLine(
    tx: TxClient,
    familyGroupId: string,
    insurance: InsuranceRow,
    contribution: bigint,
  ): Promise<void> {
    if (contribution <= BigInt(0)) {
      await tx.budget.deleteMany({
        where: { familyGroupId, insuranceId: insurance.id },
      });
      return;
    }

    const categoryId = await this.resolveOwnPremiumCategoryId(
      tx,
      familyGroupId,
      insurance,
    );
    await tx.budget.upsert({
      where: {
        familyGroupId_categoryId_period: {
          familyGroupId,
          categoryId,
          period: "monthly",
        },
      },
      create: {
        familyGroupId,
        categoryId,
        period: "monthly",
        limitAmount: contribution,
        insuranceId: insurance.id,
        budgetType: "FIXED",
      },
      update: {
        limitAmount: contribution,
        insuranceId: insurance.id,
        budgetType: "FIXED",
      },
    });
  }

  /**
   * EPIC-023 E2 (D11) — CRITICAL 1 (group E retry round 3): mirrors
   * `LiabilitiesService.remove()`'s fix — the previous "redesigned by HIGH
   * 4" version silently `deleteMany`'d this policy's budget line before
   * deleting the policy, a silent cascade D11 forbids. Restored: a policy
   * with a budget line refuses deletion with a `ConflictException` naming
   * the policy and its budget line.
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.insurance.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Insurance not found");
    }

    const budget = await this.prisma.budget.findFirst({
      where: { familyGroupId, insuranceId: id },
      select: { id: true },
    });
    if (budget) {
      throw new ConflictException(
        `Tidak dapat menghapus "${existing.name}" — hapus dulu anggaran (budget) terkait (id ${budget.id})`,
      );
    }

    await this.prisma.insurance.delete({ where: { id, familyGroupId } });
  }

  /**
   * Records a premium payment against an insurance policy: creates ONE
   * `Transaction` linked via `insuranceId`, debits the source account by the
   * paid amount, and advances `renewalDate` by one premium period — EPIC-023
   * E1 (D10, US-LIAB-4, US-INS-4). Everything happens inside one
   * `$transaction` so a failure never leaves the account debited without the
   * policy/ledger updated, or vice versa.
   *
   * EPIC-023 group E retry (HIGH 2) — this now runs under the SAME
   * Serializable-plus-bounded-retry treatment as `LiabilitiesService.pay()`
   * (`runSerializableWithRetry`). The PREVIOUS docblock here claimed
   * Serializable was unnecessary because "the account debit is an atomic
   * decrement" — that premise was false: `assertBankNotOverdrawn` READS the
   * balance and compares against it, then `account.update({ decrement })`
   * WRITES — a read-then-write pair, exactly what `LiabilitiesService.pay()`
   * already identified as needing Serializable isolation. At READ COMMITTED
   * with no retry, two concurrent premium payments against the same account
   * could each read the same starting balance, each pass the overdraft
   * floor check, and both commit — jointly overdrawing the account past
   * what either payment alone would have allowed (bypassing EPIC-021 #22).
   * The retry also fixes a second bug: a first-ever concurrent payment used
   * to throw an opaque, unretried 500 from the category self-heal P2002
   * race — it now retries exactly like `LiabilitiesService.pay()`.
   */
  async pay(
    familyGroupId: string,
    id: string,
    dto: PayInsuranceDto,
  ): Promise<InsuranceResponseDto> {
    const { insurance, premiumCategoryId } = await runSerializableWithRetry(
      this.prisma,
      (tx) => this.runPay(tx, familyGroupId, id, dto),
    );

    // H5 (group E retry round 4) — mirrors
    // `LiabilitiesService.pay()`'s own H5 fix: `LiabilitiesService
    // .purchase()` already fired `checkBudgetAlert` for every card charge,
    // but NEITHER `pay()` here NOR `LiabilitiesService.pay()` ever called
    // it, so a FIXED premium line paid past its `limitAmount` showed as
    // over-budget on `/anggaran` while no 80%/100% notification ever fired.
    // Fired once, AFTER the transaction has committed.
    // H5 (group E retry round 4) — mirrors
    // `LiabilitiesService.pay()`'s own H5 fix: `LiabilitiesService
    // .purchase()` already fired `checkBudgetAlert` for every card charge,
    // but NEITHER `pay()` here NOR `LiabilitiesService.pay()` ever called
    // it, so a FIXED premium line paid past its `limitAmount` showed as
    // over-budget on `/anggaran` while no 80%/100% notification ever fired.
    // Fired once, AFTER the transaction has committed.
    void checkBudgetAlert(
      this.prisma,
      this.notificationSender,
      familyGroupId,
      premiumCategoryId,
    );

    return insurance;
  }

  private async runPay(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: PayInsuranceDto,
  ): Promise<{
    insurance: InsuranceResponseDto;
    premiumCategoryId: string;
  }> {
    const insurance = await tx.insurance.findUnique({
      where: { id, familyGroupId },
    });
    if (!insurance) {
      throw new NotFoundException("Insurance not found");
    }

    // CRITICAL 3 (group E retry round 3) — mirrors
    // `LiabilitiesService.runPayment`'s guard: rejects a second premium
    // payment for the SAME policy within the current period, inside the
    // SAME Serializable transaction as the balance mutation. Also closes
    // CRITICAL 3's second gap: the `/asuransi` page rendered no disabled
    // state at all, so this was the ONLY thing standing between a second
    // click and a second debit.
    await this.assertNotAlreadyPaidThisPeriod(
      tx,
      familyGroupId,
      id,
      insurance.name,
      insurance.premiumPeriod,
      insurance.renewalDate,
    );

    // Tenant scoping: the source account must belong to the SAME family
    // group as the policy being paid.
    const sourceAccount = await tx.account.findUnique({
      where: { id: dto.sourceAccountId, familyGroupId },
    });
    if (!sourceAccount) {
      throw new NotFoundException(`Account ${dto.sourceAccountId} not found`);
    }

    const amount = dto.amount ? BigInt(dto.amount) : insurance.premiumAmount;
    if (amount <= BigInt(0)) {
      throw new BadRequestException("amount must be greater than zero");
    }

    // EPIC-021 #22 — this is a fresh, user-initiated debit of the SOURCE
    // account, exactly the class of debit the bank-overdraft floor guards
    // against elsewhere (TransactionsService.create(),
    // LiabilitiesService.pay()).
    await assertBankNotOverdrawn(tx, familyGroupId, sourceAccount.id, amount);

    await tx.account.update({
      where: { id: sourceAccount.id, familyGroupId },
      data: { balance: { decrement: amount } },
    });

    const categoryId = await this.resolveOwnPremiumCategoryId(
      tx,
      familyGroupId,
      insurance,
    );

    // CRITICAL 4 (group E retry round 3) — mirrors
    // `LiabilitiesService.runPayment`: `syncPremiumBudgetLine` used to only
    // ever run from `create()`/`update()`. `pay()` self-healed
    // `premiumCategoryId` but never created the matching Budget row, so a
    // family that only ever presses Pay never got a budget line.
    const monthlyContribution = monthlyAmount(
      insurance.premiumAmount,
      insurance.premiumPeriod,
    );
    if (monthlyContribution > BigInt(0)) {
      await this.syncPremiumBudgetLine(
        tx,
        familyGroupId,
        { ...insurance, premiumCategoryId: categoryId },
        monthlyContribution,
      );
    }

    await tx.transaction.create({
      data: {
        familyGroupId,
        accountId: sourceAccount.id,
        categoryId,
        amount,
        type: "expense",
        insuranceId: id,
        description: `Premi ${insurance.name}`,
        occurredAt: new Date(),
      },
    });

    // MEDIUM 13 (group E retry round 3) — anchored to `max(renewalDate,
    // now)`, not unconditionally to the (possibly long-overdue) stored
    // `renewalDate`. An overdue policy paid today now lands ONE period
    // ahead of TODAY, not one period ahead of the stale date — so
    // `billing-cycle.processor.ts`'s catch-up (`advanceUntilFuture`) has
    // nothing left to correct and can no longer compound with this advance
    // (the observed bug: one payment silently advancing renewal by several
    // periods). Paying early (renewalDate already in the future) is
    // unaffected — it still advances from the actual renewalDate, so
    // prepayments stack correctly.
    const anchor =
      insurance.renewalDate && insurance.renewalDate > new Date()
        ? insurance.renewalDate
        : new Date();
    const updated = await tx.insurance.update({
      where: { id, familyGroupId },
      data: insurance.renewalDate
        ? { renewalDate: nextRenewalDate(anchor, insurance.premiumPeriod) }
        : {},
    });

    return {
      insurance: toInsuranceDto(updated),
      premiumCategoryId: categoryId,
    };
  }

  /**
   * Mirrors `LiabilitiesService.assertNotAlreadyPaidThisPeriod`, EXTENDED
   * by H8 (group E retry round 4) to anchor to THIS POLICY'S OWN cycle
   * (`renewalDate`) rather than the calendar for a policy that has one.
   *
   * The bug this closes: the old, purely calendar-anchored check compared
   * only "did a payment land in the CURRENT calendar month/quarter/year" —
   * a signal that resets at every calendar boundary regardless of what the
   * obligation's own cycle actually covers. A YEARLY policy paid 20 Dec
   * 2025 advances `renewalDate` to Dec 2026 — already paid clean through
   * an entire year — but from 1 Jan 2026 onward the CALENDAR year flips,
   * so the old check found no payment in "this" (new) calendar year and
   * `pay()` accepted a SECOND full annual premium 11 months early.
   *
   * `renewalDate` already IS the authoritative "paid through" date —
   * `pay()` only ever advances it forward, never sets it into the past
   * (see the MEDIUM 13 anchor logic below). So once it is set, "already
   * paid ahead" is simply "paid ahead of today": `renewalDate > now` means
   * a payment already covers every day up to it, and a new payment must
   * wait until it actually falls due.
   *
   * This is IN ADDITION TO, never instead of, the pre-H8 calendar-window
   * check below — that check remains the guard for a DUE (or
   * never-renewalDate) policy against a same-instant double-click/replay
   * whose Transaction row exists but whose insurance row hasn't (yet)
   * reflected the advance this same request is about to make.
   */
  private async assertNotAlreadyPaidThisPeriod(
    tx: TxClient,
    familyGroupId: string,
    insuranceId: string,
    insuranceName: string,
    premiumPeriod: string,
    renewalDate: Date | null,
  ): Promise<void> {
    if (renewalDate && renewalDate > new Date()) {
      throw new ConflictException(
        `"${insuranceName}" sudah dibayar periode ini — koreksi transaksi yang ada, jangan bayar dua kali`,
      );
    }

    const { periodStart, periodEnd } = currentPaymentPeriodBounds(
      premiumPeriod as PaymentPeriod,
    );
    const existing = await tx.transaction.findFirst({
      where: {
        familyGroupId,
        insuranceId,
        occurredAt: { gte: periodStart, lte: periodEnd },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `"${insuranceName}" sudah dibayar periode ini — koreksi transaksi yang ada, jangan bayar dua kali`,
      );
    }
  }

  /**
   * Finds this policy's OWN premium Category — self-healing (creating it,
   * `INSURANCE_PREMIUM_COA_PRIORITY`) the first time it is needed — HIGH 4
   * redesign, mirrors `LiabilitiesService.resolveOwnPrincipalCategoryId`.
   * The category name bakes in the policy's own id (`ownCategoryName`,
   * shared with `LiabilitiesService`), eliminating the
   * `@@unique([familyGroupId, name, kind])` collision class between two
   * DIFFERENT policies by construction.
   *
   * HIGH 11 (group E retry round 3) — looks up each code in
   * `INSURANCE_PREMIUM_COA_PRIORITY` IN ORDER (one `findFirst` per code,
   * first hit wins) instead of a single `findFirst({ code: { in: [...] } },
   * orderBy: { code: "asc" } })`, which picked whichever code sorted first
   * ALPHABETICALLY ("20010" < "21104") regardless of which one was actually
   * the better fit for this family's chart.
   */
  private async resolveOwnPremiumCategoryId(
    tx: TxClient,
    familyGroupId: string,
    insurance: { id: string; name: string; premiumCategoryId?: string | null },
  ): Promise<string> {
    if (insurance.premiumCategoryId) return insurance.premiumCategoryId;

    // H6 (group E retry round 4) — this policy is about to be split OUT of
    // whatever category its past premium payments were posted against
    // (the pre-HIGH-4 shared "resolvePremiumCategoryId" design every real
    // family's older policies still carry) into its own, brand-new
    // category — the IDENTICAL double-count risk
    // `LiabilitiesService.resolveOwnPrincipalCategoryId` warns about, which
    // this method never mirrored until now. See
    // `warnIfPriorSharedBudgetLine`'s own doc comment (and C3's fix on the
    // liability side) for the full reasoning.
    await this.warnIfPriorSharedBudgetLine(tx, familyGroupId, insurance);

    let coaAccount: { id: string; name: string } | null = null;
    for (const code of INSURANCE_PREMIUM_COA_PRIORITY) {
      coaAccount = await tx.coaAccount.findFirst({
        where: { familyGroupId, code },
        select: { id: true, name: true },
      });
      if (coaAccount) break;
    }
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no insurance-premium expense COA account provisioned",
      );
    }

    const category = await tx.category.create({
      data: {
        familyGroupId,
        name: ownCategoryName(coaAccount.name, insurance.name, insurance.id),
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
    });

    await tx.insurance.update({
      where: { id: insurance.id, familyGroupId },
      data: { premiumCategoryId: category.id },
    });

    return category.id;
  }

  /**
   * H6 (group E retry round 4) — mirrors
   * `LiabilitiesService.warnIfPriorSharedBudgetLine` (fixed by C3)
   * EXACTLY, adapted to insurance's own shape: premium payments post as
   * `type: "expense"` (not `"transfer"` — a liability's principal leg is
   * the only obligation type that is a TRANSFER), and `pay()`'s
   * description has always been `Premi ${insurance.name}` — stable across
   * the pre-HIGH-4 shared "resolvePremiumCategoryId" design and today's
   * per-policy one, so it finds the prior category without depending on
   * `insuranceId` (E1's column, never backfilled onto pre-existing rows)
   * or `Budget.budgetType` (MEDIUM 12's column, also never backfilled).
   * `effectiveBudgetType` (shared with `BudgetsService.toDto` and the
   * liability side) resolves FIXED the same way `/anggaran` does.
   */
  private async warnIfPriorSharedBudgetLine(
    tx: TxClient,
    familyGroupId: string,
    insurance: { id: string; name: string },
  ): Promise<void> {
    const priorPayment = await tx.transaction.findFirst({
      where: {
        familyGroupId,
        type: "expense",
        OR: [
          { insuranceId: insurance.id },
          { description: `Premi ${insurance.name}` },
        ],
      },
      select: { categoryId: true },
      orderBy: { occurredAt: "desc" },
    });
    if (!priorPayment?.categoryId) return;

    const priorSharedBudget = await tx.budget.findFirst({
      where: { familyGroupId, categoryId: priorPayment.categoryId },
      select: {
        id: true,
        limitAmount: true,
        budgetType: true,
        category: { select: { coaAccount: { select: { budgetType: true } } } },
      },
    });
    if (!priorSharedBudget) return;
    if (effectiveBudgetType(priorSharedBudget) !== "FIXED") return;

    this.logger.warn(
      `H6: insurance "${insurance.name}" (${insurance.id}) is being split into its own premium category, but its prior category still carries a FIXED budget line (budget ${priorSharedBudget.id}, limit ${priorSharedBudget.limitAmount.toString()}) that may still include this policy's contribution — the family's total budgeted limit may now be double-counted. This cannot be safely auto-corrected from the data available; review this family's budgets manually.`,
    );

    await tx.notification.create({
      data: {
        familyGroupId,
        title: "Perhatian: kemungkinan anggaran premi ganda",
        body: `"${insurance.name}" baru saja mendapat kategori anggaran sendiri, tapi anggaran lama (id ${priorSharedBudget.id}) masih memiliki batas tetap yang mungkin masih menghitung kontribusi premi ini. Silakan tinjau anggaran keluarga Anda.`,
        icon: "⚠️",
      },
    });
  }

  private async maybeNotifyRenewal(
    familyGroupId: string,
    name: string,
    renewalDate: Date | null,
  ): Promise<void> {
    if (!renewalDate) return;
    const days = daysUntil(renewalDate);
    if (days < 0 || days > 30) return;
    try {
      const prefs = await ownerNotifPrefs(this.prisma, familyGroupId);
      if (!prefs.billDue) return;

      await this.prisma.notification.create({
        data: {
          familyGroupId,
          title: "Polis Hampir Jatuh Tempo",
          body: `${name} jatuh tempo dalam ${days} hari`,
          icon: "🛡️",
          isRead: false,
        },
      });
    } catch (err: unknown) {
      // LOW (group E retry) — best-effort notification: never fail the
      // main operation, but a systematic failure must not be invisible.
      this.logger.warn(
        `maybeNotifyRenewal failed for familyGroupId=${familyGroupId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

function toBeneficiaryCreateInput(b: CreateInsuranceBeneficiaryDto) {
  return {
    name: b.name,
    relationship: b.relationship,
    sharePercent: b.sharePercent,
    memberUserId: b.memberUserId ?? null,
  };
}
