import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DonationType } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateDonationDto } from "./dto/create-donation.dto";
import type { DonationResponseDto } from "./dto/donation-response.dto";
import type { UpdateDonationDto } from "./dto/update-donation.dto";

type DonationRow = {
  id: string;
  familyGroupId: string;
  type: string;
  recipient: string;
  amount: bigint;
  currency: string;
  donatedAt: Date;
  isTaxDeductible: boolean;
  accountId: string | null;
  transactionId: string | null;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const DONATION_TYPE_LABEL: Record<string, string> = {
  zakat_maal: "Zakat Maal",
  zakat_fitrah: "Zakat Fitrah",
  infaq: "Infaq",
  sedekah: "Sedekah",
  wakaf: "Wakaf",
  // EPIC-023 F2 (D20, US-DON-6/7) — the obligatory Christian contribution.
  persepuluhan: "Persembahan Persepuluhan",
  lainnya: "Donasi",
};

/**
 * EPIC-022 Group E (E5) / EPIC-023 F2 (D20, US-DON-6/7) — PP 60/2010 makes
 * "zakat atau sumbangan keagamaan yang sifatnya wajib" tax-deductible for
 * adherents of a recognised religion — NOT just zakat. `zakat_maal`/
 * `zakat_fitrah` (paid to an approved amil, BAZNAS/LAZ) covers the Muslim
 * obligation; `persepuluhan` (paid to a recognised church body) covers the
 * equivalent Christian one. EPIC-022 E5 originally read PP 60/2010 as
 * zakat-only, which incorrectly excluded Christian users — this widens the
 * set to the law's actual "obligatory" scope while still excluding
 * `infaq`/`sedekah`/`wakaf`/`lainnya`: those are voluntary giving, not an
 * obligation, and must never feed `TaxService`'s deductible total. This is
 * a type check, not an institution registry: the UI still asks for the
 * recipient institution, but the server never trusts `isTaxDeductible` on a
 * type that cannot legally carry it.
 */
const TAX_DEDUCTIBLE_DONATION_TYPES: ReadonlySet<DonationType> = new Set([
  DonationType.zakat_maal,
  DonationType.zakat_fitrah,
  DonationType.persepuluhan,
]);

function assertDeductibleTypeAllowed(
  type: DonationType,
  isTaxDeductible: boolean,
): void {
  if (isTaxDeductible && !TAX_DEDUCTIBLE_DONATION_TYPES.has(type)) {
    throw new BadRequestException(
      "Hanya Zakat Maal / Zakat Fitrah / Persembahan Persepuluhan yang dapat ditandai sebagai pengurang pajak.",
    );
  }
}

function toDonationDto(row: DonationRow): DonationResponseDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    type: row.type,
    recipient: row.recipient,
    amount: row.amount.toString(),
    currency: row.currency,
    donatedAt: row.donatedAt.toISOString(),
    isTaxDeductible: row.isTaxDeductible,
    accountId: row.accountId,
    transactionId: row.transactionId,
    receiptUrl: row.receiptUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    familyGroupId: string,
    year?: number,
  ): Promise<DonationResponseDto[]> {
    const where: Record<string, unknown> = { familyGroupId };
    if (year !== undefined) {
      where["donatedAt"] = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      };
    }
    const rows = await this.prisma.donation.findMany({
      where,
      orderBy: { donatedAt: "desc" },
    });
    return rows.map(toDonationDto);
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<DonationResponseDto> {
    const row = await this.prisma.donation.findUnique({
      where: { id, familyGroupId },
    });
    if (!row) throw new NotFoundException("Donation not found");
    return toDonationDto(row);
  }

  async create(
    familyGroupId: string,
    dto: CreateDonationDto,
  ): Promise<DonationResponseDto> {
    assertDeductibleTypeAllowed(dto.type, dto.isTaxDeductible ?? false);
    const amount = BigInt(dto.amount);
    const donatedAt = new Date(dto.donatedAt);

    // Without a source account, a donation is a record only — it never
    // touches Account.balance, so it silently never affects net worth
    // (which is just the sum of account balances). Linking an account here
    // creates a real expense transaction the same way every other money-out
    // action in the app does, so it flows through net worth/cashflow/reports
    // automatically with no separate calculation needed.
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.accountId) {
        const account = await tx.account.findUnique({
          where: { id: dto.accountId, familyGroupId },
        });
        if (!account) {
          throw new NotFoundException("Account not found");
        }

        const transaction = await tx.transaction.create({
          data: {
            familyGroupId,
            accountId: dto.accountId,
            amount,
            type: "expense",
            description: `${DONATION_TYPE_LABEL[dto.type] ?? "Donasi"}: ${dto.recipient}`,
            occurredAt: donatedAt,
          },
        });
        await tx.account.update({
          where: { id: dto.accountId },
          data: { balance: { decrement: amount } },
        });

        return tx.donation.create({
          data: {
            familyGroupId,
            type: dto.type,
            recipient: dto.recipient,
            amount,
            currency: dto.currency ?? "IDR",
            donatedAt,
            isTaxDeductible: dto.isTaxDeductible ?? false,
            accountId: dto.accountId,
            transactionId: transaction.id,
            receiptUrl: dto.receiptUrl ?? null,
            notes: dto.notes ?? null,
          },
        });
      }

      return tx.donation.create({
        data: {
          familyGroupId,
          type: dto.type,
          recipient: dto.recipient,
          amount,
          currency: dto.currency ?? "IDR",
          donatedAt,
          isTaxDeductible: dto.isTaxDeductible ?? false,
          receiptUrl: dto.receiptUrl ?? null,
          notes: dto.notes ?? null,
        },
      });
    });

    return toDonationDto(row);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateDonationDto,
  ): Promise<DonationResponseDto> {
    const existing = await this.prisma.donation.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Donation not found");

    const type = dto.type ?? existing.type;
    const recipient = dto.recipient ?? existing.recipient;
    const amount =
      dto.amount !== undefined ? BigInt(dto.amount) : existing.amount;
    const donatedAt =
      dto.donatedAt !== undefined
        ? new Date(dto.donatedAt)
        : existing.donatedAt;
    const isTaxDeductible =
      dto.isTaxDeductible !== undefined
        ? dto.isTaxDeductible
        : existing.isTaxDeductible;
    assertDeductibleTypeAllowed(type, isTaxDeductible);

    const row = await this.prisma.$transaction(async (tx) => {
      if (existing.accountId && existing.transactionId) {
        // The linked expense is the source of truth for account balance and
        // cashflow. Keep all three records consistent in the same transaction.
        await tx.account.update({
          where: { id: existing.accountId, familyGroupId },
          data: { balance: { increment: existing.amount - amount } },
        });
        await tx.transaction.update({
          where: { id: existing.transactionId, familyGroupId },
          data: {
            amount,
            description: `${DONATION_TYPE_LABEL[type] ?? "Donasi"}: ${recipient}`,
            occurredAt: donatedAt,
          },
        });
      }

      return tx.donation.update({
        where: { id, familyGroupId },
        data: {
          type,
          recipient,
          amount,
          currency: dto.currency ?? existing.currency,
          donatedAt,
          isTaxDeductible,
          receiptUrl:
            dto.receiptUrl !== undefined
              ? (dto.receiptUrl ?? null)
              : existing.receiptUrl,
          notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
        },
      });
    });
    return toDonationDto(row);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.donation.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Donation not found");

    await this.prisma.$transaction(async (tx) => {
      if (existing.accountId && existing.transactionId) {
        await tx.account.update({
          where: { id: existing.accountId, familyGroupId },
          data: { balance: { increment: existing.amount } },
        });
        await tx.transaction.deleteMany({
          where: { id: existing.transactionId, familyGroupId },
        });
      }
      await tx.donation.delete({ where: { id, familyGroupId } });
    });
  }

  async getTotalDeductibleAmount(
    familyGroupId: string,
    year: number,
  ): Promise<bigint> {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    const result = await this.prisma.donation.aggregate({
      where: {
        familyGroupId,
        isTaxDeductible: true,
        // EPIC-022 Group E (E5) — defense in depth: `assertDeductibleTypeAllowed`
        // blocks new writes, but a row written before that guard existed (the
        // checkbox used to be selectable for any donation type) would keep
        // understating tax on every read forever without this filter. The read
        // path must never trust `isTaxDeductible` alone, regardless of how it
        // got set — a one-off migration also corrects existing rows, but this
        // filter is what makes the read path safe even if that ever regresses.
        type: { in: Array.from(TAX_DEDUCTIBLE_DONATION_TYPES) },
        donatedAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? BigInt(0);
  }
}
