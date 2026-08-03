import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { type AllowanceRequestStatus } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "../transactions/transactions.service";

import type { AllowanceRequestResponseDto } from "./dto/allowance-request-response.dto";
import type { ApproveAllowanceRequestDto } from "./dto/approve-allowance-request.dto";
import type { CreateAllowanceRequestDto } from "./dto/create-allowance-request.dto";
import type { RejectAllowanceRequestDto } from "./dto/reject-allowance-request.dto";

const ALLOWANCE_REQUEST_INCLUDE = {
  requester: { select: { name: true } },
  targetAccount: { select: { name: true } },
  fromAccount: { select: { name: true } },
  decidedByUser: { select: { name: true } },
} as const;

type AllowanceRequestRow = {
  id: string;
  familyGroupId: string;
  requesterUserId: string;
  targetAccountId: string;
  fromAccountId: string | null;
  amount: bigint;
  note: string | null;
  status: AllowanceRequestStatus;
  createdAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  requester?: { name: string };
  targetAccount?: { name: string };
  fromAccount?: { name: string } | null;
  decidedByUser?: { name: string } | null;
};

// EPIC-019 Task B — member-request -> owner-approve funding. Approval
// executes a REAL transfer by delegating to TransactionsService (the
// existing EPIC-021 Group B primitive), so the balance move stays atomic and
// consistent with every other transfer in the app instead of a duplicated
// implementation here.
@Injectable()
export class AllowanceRequestsService {
  private readonly logger = new Logger(AllowanceRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(
    familyGroupId: string,
    requesterUserId: string,
    dto: CreateAllowanceRequestDto,
  ): Promise<AllowanceRequestResponseDto> {
    const targetAccount = await this.prisma.account.findUnique({
      where: { id: dto.targetAccountId, familyGroupId },
    });
    if (!targetAccount) {
      throw new NotFoundException(`Account ${dto.targetAccountId} not found`);
    }
    if (targetAccount.ownerUserId !== requesterUserId) {
      throw new ForbiddenException(
        "You may only request funding for an account you own",
      );
    }

    const created = await this.prisma.allowanceRequest.create({
      data: {
        familyGroupId,
        requesterUserId,
        targetAccountId: dto.targetAccountId,
        amount: BigInt(dto.amount),
        note: dto.note ?? null,
      },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });

    void this.notifyOwnersOfNewRequest(familyGroupId, created);

    return this.toDto(created);
  }

  /**
   * Row-level scoping happens HERE, not just via CASL: an owner/admin_staff
   * sees every request in the family group; a plain `member` only ever sees
   * their OWN requests, regardless of what the client asks for.
   */
  async findAll(
    familyGroupId: string,
    requesterUserId: string,
    canSeeAll: boolean,
  ): Promise<AllowanceRequestResponseDto[]> {
    const rows = await this.prisma.allowanceRequest.findMany({
      where: {
        familyGroupId,
        ...(canSeeAll ? {} : { requesterUserId }),
      },
      orderBy: { createdAt: "desc" },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });

    // Pending first (stable sort preserves the createdAt desc order within
    // each status group) — Prisma can't express "pending first" via orderBy
    // on an enum without raw SQL.
    const sorted = [...rows].sort((a, b) => {
      const aPending = a.status === "pending" ? 0 : 1;
      const bPending = b.status === "pending" ? 0 : 1;
      return aPending - bPending;
    });

    return sorted.map((row) => this.toDto(row));
  }

  async approve(
    familyGroupId: string,
    id: string,
    ownerUserId: string,
    dto: ApproveAllowanceRequestDto,
  ): Promise<AllowanceRequestResponseDto> {
    const request = await this.assertPending(familyGroupId, id);

    if (dto.fromAccountId === request.targetAccountId) {
      throw new BadRequestException(
        "Source and destination account must differ",
      );
    }
    const fromAccount = await this.prisma.account.findUnique({
      where: { id: dto.fromAccountId, familyGroupId },
    });
    if (!fromAccount) {
      throw new NotFoundException(`Account ${dto.fromAccountId} not found`);
    }

    // Reuses the EPIC-021 Group B transfer primitive — same atomic
    // debit-source/credit-destination path every other transfer takes.
    // BigInt -> Number: transaction amounts are IDR minor units, always well
    // within Number.MAX_SAFE_INTEGER in practice (matches the existing
    // BigInt -> Number conversions elsewhere in this service layer).
    await this.transactionsService.create(familyGroupId, {
      accountId: dto.fromAccountId,
      toAccountId: request.targetAccountId,
      amount: Number(request.amount),
      type: "transfer",
      description: request.note
        ? `Alokasi dana keluarga — ${request.note}`
        : "Alokasi dana keluarga",
      occurredAt: new Date().toISOString(),
    });

    const updated = await this.prisma.allowanceRequest.update({
      where: { id },
      data: {
        status: "approved",
        fromAccountId: dto.fromAccountId,
        decidedAt: new Date(),
        decidedByUserId: ownerUserId,
      },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });

    void this.notifyRequesterOfDecision(familyGroupId, updated, true);

    return this.toDto(updated);
  }

  async reject(
    familyGroupId: string,
    id: string,
    ownerUserId: string,
    dto: RejectAllowanceRequestDto,
  ): Promise<AllowanceRequestResponseDto> {
    const request = await this.assertPending(familyGroupId, id);

    const updated = await this.prisma.allowanceRequest.update({
      where: { id },
      data: {
        status: "rejected",
        decidedAt: new Date(),
        decidedByUserId: ownerUserId,
        ...(dto.reason && {
          note: request.note
            ? `${request.note} — Ditolak: ${dto.reason}`
            : `Ditolak: ${dto.reason}`,
        }),
      },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });

    void this.notifyRequesterOfDecision(familyGroupId, updated, false);

    return this.toDto(updated);
  }

  private async assertPending(
    familyGroupId: string,
    id: string,
  ): Promise<AllowanceRequestRow> {
    const request = await this.prisma.allowanceRequest.findFirst({
      where: { id, familyGroupId },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });
    if (!request) throw new NotFoundException("Allowance request not found");
    if (request.status !== "pending") {
      throw new BadRequestException(
        "Only a pending allowance request can be decided",
      );
    }
    return request;
  }

  private async notifyOwnersOfNewRequest(
    familyGroupId: string,
    request: AllowanceRequestRow,
  ): Promise<void> {
    try {
      const requesterName = request.requester?.name ?? "Anggota keluarga";
      const targetName = request.targetAccount?.name ?? "akun";
      await this.prisma.notification.create({
        data: {
          familyGroupId,
          title: "Permintaan dana baru",
          body: `${requesterName} meminta Rp ${request.amount.toString()} untuk ${targetName}.`,
          icon: "🙏",
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Allowance request notification skipped: ${msg}`);
    }
  }

  private async notifyRequesterOfDecision(
    familyGroupId: string,
    request: AllowanceRequestRow,
    approved: boolean,
  ): Promise<void> {
    try {
      const targetName = request.targetAccount?.name ?? "akun";
      await this.prisma.notification.create({
        data: {
          familyGroupId,
          title: approved
            ? "Permintaan dana disetujui"
            : "Permintaan dana ditolak",
          body: approved
            ? `Permintaan dana Rp ${request.amount.toString()} untuk ${targetName} telah disetujui.`
            : `Permintaan dana Rp ${request.amount.toString()} untuk ${targetName} ditolak.`,
          icon: approved ? "✅" : "🚫",
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Allowance decision notification skipped: ${msg}`);
    }
  }

  private toDto(row: AllowanceRequestRow): AllowanceRequestResponseDto {
    return {
      id: row.id,
      familyGroupId: row.familyGroupId,
      requesterUserId: row.requesterUserId,
      requesterName: row.requester?.name ?? "",
      targetAccountId: row.targetAccountId,
      targetAccountName: row.targetAccount?.name ?? "",
      fromAccountId: row.fromAccountId,
      fromAccountName: row.fromAccount?.name ?? null,
      amount: row.amount.toString(),
      note: row.note,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      decidedByUserId: row.decidedByUserId,
      decidedByName: row.decidedByUser?.name ?? null,
    };
  }
}
