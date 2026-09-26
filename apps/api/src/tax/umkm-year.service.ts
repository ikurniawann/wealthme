import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
import { parseDigits } from "../tax-engine/money";
import { umkmYear } from "../tax-engine/umkm.engine";

import { toUmkmResultDto } from "./tax-dto-mappers";

import type { UmkmYearPutDto } from "./dto/tax-preview.dto";
import type { UmkmResultDto } from "@wealthme/contracts";

@Injectable()
export class UmkmYearService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    familyGroupId: string,
    taxYear: number,
  ): Promise<UmkmResultDto | null> {
    const row = await this.prisma.taxUmkmYear.findUnique({
      where: { familyGroupId_taxYear: { familyGroupId, taxYear } },
    });
    if (!row) return null;
    return toUmkmResultDto(
      umkmYear({
        taxYear,
        monthlyOmzet: row.omzetByMonth,
        firstRegisteredYear: row.firstRegisteredYear,
      }),
      taxYear,
      row.firstRegisteredYear,
      true,
    );
  }

  async put(
    familyGroupId: string,
    taxYear: number,
    dto: UmkmYearPutDto,
  ): Promise<UmkmResultDto> {
    const omzet = dto.monthlyOmzet.map(parseDigits);
    const first = dto.firstRegisteredYear ?? null;
    const result = umkmYear({
      taxYear,
      monthlyOmzet: omzet,
      firstRegisteredYear: first,
    });
    await this.prisma.taxUmkmYear.upsert({
      where: { familyGroupId_taxYear: { familyGroupId, taxYear } },
      create: {
        familyGroupId,
        taxYear,
        omzetByMonth: omzet,
        firstRegisteredYear: first,
      },
      update: { omzetByMonth: omzet, firstRegisteredYear: first },
    });
    return toUmkmResultDto(result, taxYear, first, true);
  }
}
