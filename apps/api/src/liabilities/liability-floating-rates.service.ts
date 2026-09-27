import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  runSerializableWithRetry,
  type TxClient,
} from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { effectivePeriodFor } from "./amortisation.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LiabilitiesService } from "./liabilities.service";
import {
  EMPTY_RATE_PLAN_ROWS,
  loadRatePlanRows,
  ratePlanFromRows,
  type FloatingRateRow,
  type RatePlanRows,
} from "./rate-plan.rows";
import { hasFloatingSegment, legacyRatePlan } from "./rate-plan.util";
import { assertKprRate } from "./rate-plan.validation";

import type { CreateFloatingRateDto } from "./dto/create-floating-rate.dto";
import type { LiabilityFloatingRateResponseDto } from "./dto/liability-response.dto";

type LiabilityRecord = NonNullable<
  Awaited<ReturnType<TxClient["liability"]["findUnique"]>>
>;

const DUPLICATE_DATE_MESSAGE =
  "Sudah ada perubahan bunga pada tanggal ini — hapus dulu yang lama";

function toDto(
  row: FloatingRateRow,
  startDate: Date | null,
): LiabilityFloatingRateResponseDto {
  return {
    id: row.id,
    effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
    ratePercent: row.ratePercent.toString(),
    effectivePeriod: startDate
      ? effectivePeriodFor(startDate, row.effectiveDate)
      : null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function assertFloatingRateAllowed(
  liability: LiabilityRecord,
  rows: RatePlanRows,
  effectiveDate: Date,
): void {
  const start = liability.startDate;
  if (start === null) {
    throw new BadRequestException(
      "Isi tanggal akad sebelum mencatat bunga floating",
    );
  }
  const plan =
    ratePlanFromRows(rows, liability) ??
    legacyRatePlan(
      liability.interestRate.toString(),
      liability.fixedRateMonths,
      liability.floatingRate?.toString() ?? null,
    );
  if (liability.interestMethod !== "anuitas" || !hasFloatingSegment(plan)) {
    throw new BadRequestException(
      "Liabilitas ini tidak punya periode bunga floating",
    );
  }
  const akadDay = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  if (effectiveDate.getTime() < akadDay) {
    throw new BadRequestException(
      "Tanggal efektif tidak boleh sebelum tanggal akad",
    );
  }
  if (
    liability.tenorMonths !== null &&
    effectivePeriodFor(start, effectiveDate) > liability.tenorMonths
  ) {
    throw new BadRequestException(
      "Tanggal efektif melewati cicilan terakhir — tidak memengaruhi cicilan mana pun",
    );
  }
}

@Injectable()
export class LiabilityFloatingRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liabilities: LiabilitiesService,
  ) {}

  async list(
    familyGroupId: string,
    liabilityId: string,
  ): Promise<LiabilityFloatingRateResponseDto[]> {
    const liability = await this.findLiability(
      this.prisma,
      familyGroupId,
      liabilityId,
    );
    const rows = await this.rowsFor(this.prisma, familyGroupId, liabilityId);
    return rows.floatingRates.map((row) => toDto(row, liability.startDate));
  }

  async add(
    familyGroupId: string,
    liabilityId: string,
    dto: CreateFloatingRateDto,
    userId: string | null,
    now: Date = new Date(),
  ): Promise<LiabilityFloatingRateResponseDto> {
    assertKprRate(dto.ratePercent, "ratePercent");
    const effectiveDate = new Date(`${dto.effectiveDate}T00:00:00.000Z`);
    try {
      return await runSerializableWithRetry(this.prisma, async (tx) => {
        const liability = await this.findLiability(
          tx,
          familyGroupId,
          liabilityId,
        );
        const rows = await this.rowsFor(tx, familyGroupId, liabilityId);
        assertFloatingRateAllowed(liability, rows, effectiveDate);
        if (
          rows.floatingRates.some(
            (row) => row.effectiveDate.getTime() === effectiveDate.getTime(),
          )
        ) {
          throw new ConflictException(DUPLICATE_DATE_MESSAGE);
        }
        const created = await tx.liabilityFloatingRate.create({
          data: {
            familyGroupId,
            liabilityId,
            effectiveDate,
            ratePercent: dto.ratePercent,
            note: dto.note ?? null,
            createdByUserId: userId,
          },
        });
        await this.liabilities.resyncBudgetLine(
          tx,
          familyGroupId,
          {
            ...liability,
            ratePlanRows: {
              ...rows,
              floatingRates: [...rows.floatingRates, created],
            },
          },
          now,
        );
        return toDto(created, liability.startDate);
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(DUPLICATE_DATE_MESSAGE);
      }
      throw err;
    }
  }

  async remove(
    familyGroupId: string,
    liabilityId: string,
    rateId: string,
    now: Date = new Date(),
  ): Promise<void> {
    await runSerializableWithRetry(this.prisma, async (tx) => {
      const liability = await this.findLiability(
        tx,
        familyGroupId,
        liabilityId,
      );
      const rows = await this.rowsFor(tx, familyGroupId, liabilityId);
      if (!rows.floatingRates.some((row) => row.id === rateId)) {
        throw new NotFoundException("Floating rate not found");
      }
      await tx.liabilityFloatingRate.deleteMany({
        where: { id: rateId, liabilityId, familyGroupId },
      });
      await this.liabilities.resyncBudgetLine(
        tx,
        familyGroupId,
        {
          ...liability,
          ratePlanRows: {
            ...rows,
            floatingRates: rows.floatingRates.filter(
              (row) => row.id !== rateId,
            ),
          },
        },
        now,
      );
    });
  }

  private async findLiability(
    client: Pick<TxClient, "liability">,
    familyGroupId: string,
    liabilityId: string,
  ): Promise<LiabilityRecord> {
    const liability = await client.liability.findUnique({
      where: { id: liabilityId, familyGroupId },
    });
    if (!liability) throw new NotFoundException("Liability not found");
    return liability;
  }

  private async rowsFor(
    client: Pick<TxClient, "liabilityRatePeriod" | "liabilityFloatingRate">,
    familyGroupId: string,
    liabilityId: string,
  ): Promise<RatePlanRows> {
    const rows = await loadRatePlanRows(client, familyGroupId, [liabilityId]);
    return rows.get(liabilityId) ?? EMPTY_RATE_PLAN_ROWS;
  }
}
