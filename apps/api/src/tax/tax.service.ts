import { Injectable, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DonationsService } from "../donations/donations.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
import { computeLegacyNetTax, computePphOp } from "../tax-engine/pph-op.engine";
import { wibDateString } from "../tax-rules/tax-rules.registry";

import { mapEngineError, toRuleRefDtos } from "./tax-dto-mappers";

import type { CreateTaxRecordDto } from "./dto/create-tax-record.dto";
import type { TaxRecordResponseDto } from "./dto/tax-record-response.dto";
import type { UpdateTaxRecordDto } from "./dto/update-tax-record.dto";
import type { MaritalStatus } from "../tax-engine/ptkp";
import type { TaxRuleRef } from "../tax-rules/tax-rule.types";
import type { SptStatus } from "@prisma/client";
import type { TaxRecordDto } from "@wealthme/contracts";

type CalcMode = "legacy" | "detailed";

type TaxRecordRow = {
  id: string;
  familyGroupId: string;
  taxYear: number;
  grossIncome: bigint;
  ptkp: bigint;
  zakatDeduction: bigint;
  netTax: bigint;
  sptStatus: SptStatus;
  documentUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  calcMode: CalcMode;
  maritalStatus: MaritalStatus | null;
  dependents: number | null;
  pensionContribution: bigint | null;
  freelanceGross: bigint | null;
  nppnRateBps: number | null;
  otherNetIncome: bigint | null;
  withheldPph21: bigint | null;
  sptFiledAt: Date | null;
};

export interface RecordInputs {
  taxYear: number;
  calcMode: CalcMode;
  grossIncome: bigint;
  ptkp: bigint;
  zakat: bigint;
  maritalStatus: MaritalStatus | null;
  dependents: number | null;
  pensionContribution: bigint | null;
  freelanceGross: bigint | null;
  nppnRateBps: number | null;
  otherNetIncome: bigint | null;
  withheldPph21: bigint | null;
}

/**
 * Compute annual PPh 21 from gross income, PTKP, and zakat deduction.
 * Amounts are IDR (BigInt in storage); safe in Number well past realistic
 * incomes (< 9e15).
 */
export function computeNetTax(
  grossIncome: bigint,
  ptkp: bigint,
  zakatDeduction: bigint,
  taxYear: number = Number(wibDateString(new Date()).slice(0, 4)),
): bigint {
  return computeLegacyNetTax(grossIncome, ptkp, zakatDeduction, taxYear);
}

function toTaxRecordDto(
  row: TaxRecordRow,
  rules: readonly TaxRuleRef[],
): TaxRecordResponseDto {
  const withheld = row.withheldPph21 ?? 0n;
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    taxYear: row.taxYear,
    grossIncome: row.grossIncome.toString(),
    ptkp: row.ptkp.toString(),
    zakatDeduction: row.zakatDeduction.toString(),
    netTax: row.netTax.toString(),
    sptStatus: row.sptStatus,
    documentUrl: row.documentUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    calcMode: row.calcMode,
    maritalStatus: row.maritalStatus,
    dependents: row.dependents,
    pensionContribution: row.pensionContribution?.toString() ?? null,
    freelanceGross: row.freelanceGross?.toString() ?? null,
    nppnRateBps: row.nppnRateBps,
    otherNetIncome: row.otherNetIncome?.toString() ?? null,
    withheldPph21: row.withheldPph21?.toString() ?? null,
    balance: (row.netTax - withheld).toString(),
    sptFiledAt: row.sptFiledAt?.toISOString() ?? null,
    rules: toRuleRefDtos(rules),
  };
}

/**
 * Stamp sptFiledAt when a write moves the row into sudah_lapor for the
 * first time; clear it as soon as the row moves away again. Otherwise the
 * stored value is kept.
 */
