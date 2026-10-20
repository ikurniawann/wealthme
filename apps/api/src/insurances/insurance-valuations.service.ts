import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { toValuationDto } from "./insurance-mapper";
import { parseDateOnly, todayInTimeZone, ymd } from "./premium-schedule.util";

import type {
  CreateInsuranceFundDto,
  CreateInsuranceValuationDto,
  UpdateInsuranceFundDto,
  UpdateInsuranceValuationDto,
} from "./dto/insurance-valuation.dto";
import type {
  InsuranceFundDto,
  InsuranceValuationDto,
} from "@wealthme/contracts";

/**
 * A value statement describes a value AS OF a date that has happened: an
 * effective date after today (Asia/Jakarta) is refused, so a typo can never
 * become the "latest" value and pin net worth until that date passes.
 */
export function assertNotFutureEffectiveDate(effectiveDate: string): void {
  const today = todayInTimeZone();
  if (parseDateOnly(effectiveDate) > today) {
    throw new BadRequestException(
      `Tanggal efektif ${effectiveDate} melewati hari ini (${ymd(today)}) — nilai polis hanya untuk tanggal yang sudah lewat`,
    );
  }
}

const dec = (v: string | undefined | null) =>
  v === undefined ? undefined : v === null ? null : new Prisma.Decimal(v);
const date = (v: string | undefined | null) =>
  v === undefined ? undefined : v === null ? null : parseDateOnly(v);

/**
 * Asuransi S5 — unit-link sub-funds and dated value statements with a
 * confirmation state. Value updates NEVER create cash transactions (S6).
 * Callers have already checked the policy is visible to the viewer (S9).
 */
