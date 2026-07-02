import { Injectable, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DonationsService } from "../donations/donations.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateTaxRecordDto } from "./dto/create-tax-record.dto";
import type { TaxRecordResponseDto } from "./dto/tax-record-response.dto";
import type { UpdateTaxRecordDto } from "./dto/update-tax-record.dto";

type TaxRecordRow = {
  id: string;
  familyGroupId: string;
  taxYear: number;
  grossIncome: bigint;
  ptkp: bigint;
  zakatDeduction: bigint;
  netTax: bigint;
  sptStatus: string;
  documentUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// PPh 21 progressive brackets (UU HPP) — mirrors the /tax page calculator so
// server-computed netTax matches what the user sees while typing.
const PPH21_BRACKETS: Array<[number, number]> = [
  [60_000_000, 0.05],
  [190_000_000, 0.15],
  [250_000_000, 0.25],
  [4_500_000_000, 0.3],
  [Infinity, 0.35],
];
const BIAYA_JABATAN_RATE = 0.05;
const BIAYA_JABATAN_CAP = 6_000_000;

/**
 * Compute annual PPh 21 from gross income, PTKP, and zakat deduction.
 * Amounts are IDR (BigInt in storage); safe in Number well past realistic
 * incomes (< 9e15).
 */
export function computeNetTax(
  grossIncome: bigint,
  ptkp: bigint,
  zakatDeduction: bigint,
): bigint {
  const gross = Number(grossIncome);
  const jabatan = Math.min(gross * BIAYA_JABATAN_RATE, BIAYA_JABATAN_CAP);
  let pkp = Math.max(
    0,
    gross - jabatan - Number(ptkp) - Number(zakatDeduction),
  );
  pkp = Math.floor(pkp / 1000) * 1000;

  let tax = 0;
  let sisa = pkp;
  for (const [limit, rate] of PPH21_BRACKETS) {
    if (sisa <= 0) break;
    const slice = Math.min(sisa, limit);
    tax += slice * rate;
    sisa -= slice;
  }
  return BigInt(Math.round(tax));
}

function toTaxRecordDto(row: TaxRecordRow): TaxRecordResponseDto {
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
  };
}

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly donationsService: DonationsService,
  ) {}

  /**
   * Recompute donation-driven fields at read time so records never show a
   * stale zakat deduction (donations may change after the record was saved).
   */
  private async withFreshDeduction(row: TaxRecordRow): Promise<TaxRecordRow> {
    const zakatDeduction = await this.donationsService.getTotalDeductibleAmount(
      row.familyGroupId,
      row.taxYear,
    );
    return {
      ...row,
      zakatDeduction,
      netTax: computeNetTax(row.grossIncome, row.ptkp, zakatDeduction),
    };
  }

  async findAll(familyGroupId: string): Promise<TaxRecordResponseDto[]> {
    const rows = await this.prisma.taxRecord.findMany({
      where: { familyGroupId },
      orderBy: { taxYear: "desc" },
    });
    return Promise.all(
      rows.map(async (row) =>
        toTaxRecordDto(await this.withFreshDeduction(row)),
      ),
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
    return toTaxRecordDto(await this.withFreshDeduction(row));
  }

  async upsertByYear(
    familyGroupId: string,
    dto: CreateTaxRecordDto,
  ): Promise<TaxRecordResponseDto> {
    const zakatDeduction = await this.donationsService.getTotalDeductibleAmount(
      familyGroupId,
      dto.taxYear,
    );

    // netTax is authoritative server-side — client-sent values are ignored.
    const netTax = computeNetTax(
      BigInt(dto.grossIncome),
      BigInt(dto.ptkp),
      zakatDeduction,
    );

    const row = await this.prisma.taxRecord.upsert({
      where: { familyGroupId_taxYear: { familyGroupId, taxYear: dto.taxYear } },
      create: {
        familyGroupId,
        taxYear: dto.taxYear,
        grossIncome: BigInt(dto.grossIncome),
        ptkp: BigInt(dto.ptkp),
        zakatDeduction,
        netTax,
        sptStatus: dto.sptStatus ?? "belum_lapor",
        documentUrl: dto.documentUrl ?? null,
        notes: dto.notes ?? null,
      },
      update: {
        grossIncome: BigInt(dto.grossIncome),
        ptkp: BigInt(dto.ptkp),
        zakatDeduction,
        netTax,
        sptStatus: dto.sptStatus,
        documentUrl:
          dto.documentUrl !== undefined ? (dto.documentUrl ?? null) : undefined,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : undefined,
      },
    });
    return toTaxRecordDto(row);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateTaxRecordDto,
  ): Promise<TaxRecordResponseDto> {
    const existing = await this.prisma.taxRecord.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Tax record not found");

    const taxYear = dto.taxYear ?? existing.taxYear;
    const grossIncome =
      dto.grossIncome !== undefined
        ? BigInt(dto.grossIncome)
        : existing.grossIncome;
    const ptkp = dto.ptkp !== undefined ? BigInt(dto.ptkp) : existing.ptkp;
    const zakatDeduction = await this.donationsService.getTotalDeductibleAmount(
      familyGroupId,
      taxYear,
    );

    const row = await this.prisma.taxRecord.update({
      where: { id, familyGroupId },
      data: {
        taxYear,
        grossIncome,
        ptkp,
        zakatDeduction,
        // Server-authoritative — client-sent netTax is ignored.
        netTax: computeNetTax(grossIncome, ptkp, zakatDeduction),
        sptStatus: dto.sptStatus ?? existing.sptStatus,
        documentUrl:
          dto.documentUrl !== undefined
            ? (dto.documentUrl ?? null)
            : existing.documentUrl,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
      },
    });
    return toTaxRecordDto(row);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.taxRecord.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Tax record not found");
    await this.prisma.taxRecord.delete({ where: { id, familyGroupId } });
  }
}