function resolveSptFiledAt(
  prevStatus: SptStatus | null,
  prevFiledAt: Date | null,
  nextStatus: SptStatus,
): Date | null {
  if (nextStatus !== "sudah_lapor") return null;
  return prevStatus === "sudah_lapor" ? prevFiledAt : new Date();
}

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly donationsService: DonationsService,
  ) {}

  /**
   * Legacy rows run the same formula as before (now through the BigInt
   * engine); detailed rows derive PTKP from maritalStatus/dependents and
   * include pension, freelance NPPN and other net income. A RangeError from
   * the engine (e.g. an out-of-range dependents count) becomes a 400.
   */
  computeRecord(r: RecordInputs): {
    netTax: bigint;
    ptkp: bigint;
    rules: TaxRuleRef[];
  } {
    try {
      if (r.calcMode === "legacy") {
        const result = computePphOp({
          taxYear: r.taxYear,
          status: null,
          ptkpOverride: r.ptkp,
          employmentGross: r.grossIncome,
          pensionContribution: 0n,
          freelance: null,
          otherNetIncome: 0n,
          zakat: r.zakat,
          withheldPph21: 0n,
        });
        return { netTax: result.tax, ptkp: r.ptkp, rules: result.rules };
      }

      const freelanceGross = r.freelanceGross ?? 0n;
      const result = computePphOp({
        taxYear: r.taxYear,
        status: {
          maritalStatus: r.maritalStatus!,
          dependents: r.dependents ?? 0,
        },
        employmentGross: r.grossIncome,
        pensionContribution: r.pensionContribution ?? 0n,
        freelance:
          freelanceGross > 0n
            ? { gross: freelanceGross, nppnBps: r.nppnRateBps ?? 0 }
            : null,
        otherNetIncome: r.otherNetIncome ?? 0n,
        zakat: r.zakat,
        withheldPph21: r.withheldPph21 ?? 0n,
      });
      return { netTax: result.tax, ptkp: result.ptkp, rules: result.rules };
    } catch (e) {
      return mapEngineError(e);
    }
  }

  /**
   * Recompute donation-driven fields at read time so records never show a
   * stale zakat deduction (donations may change after the record was saved).
   */
  private async withFreshDeduction(
    row: TaxRecordRow,
  ): Promise<{ row: TaxRecordRow; rules: TaxRuleRef[] }> {
    const zakatDeduction = await this.donationsService.getTotalDeductibleAmount(
      row.familyGroupId,
      row.taxYear,
    );
    const { netTax, ptkp, rules } = this.computeRecord({
      taxYear: row.taxYear,
      calcMode: row.calcMode,
      grossIncome: row.grossIncome,
      ptkp: row.ptkp,
      zakat: zakatDeduction,
      maritalStatus: row.maritalStatus,
      dependents: row.dependents,
      pensionContribution: row.pensionContribution,
      freelanceGross: row.freelanceGross,
      nppnRateBps: row.nppnRateBps,
      otherNetIncome: row.otherNetIncome,
      withheldPph21: row.withheldPph21,
    });
    return { row: { ...row, zakatDeduction, ptkp, netTax }, rules };
  }

  async findAll(familyGroupId: string): Promise<TaxRecordResponseDto[]> {
    const rows = await this.prisma.taxRecord.findMany({
      where: { familyGroupId },
      orderBy: { taxYear: "desc" },
    });
    return Promise.all(
      rows.map(async (row: TaxRecordRow) => {
        const fresh = await this.withFreshDeduction(row);
        return toTaxRecordDto(fresh.row, fresh.rules);
      }),
    );
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<TaxRecordResponseDto> {
    const row = await this.prisma.taxRecord.findUnique({
      where: { id, familyGroupId },
    });
    if (!row) throw new NotFoundException("Tax record not found");
    const fresh = await this.withFreshDeduction(row as TaxRecordRow);
    return toTaxRecordDto(fresh.row, fresh.rules);
  }

  /** Fresh-deduction DTO for a family's given tax year, or null if unset. */
  async findByYear(
    familyGroupId: string,
    taxYear: number,
  ): Promise<TaxRecordDto | null> {
    const row = await this.prisma.taxRecord.findUnique({
      where: { familyGroupId_taxYear: { familyGroupId, taxYear } },
    });
    if (!row) return null;
    const fresh = await this.withFreshDeduction(row as TaxRecordRow);
    // sptStatus is a Prisma enum at runtime; TaxRecordResponseDto widens it
    // to `string` for the REST DTO, so the contracts-typed boundary here
    // needs one cast back to the narrower union.
    return toTaxRecordDto(fresh.row, fresh.rules) as unknown as TaxRecordDto;
  }

  async upsertByYear(
    familyGroupId: string,
    dto: CreateTaxRecordDto,
  ): Promise<TaxRecordResponseDto> {
    const existing = (await this.prisma.taxRecord.findUnique({
      where: { familyGroupId_taxYear: { familyGroupId, taxYear: dto.taxYear } },
    })) as TaxRecordRow | null;

    // An explicit `maritalStatus: null` must NOT enable detailed mode — only
    // a real marital status does (opus review fix round 1, Important #1).
    const calcMode: CalcMode =
      dto.maritalStatus != null ? "detailed" : "legacy";
    const zakat = await this.donationsService.getTotalDeductibleAmount(
      familyGroupId,
      dto.taxYear,
    );
    const sptStatus = dto.sptStatus ?? existing?.sptStatus ?? "belum_lapor";
    const sptFiledAt = resolveSptFiledAt(
      existing?.sptStatus ?? null,
      existing?.sptFiledAt ?? null,
      sptStatus,
    );

    const inputs: RecordInputs = {
      taxYear: dto.taxYear,
      calcMode,
      grossIncome: BigInt(dto.grossIncome),
      ptkp: dto.ptkp !== undefined ? BigInt(dto.ptkp) : 0n,
      zakat,
      maritalStatus: dto.maritalStatus ?? null,
      dependents: dto.dependents ?? null,
      pensionContribution:
        dto.pensionContribution !== undefined
          ? BigInt(dto.pensionContribution)
          : null,
      freelanceGross:
        dto.freelanceGross !== undefined ? BigInt(dto.freelanceGross) : null,
      nppnRateBps: dto.nppnRateBps ?? null,
      otherNetIncome:
        dto.otherNetIncome !== undefined ? BigInt(dto.otherNetIncome) : null,
      withheldPph21:
        dto.withheldPph21 !== undefined ? BigInt(dto.withheldPph21) : null,
    };
    // netTax and, for detailed rows, ptkp are server-authoritative — any
    // client-sent netTax/ptkp value is ignored.
    const { netTax, ptkp, rules } = this.computeRecord(inputs);

    const shared = {
      grossIncome: inputs.grossIncome,
      ptkp,
      zakatDeduction: zakat,
      netTax,
      sptStatus,
      calcMode,
      maritalStatus: inputs.maritalStatus,
      dependents: inputs.dependents,
      pensionContribution: inputs.pensionContribution,
      freelanceGross: inputs.freelanceGross,
      nppnRateBps: inputs.nppnRateBps,
      otherNetIncome: inputs.otherNetIncome,
      withheldPph21: inputs.withheldPph21,
      sptFiledAt,
    };

    const row = await this.prisma.taxRecord.upsert({
      where: {
        familyGroupId_taxYear: { familyGroupId, taxYear: dto.taxYear },
      },
      create: {
        familyGroupId,
        taxYear: dto.taxYear,
        documentUrl: dto.documentUrl ?? null,
        notes: dto.notes ?? null,
        ...shared,
      },
      update: {
        documentUrl:
          dto.documentUrl !== undefined ? (dto.documentUrl ?? null) : undefined,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : undefined,
        ...shared,
      },
    });
    return toTaxRecordDto(row as TaxRecordRow, rules);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateTaxRecordDto,
  ): Promise<TaxRecordResponseDto> {
    const existing = (await this.prisma.taxRecord.findUnique({
      where: { id, familyGroupId },
    })) as TaxRecordRow | null;
    if (!existing) throw new NotFoundException("Tax record not found");

    const taxYear = dto.taxYear ?? existing.taxYear;
    const grossIncome =
      dto.grossIncome !== undefined
        ? BigInt(dto.grossIncome)
        : existing.grossIncome;
    // Same null-vs-undefined guard as upsertByYear: an explicit
    // `maritalStatus: null` PATCH keeps the row on its existing mode.
    const calcMode: CalcMode =
      dto.maritalStatus != null ? "detailed" : existing.calcMode;

    const maritalStatus =
      calcMode === "detailed"
        ? (dto.maritalStatus ?? existing.maritalStatus)
        : null;
    const dependents =
      calcMode === "detailed"
        ? dto.dependents !== undefined
          ? dto.dependents
          : existing.dependents
        : null;
    const pensionContribution =
      calcMode === "detailed"
        ? dto.pensionContribution !== undefined
          ? BigInt(dto.pensionContribution)
          : existing.pensionContribution
        : null;
    const freelanceGross =
      calcMode === "detailed"
        ? dto.freelanceGross !== undefined
          ? BigInt(dto.freelanceGross)
          : existing.freelanceGross
        : null;
    const nppnRateBps =
      calcMode === "detailed"
        ? dto.nppnRateBps !== undefined
          ? dto.nppnRateBps
          : existing.nppnRateBps
        : null;
    const otherNetIncome =
      calcMode === "detailed"
        ? dto.otherNetIncome !== undefined
          ? BigInt(dto.otherNetIncome)
          : existing.otherNetIncome
        : null;
    const withheldPph21 =
      calcMode === "detailed"
        ? dto.withheldPph21 !== undefined
          ? BigInt(dto.withheldPph21)
          : existing.withheldPph21
        : null;
    // ptkp is only meaningful for legacy rows here — computeRecord derives
    // and returns it for detailed rows, ignoring this value.
    const ptkpInput =
      calcMode === "legacy"
        ? dto.ptkp !== undefined
          ? BigInt(dto.ptkp)
          : existing.ptkp
        : 0n;

    const zakat = await this.donationsService.getTotalDeductibleAmount(
      familyGroupId,
      taxYear,
    );
    const sptStatus = dto.sptStatus ?? existing.sptStatus;
    const sptFiledAt = resolveSptFiledAt(
      existing.sptStatus,
      existing.sptFiledAt,
      sptStatus,
    );

    const { netTax, ptkp, rules } = this.computeRecord({
      taxYear,
      calcMode,
      grossIncome,
      ptkp: ptkpInput,
      zakat,
      maritalStatus,
      dependents,
      pensionContribution,
      freelanceGross,
      nppnRateBps,
      otherNetIncome,
      withheldPph21,
    });

    const row = await this.prisma.taxRecord.update({
      where: { id, familyGroupId },
      data: {
        taxYear,
        grossIncome,
        ptkp,
        zakatDeduction: zakat,
        // Server-authoritative — client-sent netTax is ignored.
        netTax,
        sptStatus,
        documentUrl:
          dto.documentUrl !== undefined
            ? (dto.documentUrl ?? null)
            : existing.documentUrl,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
        calcMode,
        maritalStatus,
        dependents,
        pensionContribution,
        freelanceGross,
        nppnRateBps,
        otherNetIncome,
        withheldPph21,
        sptFiledAt,
      },
    });
    return toTaxRecordDto(row as TaxRecordRow, rules);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.taxRecord.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Tax record not found");
    await this.prisma.taxRecord.delete({ where: { id, familyGroupId } });
  }
}