@Injectable()
export class InsuranceValuationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async policy(familyGroupId: string, insuranceId: string) {
    const p = await this.prisma.insurance.findUnique({
      where: { id: insuranceId, familyGroupId },
      select: { id: true, policyType: true, currency: true },
    });
    if (!p) throw new NotFoundException("Insurance not found");
    return p;
  }

  // ── Funds ──────────────────────────────────────────────────────────────

  async createFund(
    familyGroupId: string,
    insuranceId: string,
    dto: CreateInsuranceFundDto,
  ): Promise<InsuranceFundDto> {
    const p = await this.policy(familyGroupId, insuranceId);
    if (p.policyType !== "unit_link") {
      throw new BadRequestException(
        "Subdana hanya untuk polis Unit Link — tetapkan tipe polis terlebih dahulu",
      );
    }
    const row = await this.prisma.insuranceFund.create({
      data: {
        insuranceId,
        code: dto.code ?? null,
        name: dto.name.trim(),
        currency: dto.currency ?? p.currency,
      },
    });
    return fundDto(row);
  }

  async updateFund(
    familyGroupId: string,
    insuranceId: string,
    fundId: string,
    dto: UpdateInsuranceFundDto,
  ): Promise<InsuranceFundDto> {
    await this.fund(familyGroupId, insuranceId, fundId);
    const row = await this.prisma.insuranceFund.update({
      where: { id: fundId },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
      },
    });
    return fundDto(row);
  }

  async removeFund(
    familyGroupId: string,
    insuranceId: string,
    fundId: string,
  ): Promise<void> {
    await this.fund(familyGroupId, insuranceId, fundId);
    const count = await this.prisma.insuranceValuation.count({
      where: { fundId },
    });
    if (count > 0) {
      throw new ConflictException(
        `Subdana ini masih memiliki ${count} riwayat nilai — hapus riwayat nilainya terlebih dahulu`,
      );
    }
    await this.prisma.insuranceFund.delete({ where: { id: fundId } });
  }

  private async fund(
    familyGroupId: string,
    insuranceId: string,
    fundId: string,
  ) {
    await this.policy(familyGroupId, insuranceId);
    const f = await this.prisma.insuranceFund.findFirst({
      where: { id: fundId, insuranceId },
    });
    if (!f) throw new NotFoundException("Fund not found");
    return f;
  }

  // ── Valuations ─────────────────────────────────────────────────────────

  async list(
    familyGroupId: string,
    insuranceId: string,
  ): Promise<InsuranceValuationDto[]> {
    await this.policy(familyGroupId, insuranceId);
    const rows = await this.prisma.insuranceValuation.findMany({
      where: { insuranceId },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toValuationDto);
  }

  async create(
    familyGroupId: string,
    insuranceId: string,
    dto: CreateInsuranceValuationDto,
    actorUserId: string | null,
  ): Promise<InsuranceValuationDto> {
    const p = await this.policy(familyGroupId, insuranceId);
    assertNotFutureEffectiveDate(dto.effectiveDate);
    await this.assertValid(p, insuranceId, dto);
    const currency = await this.valuationCurrency(
      dto.fundId ?? null,
      dto.currency,
      p.currency,
    );
    const source = dto.source ?? "manual";
    // A report row is never official until the user confirms it (S5/S8).
    const status =
      source === "report" ? "needs_confirmation" : (dto.status ?? "confirmed");
    const row = await this.prisma.insuranceValuation.create({
      data: {
        insuranceId,
        fundId: dto.fundId ?? null,
        currency,
        units: dec(dto.units),
        navPerUnit: dec(dto.navPerUnit),
        navDate: date(dto.navDate),
        unitsDate: date(dto.unitsDate),
        reportedValue: dec(dto.reportedValue),
        cashValue: dec(dto.cashValue),
        surrenderEstimate: dec(dto.surrenderEstimate),
        maturityBenefit: dec(dto.maturityBenefit),
        guaranteed: dto.guaranteed ?? false,
        effectiveDate: parseDateOnly(dto.effectiveDate),
        source,
        documentId: dto.documentId ?? null,
        page: dto.page ?? null,
        snippet: dto.snippet ?? null,
        status,
        ...(status === "confirmed" && {
          confirmedAt: new Date(),
          confirmedByUserId: actorUserId,
        }),
        createdByUserId: actorUserId,
      },
    });
    return toValuationDto(row);
  }

  async update(
    familyGroupId: string,
    insuranceId: string,
    valuationId: string,
    dto: UpdateInsuranceValuationDto,
    actorUserId: string | null,
  ): Promise<InsuranceValuationDto> {
    const p = await this.policy(familyGroupId, insuranceId);
    const existing = await this.valuation(insuranceId, valuationId);
    if (dto.effectiveDate !== undefined) {
      assertNotFutureEffectiveDate(dto.effectiveDate);
    }
    const merged = {
      fundId: dto.fundId ?? existing.fundId ?? undefined,
      units: dto.units ?? existing.units?.toString(),
      navPerUnit: dto.navPerUnit ?? existing.navPerUnit?.toString(),
      reportedValue: dto.reportedValue ?? existing.reportedValue?.toString(),
      documentId: dto.documentId ?? existing.documentId ?? undefined,
    };
    await this.assertValid(p, insuranceId, merged);
    const fundId = dto.fundId !== undefined ? dto.fundId : existing.fundId;
    const currency =
      dto.currency !== undefined || dto.fundId !== undefined
        ? await this.valuationCurrency(
            fundId ?? null,
            dto.currency ?? (fundId ? undefined : existing.currency),
            p.currency,
          )
        : undefined;
    const confirming = dto.status === "confirmed";
    const row = await this.prisma.insuranceValuation.update({
      where: { id: valuationId },
      data: {
        ...(dto.fundId !== undefined && { fundId: dto.fundId }),
        ...(currency !== undefined && { currency }),
        units: dec(dto.units),
        navPerUnit: dec(dto.navPerUnit),
        navDate: date(dto.navDate),
        unitsDate: date(dto.unitsDate),
        reportedValue: dec(dto.reportedValue),
        cashValue: dec(dto.cashValue),
        surrenderEstimate: dec(dto.surrenderEstimate),
        maturityBenefit: dec(dto.maturityBenefit),
        ...(dto.guaranteed !== undefined && { guaranteed: dto.guaranteed }),
        ...(dto.effectiveDate !== undefined && {
          effectiveDate: parseDateOnly(dto.effectiveDate),
        }),
        ...(dto.page !== undefined && { page: dto.page }),
        ...(dto.snippet !== undefined && { snippet: dto.snippet }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(confirming && {
          confirmedAt: new Date(),
          confirmedByUserId: actorUserId,
        }),
        ...(dto.status === "needs_confirmation" && {
          confirmedAt: null,
          confirmedByUserId: null,
        }),
      },
    });
    return toValuationDto(row);
  }

  async confirm(
    familyGroupId: string,
    insuranceId: string,
    valuationId: string,
    actorUserId: string | null,
  ): Promise<InsuranceValuationDto> {
    await this.policy(familyGroupId, insuranceId);
    await this.valuation(insuranceId, valuationId);
    const row = await this.prisma.insuranceValuation.update({
      where: { id: valuationId },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedByUserId: actorUserId,
      },
    });
    return toValuationDto(row);
  }

  async remove(
    familyGroupId: string,
    insuranceId: string,
    valuationId: string,
  ): Promise<void> {
    await this.policy(familyGroupId, insuranceId);
    await this.valuation(insuranceId, valuationId);
    await this.prisma.insuranceValuation.delete({ where: { id: valuationId } });
  }

  /**
   * Task 22 review fix — a fund's value is in the FUND's currency. With a
   * fundId the currency defaults to the fund's and a different one is
   * refused (a USD fund's value must never be stored, and later summed, as
   * IDR). Without a fund, the given currency or the policy's.
   */
  async valuationCurrency(
    fundId: string | null,
    requested: string | undefined,
    policyCurrency: string,
  ): Promise<string> {
    if (!fundId) return requested ?? policyCurrency;
    const fund = await this.prisma.insuranceFund.findUnique({
      where: { id: fundId },
      select: { currency: true, name: true },
    });
    if (!fund) throw new BadRequestException("fundId bukan subdana polis ini");
    if (requested && requested !== fund.currency) {
      throw new BadRequestException(
        `Mata uang nilai (${requested}) berbeda dengan mata uang subdana "${fund.name}" (${fund.currency})`,
      );
    }
    return fund.currency;
  }

  private async valuation(insuranceId: string, valuationId: string) {
    const v = await this.prisma.insuranceValuation.findFirst({
      where: { id: valuationId, insuranceId },
    });
    if (!v) throw new NotFoundException("Valuation not found");
    return v;
  }

  /**
   * S5 + Task 21 review fix 5: EITHER reportedValue OR units+NAV (both
   * together); units/NAV only on unit_link policies and against one of the
   * policy's own funds; a document must belong to the policy.
   */
  private async assertValid(
    policy: { policyType: string | null },
    insuranceId: string,
    dto: {
      fundId?: string;
      units?: string;
      navPerUnit?: string;
      reportedValue?: string;
      documentId?: string;
    },
  ): Promise<void> {
    const hasUnits = dto.units !== undefined || dto.navPerUnit !== undefined;
    if (hasUnits) {
      if (dto.units === undefined || dto.navPerUnit === undefined) {
        throw new BadRequestException(
          "Jumlah unit dan NAB per unit harus diisi bersamaan",
        );
      }
      if (dto.reportedValue !== undefined) {
        throw new BadRequestException(
          "Isi nilai yang dilaporkan ATAU unit × NAB, tidak keduanya (menghindari nilai ganda)",
        );
      }
      if (policy.policyType !== "unit_link") {
        throw new BadRequestException(
          "Unit dan NAB hanya untuk polis Unit Link",
        );
      }
      if (!dto.fundId) {
        throw new BadRequestException("Unit × NAB memerlukan subdana (fundId)");
      }
    }
    if (dto.fundId) {
      const fund = await this.prisma.insuranceFund.findFirst({
        where: { id: dto.fundId, insuranceId },
        select: { id: true },
      });
      if (!fund)
        throw new BadRequestException("fundId bukan subdana polis ini");
    }
    if (dto.documentId) {
      const doc = await this.prisma.insuranceDocument.findFirst({
        where: { id: dto.documentId, insuranceId },
        select: { id: true },
      });
      if (!doc) {
        throw new BadRequestException("documentId bukan dokumen polis ini");
      }
    }
  }
}

function fundDto(row: {
  id: string;
  insuranceId: string;
  code: string | null;
  name: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}): InsuranceFundDto {
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    code: row.code,
    name: row.name,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
