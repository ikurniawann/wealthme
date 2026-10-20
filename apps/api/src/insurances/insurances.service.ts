import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type InsuranceType } from "@prisma/client";

import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import {
  INSURANCE_INCLUDE,
  referencedMemberIds,
  toInsuranceDto,
  type InsuranceWithRelations,
  type MemberLookup,
} from "./insurance-mapper";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsurancePaymentsService } from "./insurance-payments.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsurancePremiumBudgetService } from "./insurance-premium-budget.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceRemindersService } from "./insurance-reminders.service";
import {
  insuranceVisibilityWhere,
  type InsuranceViewer,
} from "./insurance-scope.util";
import { buildInsuranceSummary } from "./insurance-summary";
import {
  monthlyBudgetContribution,
  parseDateOnly,
  todayInTimeZone,
} from "./premium-schedule.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceNetWorthService } from "./value/insurance-net-worth.service";

import type { CreateInsuranceBeneficiaryDto } from "./dto/create-insurance-beneficiary.dto";
import type { CreateInsuranceDto } from "./dto/create-insurance.dto";
import type { CreateInsuranceBenefitDto } from "./dto/insurance-rebuild-fields.dto";
import type {
  InsuranceResponseDto,
  InsuranceSummaryResponseDto,
} from "./dto/insurance-response.dto";
import type {
  InsuranceSummaryQueryDto,
  ListInsurancesQueryDto,
} from "./dto/list-insurances-query.dto";
import type { UpdateInsuranceDto } from "./dto/update-insurance.dto";
import type { TxClient } from "../common/utils/serializable-retry.util";

type WriteDto = CreateInsuranceDto | UpdateInsuranceDto;

// EPIC-021 Group D (#14) — beneficiaries may be partially allocated; only a
// sum over 100 is rejected (the web warns when it is under 100).
function validateSharePercent(beneficiaries: { sharePercent: number }[]): void {
  const total = beneficiaries.reduce((sum, b) => sum + b.sharePercent, 0);
  if (total > 100) {
    throw new BadRequestException(`Total sharePercent (${total}) exceeds 100`);
  }
}

const optDate = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : parseDateOnly(v);

/** The benefit kind a legacy single coverage amount stands for (S4). */
function legacyBenefitKind(type: InsuranceType) {
  return type === "jiwa" ? "life_sum_assured" : "other";
}

/**
 * LEGACY `coverageAmount` (BigInt, read by quickinput/anggaran) is an IDR
 * amount (controller ruling: like premiumAmount, it is stored in IDR). It
 * mirrors the primary benefit only while that benefit is in IDR.
 */
const LEGACY_AMOUNT_CURRENCY = "IDR";

function coverageFromBenefits(
  benefits: CreateInsuranceBenefitDto[],
  currency: string,
): bigint | null {
  const primary = benefits.find((b) => b.isPrimary) ?? benefits[0];
  if (
    !primary?.amount ||
    (primary.currency ?? currency) !== LEGACY_AMOUNT_CURRENCY
  ) {
    return null;
  }
  return BigInt(
    new Prisma.Decimal(primary.amount)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .toFixed(0),
  );
}

function benefitRows(
  benefits: CreateInsuranceBenefitDto[],
  currency: string,
): Prisma.InsuranceBenefitCreateWithoutInsuranceInput[] {
  const primaryIdx = Math.max(
    0,
    benefits.findIndex((b) => b.isPrimary),
  );
  return benefits.map((b, i) => ({
    kind: b.kind,
    label: b.label ?? null,
    amount: b.amount ? new Prisma.Decimal(b.amount) : null,
    currency: b.currency ?? currency,
    period: b.period ?? null,
    note: b.note ?? null,
    isPrimary: i === primaryIdx,
    confirmed: true,
    sortOrder: i,
  }));
}

function toBeneficiaryCreateInput(b: CreateInsuranceBeneficiaryDto) {
  return {
    name: b.name,
    relationship: b.relationship,
    sharePercent: b.sharePercent,
    memberUserId: b.memberUserId ?? null,
  };
}

function insuredCreate(dto: WriteDto) {
  return (dto.insured ?? []).map((i) => ({
    name: i.name,
    relationship: i.relationship ?? null,
    memberUserId: i.memberUserId ?? null,
  }));
}

function sharesCreate(dto: WriteDto) {
  return [...new Set(dto.sharedWithUserIds ?? [])].map((userId) => ({
    userId,
  }));
}

