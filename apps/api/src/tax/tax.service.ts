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

  async findAll(familyGroupId: string): Promise<TaxRecordResponseDto[]> {
    const rows = await this.prisma.taxRecord.findMany({
      where: { familyGroupId },
      orderBy: { taxYear: "desc" },
    });
    return rows.map(toTaxRecordDto);
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<TaxRecordResponseDto> {
    const row = await this.prisma.taxRecord.findUnique({
      where: { id, familyGroupId },
    });
    if (!row) throw new NotFoundException("Tax record not found");
    return toTaxRecordDto(row);
  }

  async upsertByYear(
    familyGroupId: string,
    dto: CreateTaxRecordDto,
  ): Promise<TaxRecordResponseDto> {
    const zakatDeduction = await this.donationsService.getTotalDeductibleAmount(
      familyGroupId,
      dto.taxYear,
    );

    const row = await this.prisma.taxRecord.upsert({
      where: { familyGroupId_taxYear: { familyGroupId, taxYear: dto.taxYear } },
      create: {
        familyGroupId,
        taxYear: dto.taxYear,
        grossIncome: BigInt(dto.grossIncome),
        ptkp: BigInt(dto.ptkp),
        zakatDeduction,
        netTax: dto.netTax !== undefined ? BigInt(dto.netTax) : BigInt(0),
        sptStatus: dto.sptStatus ?? "belum_lapor",
        documentUrl: dto.documentUrl ?? null,
        notes: dto.notes ?? null,
      },
      update: {
        grossIncome: BigInt(dto.grossIncome),
        ptkp: BigInt(dto.ptkp),
        zakatDeduction,
        netTax: dto.netTax !== undefined ? BigInt(dto.netTax) : undefined,
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

    const row = await this.prisma.taxRecord.update({
      where: { id, familyGroupId },
      data: {
        taxYear: dto.taxYear ?? existing.taxYear,
        grossIncome:
          dto.grossIncome !== undefined
            ? BigInt(dto.grossIncome)
            : existing.grossIncome,
        ptkp: dto.ptkp !== undefined ? BigInt(dto.ptkp) : existing.ptkp,
        netTax: dto.netTax !== undefined ? BigInt(dto.netTax) : existing.netTax,
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
