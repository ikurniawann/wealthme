import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ownerNotifPrefs } from "../notifications/notification-prefs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateInsuranceBeneficiaryDto } from "./dto/create-insurance-beneficiary.dto";
import type { CreateInsuranceDto } from "./dto/create-insurance.dto";
import type {
  InsuranceBeneficiaryResponseDto,
  InsuranceResponseDto,
  InsuranceSummaryResponseDto,
} from "./dto/insurance-response.dto";
import type { UpdateInsuranceDto } from "./dto/update-insurance.dto";

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

function toInsuranceDto(row: InsuranceRow): InsuranceResponseDto {
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
    return rows.map(toInsuranceDto);
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

    const insurance = await this.prisma.insurance.create({
      data: {
        familyGroupId,
        name: dto.name,
        provider: dto.provider ?? null,
        type: dto.type,
        status: dto.status ?? "aktif",
        coverageAmount: dto.coverageAmount ? BigInt(dto.coverageAmount) : null,
        premiumAmount: BigInt(dto.premiumAmount),
        premiumPeriod: dto.premiumPeriod ?? "monthly",
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

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.insurance.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Insurance not found");
    }
    await this.prisma.insurance.delete({ where: { id, familyGroupId } });
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
