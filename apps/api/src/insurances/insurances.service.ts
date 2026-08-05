import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import { ownerNotifPrefs } from "../notifications/notification-prefs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

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

type TxClient = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

// EPIC-023 E1 — GENERIC_COA_CHART (every real family) has no dedicated
// insurance-premium COA line, unlike loans (20009/21304 — see
// liabilities.service.ts's LOAN_INTEREST_COA_CODES). "20099" (Pengeluaran
// Lainnya / Other Expenses) is the honest general-purpose EXPENSE code every
// family already has — the same fallback `defaultCoaCodeForCategory`
// (default-coa-chart.ts) uses for an unmatched expense category. The demo
// seed's richer chart provides "21104" (Asset & Other Insurance) as its
// closest dedicated match. Matching on either code keeps `pay()` correct for
// both charts without hardcoding one over the other or inventing a new
// per-InsuranceType mapping (jiwa/kesehatan/kendaraan/... categories do not
// exist as distinct COA lines in either chart).
const INSURANCE_PREMIUM_COA_CODES = ["20099", "21104"];

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
  createdAt: Date;
  updatedAt: Date;
  beneficiaries?: BeneficiaryRow[];
};

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function toBeneficiaryDto(
  row: BeneficiaryRow,
): InsuranceBeneficiaryResponseDto {
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    name: row.name,
    relationship: row.relationship,
    sharePercent: row.sharePercent.toString(),
    memberUserId: row.memberUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Mirrors `BudgetsService.findAll`'s "this calendar month" window. */
function currentMonthBounds(): { monthStart: Date; monthEnd: Date } {
  const now = new Date();
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

function toInsuranceDto(
  row: InsuranceRow,
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
    beneficiaries: (row.beneficiaries ?? []).map(toBeneficiaryDto),
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
  constructor(private readonly prisma: PrismaService) {}

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

  async findAll(familyGroupId: string): Promise<InsuranceResponseDto[]> {
    const rows = await this.prisma.insurance.findMany({
      where: { familyGroupId },
      include: { beneficiaries: true },
      orderBy: { createdAt: "asc" },
    });

    const paidSet = await this.paidThisPeriodIds(
      familyGroupId,
      rows.map((r) => r.id),
    );

    return rows.map((r) => toInsuranceDto(r, paidSet.has(r.id)));
  }

  /**
   * EPIC-023 E2 — set of insurance ids with at least one premium payment
   * (`Transaction.insuranceId`, E1) `occurredAt` in the current calendar
   * month. Mirrors `LiabilitiesService.paidThisPeriodIds`.
   */
  private async paidThisPeriodIds(
    familyGroupId: string,
    insuranceIds: string[],
  ): Promise<Set<string>> {
    if (insuranceIds.length === 0) return new Set();
    const { monthStart, monthEnd } = currentMonthBounds();
    const rows = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        insuranceId: { in: insuranceIds },
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
      select: { insuranceId: true },
      distinct: ["insuranceId"],
    });
    return new Set(rows.map((r) => r.insuranceId!));
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
   * EPIC-023 E2 (D11, US-LIAB-3) — creating a policy auto-creates (or tops
   * up) a FIXED budget line for its premium — see
   * `LiabilitiesService.create()`'s doc comment for the full reasoning,
   * which applies identically here: the category MUST be the same one
   * `pay()` already posts premium payments against
   * (`resolvePremiumCategoryId`, unchanged) so `BudgetsService`'s
   * `spentAmount` tracks real payments, and every policy in a family group
   * shares ONE FIXED "premi asuransi" budget line (monthly period) whose
   * limit is the SUM of every policy's monthly-normalised premium
   * (`monthlyAmount`, already used by `getSummary`) — `@@unique` collision
   * handled the same way, via `upsert`.
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

    const insurance = await this.prisma.$transaction(async (tx) => {
      const created = await tx.insurance.create({
        data: {
          familyGroupId,
          name: dto.name,
          provider: dto.provider ?? null,
          type: dto.type,
          status: dto.status ?? "aktif",
          coverageAmount: dto.coverageAmount
            ? BigInt(dto.coverageAmount)
            : null,
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
        const categoryId = await this.resolvePremiumCategoryId(
          tx,
          familyGroupId,
        );
        await this.markCategoryFixed(tx, categoryId);
        await this.upsertFixedBudgetLine(tx, {
          familyGroupId,
          categoryId,
          contribution: monthlyContribution,
          insuranceId: created.id,
        });
      }

      return created;
    });

    void this.maybeNotifyRenewal(
      familyGroupId,
      insurance.name,
      insurance.renewalDate,
    );

    return toInsuranceDto(insurance);
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

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.beneficiaries !== undefined) {
        await tx.insuranceBeneficiary.deleteMany({
          where: { insuranceId: id },
        });
      }

      return tx.insurance.update({
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
          premiumAmount: dto.premiumAmount
            ? BigInt(dto.premiumAmount)
            : existing.premiumAmount,
          premiumPeriod: dto.premiumPeriod ?? existing.premiumPeriod,
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
    });

    void this.maybeNotifyRenewal(
      familyGroupId,
      updated.name,
      updated.renewalDate,
    );

    return toInsuranceDto(updated);
  }

  /**
   * EPIC-023 E2 (D11) — same treatment as `LiabilitiesService.remove()`:
   * refuses (409, never a silent cascade) while a FIXED budget line
   * derived from this policy's premium category still exists. The
   * reasoning is identical — the premium category is shared and read-only
   * looked up here (no self-heal `create`).
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.insurance.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Insurance not found");
    }

    const category = await this.prisma.category.findFirst({
      where: {
        familyGroupId,
        coaAccount: { code: { in: INSURANCE_PREMIUM_COA_CODES } },
      },
      select: { id: true, name: true },
    });
    if (category) {
      const budget = await this.prisma.budget.findUnique({
        where: {
          familyGroupId_categoryId_period: {
            familyGroupId,
            categoryId: category.id,
            period: "monthly",
          },
        },
      });
      if (budget) {
        throw new ConflictException(
          `Tidak dapat menghapus polis ini karena masih memiliki anggaran tetap "${category.name}". Hapus atau sesuaikan anggaran tersebut terlebih dahulu.`,
        );
      }
    }

    await this.prisma.insurance.delete({ where: { id, familyGroupId } });
  }

  /** Mirrors `LiabilitiesService.markCategoryFixed`. */
  private async markCategoryFixed(
    tx: TxClient,
    categoryId: string,
  ): Promise<void> {
    const category = await tx.category.findUniqueOrThrow({
      where: { id: categoryId },
      select: { coaAccountId: true },
    });
    await tx.coaAccount.update({
      where: { id: category.coaAccountId },
      data: { budgetType: "FIXED" },
    });
  }

  /** Mirrors `LiabilitiesService.upsertFixedBudgetLine`. */
  private async upsertFixedBudgetLine(
    tx: TxClient,
    params: {
      familyGroupId: string;
      categoryId: string;
      contribution: bigint;
      insuranceId: string;
    },
  ): Promise<void> {
    const { familyGroupId, categoryId, contribution, insuranceId } = params;
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
        insuranceId,
      },
      update: {
        limitAmount: { increment: contribution },
      },
    });
  }

  /**
   * Records a premium payment against an insurance policy: creates ONE
   * `Transaction` linked via `insuranceId`, debits the source account by the
   * paid amount, and advances `renewalDate` by one premium period — EPIC-023
   * E1 (D10, US-LIAB-4, US-INS-4). Everything happens inside one
   * `$transaction` so a failure never leaves the account debited without the
   * policy/ledger updated, or vice versa.
   *
   * Unlike `LiabilitiesService.pay()`, this does not run at Serializable
   * isolation with a bounded retry: there is no `remainingBalance`
   * accumulator here whose read-then-write can race (the account debit is
   * an atomic `decrement` regardless of isolation level), and a
   * `renewalDate` double-advance from two genuinely concurrent premium
   * payments on the SAME policy is an edge case this task deliberately
   * does not add extra machinery for — see this task's Automation Log.
   */
  async pay(
    familyGroupId: string,
    id: string,
    dto: PayInsuranceDto,
  ): Promise<InsuranceResponseDto> {
    return this.prisma.$transaction((tx) =>
      this.runPay(tx, familyGroupId, id, dto),
    );
  }

  private async runPay(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: PayInsuranceDto,
  ): Promise<InsuranceResponseDto> {
    const insurance = await tx.insurance.findUnique({
      where: { id, familyGroupId },
    });
    if (!insurance) {
      throw new NotFoundException("Insurance not found");
    }

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

    const categoryId = await this.resolvePremiumCategoryId(tx, familyGroupId);
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

    const updated = await tx.insurance.update({
      where: { id, familyGroupId },
      data: insurance.renewalDate
        ? {
            renewalDate: nextRenewalDate(
              insurance.renewalDate,
              insurance.premiumPeriod,
            ),
          }
        : {},
    });

    return toInsuranceDto(updated);
  }

  /**
   * Finds (or, self-healing like `LiabilitiesService`'s category resolvers,
   * creates) a Category in this family group linked to a general-purpose
   * EXPENSE CoaAccount, so a premium payment always has somewhere honest to
   * post against — see `INSURANCE_PREMIUM_COA_CODES`'s doc comment for why
   * there is no dedicated per-policy-type category.
   */
  private async resolvePremiumCategoryId(
    tx: TxClient,
    familyGroupId: string,
  ): Promise<string> {
    const existing = await tx.category.findFirst({
      where: {
        familyGroupId,
        coaAccount: { code: { in: INSURANCE_PREMIUM_COA_CODES } },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const coaAccount = await tx.coaAccount.findFirst({
      where: { familyGroupId, code: { in: INSURANCE_PREMIUM_COA_CODES } },
      orderBy: { code: "asc" },
    });
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no general-purpose expense COA account provisioned",
      );
    }

    // EPIC-023 review follow-up (liabilities.service.ts) — the same
    // concurrent-self-heal P2002 race applies here; a fresh Category
    // `create()` is left to surface (and, if ever needed, be retried by a
    // caller) exactly like that file's documented, deliberate choice not to
    // recover in-transaction.
    const created = await tx.category.create({
      data: {
        familyGroupId,
        name: coaAccount.name,
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
    });
    return created.id;
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
    } catch {
      // notification is best-effort; never fail the main operation
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