/**
 * Asuransi Task 22 — policy CRUD with roles/benefits (S1–S4), list filters,
 * the summary, and S9 row scoping. Payments live in
 * InsurancePaymentsService, values in InsuranceValuationsService.
 */
@Injectable()
export class InsurancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: InsurancePremiumBudgetService,
    private readonly payments: InsurancePaymentsService,
    private readonly reminders: InsuranceRemindersService,
    private readonly netWorth: InsuranceNetWorthService,
  ) {}

  /** S9 — 404 unless this viewer may see the policy (no existence leak). */
  async assertVisible(
    familyGroupId: string,
    id: string,
    viewer: InsuranceViewer,
  ): Promise<void> {
    const found = await this.prisma.insurance.findFirst({
      where: { id, familyGroupId, ...insuranceVisibilityWhere(viewer) },
      select: { id: true },
    });
    if (!found) throw new NotFoundException("Insurance not found");
  }

  // EPIC-023 F1 (D14) — CURRENT name/relationship of every linked member,
  // batched (one query) across all serialized policies.
  private async resolveMemberLookup(
    familyGroupId: string,
    ids: readonly string[],
  ): Promise<MemberLookup> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const members = await this.prisma.member.findMany({
      where: { familyGroupId, userId: { in: unique } },
      include: { user: { select: { name: true } } },
    });
    return new Map(
      members.map((m) => [
        m.userId,
        { name: m.user.name, relationship: m.relationship },
      ]),
    );
  }

  private async serialize(
    familyGroupId: string,
    rows: InsuranceWithRelations[],
  ): Promise<InsuranceResponseDto[]> {
    const today = todayInTimeZone();
    const [lookup, paid] = await Promise.all([
      this.resolveMemberLookup(familyGroupId, referencedMemberIds(rows)),
      this.payments.paidThisPeriodIds(familyGroupId, rows, today),
    ]);
    return rows.map((r) =>
      toInsuranceDto(r, { lookup, today, paidThisPeriod: paid.has(r.id) }),
    );
  }

  private listWhere(
    query: ListInsurancesQueryDto,
  ): Prisma.InsuranceWhereInput[] {
    const and: Prisma.InsuranceWhereInput[] = [];
    if (query.q) {
      const contains = { contains: query.q, mode: "insensitive" as const };
      and.push({
        OR: [
          { name: contains },
          { provider: contains },
          { policyNumber: contains },
        ],
      });
    }
    if (query.holderUserId) and.push({ holderUserId: query.holderUserId });
    if (query.insuredUserId) {
      and.push({ insured: { some: { memberUserId: query.insuredUserId } } });
    }
    if (query.provider) {
      and.push({ provider: { contains: query.provider, mode: "insensitive" } });
    }
    if (query.type) and.push({ type: query.type });
    if (query.policyType) {
      and.push({
        policyType: query.policyType === "unset" ? null : query.policyType,
      });
    }
    if (query.status) and.push({ status: query.status });
    if (query.dueFrom || query.dueTo) {
      and.push({
        nextPremiumDueDate: {
          ...(query.dueFrom && { gte: parseDateOnly(query.dueFrom) }),
          ...(query.dueTo && { lte: parseDateOnly(query.dueTo) }),
        },
      });
    }
    if (query.currency) and.push({ currency: query.currency });
    return and;
  }

  async findAll(
    familyGroupId: string,
    query: ListInsurancesQueryDto,
    viewer: InsuranceViewer,
  ): Promise<InsuranceResponseDto[]> {
    await this.payments.reconcileLegacyPayments(familyGroupId);
    const rows = await this.prisma.insurance.findMany({
      where: {
        familyGroupId,
        AND: [insuranceVisibilityWhere(viewer), ...this.listWhere(query)],
      },
      include: INSURANCE_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return this.serialize(familyGroupId, rows);
  }

  async findOne(
    familyGroupId: string,
    id: string,
    viewer: InsuranceViewer,
  ): Promise<InsuranceResponseDto> {
    const row = await this.prisma.insurance.findFirst({
      where: { id, familyGroupId, ...insuranceVisibilityWhere(viewer) },
      include: INSURANCE_INCLUDE,
    });
    if (!row) throw new NotFoundException("Insurance not found");
    const [dto] = await this.serialize(familyGroupId, [row]);
    if (!dto) throw new NotFoundException("Insurance not found");
    return dto;
  }

  async getSummary(
    familyGroupId: string,
    query: InsuranceSummaryQueryDto,
    viewer: InsuranceViewer,
  ): Promise<InsuranceSummaryResponseDto> {
    await this.payments.reconcileLegacyPayments(familyGroupId);
    const rows = await this.prisma.insurance.findMany({
      where: { familyGroupId, ...insuranceVisibilityWhere(viewer) },
      include: {
        benefits: true,
        valuations: { where: { status: "confirmed" } },
      },
    });
    // S6 — the shared helper's figure, limited to policies this viewer sees.
    const positions = await this.netWorth.positions(familyGroupId);
    const visible = new Set(rows.map((r) => r.id));
    const netWorthValueIdr = positions
      .filter((p) => visible.has(p.insuranceId))
      .reduce((sum, p) => sum + (p.valueIdr ?? 0n), 0n);
    return buildInsuranceSummary(rows, {
      today: todayInTimeZone(),
      from: query.from ? parseDateOnly(query.from) : undefined,
      to: query.to ? parseDateOnly(query.to) : undefined,
      netWorthValueIdr,
    });
  }

  /**
   * Same-family checks for every person/account the DTO references (Task 21
   * review fix 5): holder, payer, insured members, beneficiaries, shares and
   * the payment account.
   */
  private async assertReferencesInFamily(
    familyGroupId: string,
    dto: WriteDto,
  ): Promise<void> {
    const userIds = [
      dto.holderUserId,
      dto.payerUserId,
      ...(dto.insured ?? []).map((i) => i.memberUserId),
      ...(dto.beneficiaries ?? []).map((b) => b.memberUserId),
      ...(dto.sharedWithUserIds ?? []),
    ].filter((id): id is string => !!id);
    const unique = [...new Set(userIds)];
    if (unique.length > 0) {
      const found = await this.prisma.member.count({
        where: { familyGroupId, userId: { in: unique } },
      });
      if (found !== unique.length) {
        throw new BadRequestException(
          "Pemegang polis, pembayar, tertanggung, penerima manfaat atau pengguna yang dibagikan harus anggota keluarga ini",
        );
      }
    }
    if (dto.paymentAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.paymentAccountId, familyGroupId },
        select: { id: true },
      });
      if (!account) {
        throw new BadRequestException(
          "Rekening pembayaran tidak ditemukan di keluarga ini",
        );
      }
    }
  }

  /** Scalar rebuild fields (S1–S3, S6) present on the DTO. */
  private rebuildData(dto: WriteDto) {
    // S1 — the legacy `renewalDate` the current web may still send means the
    // next premium due; nextPremiumDueDate wins when both are sent. The
    // legacy column keeps being written alongside during the rollback window.
    const nextDue =
      dto.nextPremiumDueDate !== undefined
        ? optDate(dto.nextPremiumDueDate)
        : optDate(dto.renewalDate);
    return {
      ...(nextDue !== undefined && {
        nextPremiumDueDate: nextDue,
        renewalDate: nextDue,
      }),
      ...(dto.policyType !== undefined && { policyType: dto.policyType }),
      ...(dto.policyRenewalDate !== undefined && {
        policyRenewalDate: optDate(dto.policyRenewalDate),
      }),
      ...(dto.premiumPaymentEndDate !== undefined && {
        premiumPaymentEndDate: optDate(dto.premiumPaymentEndDate),
      }),
      ...(dto.coverageStartDate !== undefined && {
        coverageStartDate: optDate(dto.coverageStartDate),
      }),
      ...(dto.coverageEndDate !== undefined && {
        coverageEndDate: optDate(dto.coverageEndDate),
      }),
      ...(dto.holderUserId !== undefined && { holderUserId: dto.holderUserId }),
      ...(dto.holderName !== undefined && { holderName: dto.holderName }),
      ...(dto.payerUserId !== undefined && { payerUserId: dto.payerUserId }),
      ...(dto.payerName !== undefined && { payerName: dto.payerName }),
      ...(dto.paymentAccountId !== undefined && {
        paymentAccountId: dto.paymentAccountId,
      }),
      ...(dto.includeInNetWorth !== undefined && {
        includeInNetWorth: dto.includeInNetWorth,
      }),
    };
  }

  async create(
    familyGroupId: string,
    dto: CreateInsuranceDto,
    viewer: InsuranceViewer,
  ): Promise<InsuranceResponseDto> {
    if (dto.beneficiaries?.length) validateSharePercent(dto.beneficiaries);
    await this.assertReferencesInFamily(familyGroupId, dto);
    const created = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runCreate(tx, familyGroupId, dto, viewer),
    );
    void this.reminders.remindIfDue(created);
    return this.findOne(familyGroupId, created.id, viewer);
  }

  private async runCreate(
    tx: TxClient,
    familyGroupId: string,
    dto: CreateInsuranceDto,
    viewer: InsuranceViewer,
  ) {
    const premiumAmount = BigInt(dto.premiumAmount);
    const premiumPeriod = dto.premiumPeriod ?? "monthly";
    const currency = dto.currency ?? "IDR";
    // S4 — a legacy single coverage amount becomes the primary benefit.
    const benefits: CreateInsuranceBenefitDto[] =
      dto.benefits ??
      (dto.coverageAmount && BigInt(dto.coverageAmount) > 0n
        ? [
            {
              kind: legacyBenefitKind(dto.type),
              amount: dto.coverageAmount,
              currency: LEGACY_AMOUNT_CURRENCY,
              isPrimary: true,
            },
          ]
        : []);
    const insured = insuredCreate(dto);
    const shares = sharesCreate(dto);

    const created = await tx.insurance.create({
      data: {
        ...this.rebuildData(dto),
        familyGroupId,
        name: dto.name,
        provider: dto.provider ?? null,
        type: dto.type,
        status: dto.status ?? "aktif",
        coverageAmount: dto.benefits
          ? coverageFromBenefits(dto.benefits, currency)
          : dto.coverageAmount
            ? BigInt(dto.coverageAmount)
            : null,
        premiumAmount,
        premiumPeriod,
        autoRenewDate: dto.autoRenewDate ?? false,
        policyNumber: dto.policyNumber ?? null,
        notes: dto.notes ?? null,
        currency,
        createdByUserId: viewer.userId,
        ...(dto.beneficiaries?.length && {
          beneficiaries: {
            create: dto.beneficiaries.map(toBeneficiaryCreateInput),
          },
        }),
        ...(insured.length && { insured: { create: insured } }),
        ...(benefits.length && {
          benefits: { create: benefitRows(benefits, currency) },
        }),
        ...(shares.length && { shares: { create: shares } }),
      },
    });

    const contribution = monthlyBudgetContribution(
      premiumAmount,
      premiumPeriod,
    );
    if (contribution > 0n) {
      await this.budget.syncPremiumBudgetLine(
        tx,
        familyGroupId,
        created,
        contribution,
      );
    }
    return created;
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateInsuranceDto,
    viewer: InsuranceViewer,
  ): Promise<InsuranceResponseDto> {
    await this.assertVisible(familyGroupId, id, viewer);
    if (dto.beneficiaries?.length) validateSharePercent(dto.beneficiaries);
    await this.assertReferencesInFamily(familyGroupId, dto);
    const updated = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runUpdate(tx, familyGroupId, id, dto),
    );
    void this.reminders.remindIfDue(updated);
    return this.findOne(familyGroupId, id, viewer);
  }

  private async runUpdate(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: UpdateInsuranceDto,
  ) {
    const existing = await tx.insurance.findUniqueOrThrow({
      where: { id, familyGroupId },
    });
    const currency = dto.currency ?? existing.currency;
    const premiumAmount =
      dto.premiumAmount !== undefined
        ? BigInt(dto.premiumAmount)
        : existing.premiumAmount;
    const premiumPeriod = dto.premiumPeriod ?? existing.premiumPeriod;

    // Lists sent on update replace the stored list.
    if (dto.beneficiaries !== undefined) {
      await tx.insuranceBeneficiary.deleteMany({ where: { insuranceId: id } });
    }
    if (dto.insured !== undefined) {
      await tx.insuranceInsured.deleteMany({ where: { insuranceId: id } });
    }
    if (dto.sharedWithUserIds !== undefined) {
      await tx.insuranceShare.deleteMany({ where: { insuranceId: id } });
    }
    let coverageAmount: bigint | null | undefined;
    if (dto.benefits !== undefined) {
      await tx.insuranceBenefit.deleteMany({ where: { insuranceId: id } });
      coverageAmount = coverageFromBenefits(dto.benefits, currency);
    } else if (dto.coverageAmount !== undefined) {
      coverageAmount = dto.coverageAmount ? BigInt(dto.coverageAmount) : null;
      await this.syncLegacyPrimaryBenefit(
        tx,
        id,
        existing.type,
        coverageAmount,
      );
    }
    const insured = insuredCreate(dto);
    const shares = sharesCreate(dto);

    const updated = await tx.insurance.update({
      where: { id, familyGroupId },
      data: {
        ...this.rebuildData(dto),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.provider !== undefined && { provider: dto.provider ?? null }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(coverageAmount !== undefined && { coverageAmount }),
        premiumAmount,
        premiumPeriod,
        ...(dto.autoRenewDate !== undefined && {
          autoRenewDate: dto.autoRenewDate,
        }),
        ...(dto.policyNumber !== undefined && {
          policyNumber: dto.policyNumber ?? null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
        currency,
        ...(dto.beneficiaries?.length && {
          beneficiaries: {
            create: dto.beneficiaries.map(toBeneficiaryCreateInput),
          },
        }),
        ...(insured.length && { insured: { create: insured } }),
        ...(dto.benefits?.length && {
          benefits: { create: benefitRows(dto.benefits, currency) },
        }),
        ...(shares.length && { shares: { create: shares } }),
      },
    });

    await this.budget.syncPremiumBudgetLine(
      tx,
      familyGroupId,
      { ...updated, premiumCategoryId: existing.premiumCategoryId },
      monthlyBudgetContribution(premiumAmount, premiumPeriod),
    );
    return updated;
  }

  /**
   * The legacy form edits only `coverageAmount`: keep the primary benefit in
   * step (S4) — update it, create it, or drop it when cleared.
   */
  private async syncLegacyPrimaryBenefit(
    tx: TxClient,
    insuranceId: string,
    type: InsuranceType,
    amount: bigint | null,
  ): Promise<void> {
    const primary = await tx.insuranceBenefit.findFirst({
      where: { insuranceId, isPrimary: true },
    });
    if (!amount || amount <= 0n) {
      if (primary) {
        await tx.insuranceBenefit.delete({ where: { id: primary.id } });
      }
      return;
    }
    const value = new Prisma.Decimal(amount.toString());
    if (primary) {
      await tx.insuranceBenefit.update({
        where: { id: primary.id },
        data: { amount: value, confirmed: true },
      });
      return;
    }
    await tx.insuranceBenefit.create({
      data: {
        insuranceId,
        kind: legacyBenefitKind(type),
        amount: value,
        currency: LEGACY_AMOUNT_CURRENCY,
        isPrimary: true,
        confirmed: true,
      },
    });
  }

  /**
   * EPIC-023 E2 (D11) CRITICAL 1 — a policy with a budget line refuses
   * deletion (no silent cascade). Task 21 review fix — so does a policy
   * with payments, valuations or documents (history; documents also hold
   * storage objects Task 23 must delete first).
   */
  async remove(
    familyGroupId: string,
    id: string,
    viewer: InsuranceViewer,
  ): Promise<void> {
    await this.assertVisible(familyGroupId, id, viewer);
    const existing = await this.prisma.insurance.findUniqueOrThrow({
      where: { id, familyGroupId },
    });
    // Guard counts and the delete run in ONE serializable transaction, so a
    // payment/valuation/document written between the check and the delete
    // can never be cascaded away silently.
    await runSerializableWithRetry(this.prisma, async (tx) => {
      const budget = await tx.budget.findFirst({
        where: { familyGroupId, insuranceId: id },
        select: { id: true },
      });
      if (budget) {
        throw new ConflictException(
          `Tidak dapat menghapus "${existing.name}" — hapus dulu anggaran (budget) terkait (id ${budget.id})`,
        );
      }
      const [payments, valuations, documents] = await Promise.all([
        tx.insurancePayment.count({ where: { insuranceId: id } }),
        tx.insuranceValuation.count({ where: { insuranceId: id } }),
        tx.insuranceDocument.count({ where: { insuranceId: id } }),
      ]);
      if (payments + valuations + documents > 0) {
        throw new ConflictException(
          `Tidak dapat menghapus "${existing.name}" — polis ini memiliki riwayat pembayaran (${payments}), nilai polis (${valuations}) atau dokumen (${documents}). Ubah status polis menjadi tidak aktif atau berakhir; riwayatnya tetap tersimpan.`,
        );
      }
      await tx.insurance.delete({ where: { id, familyGroupId } });
    });
  }
}
