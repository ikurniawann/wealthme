import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  type AllowanceRequestKind,
  type AllowanceRequestStatus,
} from "@prisma/client";

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
  category: { select: { name: true } },
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
  // EPIC-023 Task D (D3/D9) — `funding` (default, every pre-existing row)
  // approves into a transfer; `held_expense` approves by replaying the
  // originally-attempted expense. `categoryId`/`description` are populated
  // only for `held_expense` (they carry the deferred expense's category and
  // memo); for `held_expense`, `targetAccountId` is the account the expense
  // DEBITS. See schema.prisma's AllowanceRequest comment.
  kind: AllowanceRequestKind;
  categoryId: string | null;
  description: string | null;
  status: AllowanceRequestStatus;
  createdAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  requester?: { name: string };
  targetAccount?: { name: string };
  fromAccount?: { name: string } | null;
  category?: { name: string } | null;
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

    // EPIC-033 R5 — a member asks for money FROM a family-shared account
    // they can see (never a private one, never another member's), INTO
    // their own account above. The approver still owns the final source
    // choice in approve().
    if (dto.fromAccountId) {
      if (dto.fromAccountId === dto.targetAccountId) {
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
      if (fromAccount.ownerUserId !== null || fromAccount.isPrivate) {
        throw new ForbiddenException(
          "You may only request funding from a family-shared account",
        );
      }
    }

    const created = await this.prisma.allowanceRequest.create({
      data: {
        familyGroupId,
        requesterUserId,
        targetAccountId: dto.targetAccountId,
        fromAccountId: dto.fromAccountId ?? null,
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

  /**
   * SECURITY (TOCTOU) — approve() must never execute two real transfers for
   * the same request. A plain read-then-write (findFirst status check,
   * followed by a separate update) has a race window: two concurrent
   * approvals (or an approve racing a reject) can both pass the read check
   * before either writes, then both proceed to move money.
   *
   * Fix: claim-then-transfer. `updateMany({ where: { status: "pending" } })`
   * is a single atomic SQL statement — Postgres serializes concurrent UPDATEs
   * on the same row, so at most ONE caller's claim can match `count === 1`.
   * Every other concurrent caller (whether racing approve or reject) gets
   * `count === 0` and a 409 immediately, BEFORE any transfer is attempted.
   *
   * `transactionsService.create` cannot be run inside this same
   * `$transaction` (it opens its own internal `$transaction` and does not
   * accept an injected client), so the claim and the transfer are two
   * separate statements. If the transfer throws after the claim succeeded,
   * the claim is compensated back to "pending" so the request is not left
   * permanently "approved" with no underlying money movement — the owner
   * (or another owner) can then retry the approval.
   */
  async approve(
    familyGroupId: string,
    id: string,
    ownerUserId: string,
    dto: ApproveAllowanceRequestDto,
  ): Promise<AllowanceRequestResponseDto> {
    const request = await this.findOrThrow(familyGroupId, id);

    // EPIC-023 Task D (D3/D9) — a held_expense approves by REPLAYING the
    // deferred expense, never a transfer; it carries its own account and
    // needs no owner-chosen source, so it takes a separate path.
    if (request.kind === "held_expense") {
      return this.approveHeldExpense(familyGroupId, id, ownerUserId, request);
    }

    // funding path (EPIC-019 Task B, unchanged behaviour). `fromAccountId`
    // is now optional on the DTO (a held_expense never supplies one), so a
    // funding approval must explicitly require it here.
    // EPIC-033 R5 — default to the source the member asked for; the
    // approver may still pick a different one.
    const fromAccountId = dto.fromAccountId ?? request.fromAccountId;
    if (!fromAccountId) {
      throw new BadRequestException(
        "fromAccountId is required to approve a funding request",
      );
    }
    if (fromAccountId === request.targetAccountId) {
      throw new BadRequestException(
        "Source and destination account must differ",
      );
    }
    const fromAccount = await this.prisma.account.findUnique({
      where: { id: fromAccountId, familyGroupId },
    });
    if (!fromAccount) {
      throw new NotFoundException(`Account ${fromAccountId} not found`);
    }

    const claim = await this.prisma.allowanceRequest.updateMany({
      where: { id, familyGroupId, status: "pending" },
      data: {
        status: "approved",
        fromAccountId: fromAccountId,
        decidedAt: new Date(),
        decidedByUserId: ownerUserId,
      },
    });
    if (claim.count !== 1) {
      throw new ConflictException(
        "This allowance request has already been decided",
      );
    }

    try {
      // Reuses the EPIC-021 Group B transfer primitive — same atomic
      // debit-source/credit-destination path every other transfer takes.
      // BigInt -> Number: transaction amounts are IDR minor units, always
      // well within Number.MAX_SAFE_INTEGER in practice (matches the
      // existing BigInt -> Number conversions elsewhere in this service).
      await this.transactionsService.create(familyGroupId, {
        accountId: fromAccountId,
        toAccountId: request.targetAccountId,
        amount: Number(request.amount),
        type: "transfer",
        description: request.note
          ? `Alokasi dana keluarga — ${request.note}`
          : "Alokasi dana keluarga",
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      // Compensate: the claim already flipped this row to "approved" but no
      // money actually moved — revert to "pending" so it is not stuck in a
      // false "approved" state and can be retried.
      await this.prisma.allowanceRequest.update({
        where: { id },
        data: {
          status: "pending",
          fromAccountId: null,
          decidedAt: null,
          decidedByUserId: null,
        },
      });
      throw err;
    }

    const updated = await this.prisma.allowanceRequest.findUniqueOrThrow({
      where: { id },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });

    void this.notifyRequesterOfDecision(familyGroupId, updated, true);

    return this.toDto(updated);
  }

  /**
   * EPIC-023 Task D (D3/D9, US-FAM-14) — approve a HELD EXPENSE. The
   * row-scoped member already attempted this expense; it was held (no money
   * moved) because it exceeded their per-member threshold. Approving replays
   * the ORIGINAL expense now — a real debit on the account the expense
   * targeted, for the captured amount/category/description — the first and
   * only time the balance moves.
   *
   * Same claim-then-execute/compensate-on-failure guard as the funding
   * approve() above, so a double-approve can never post twice. The replay
   * calls TransactionsService.create with `actingMember: null` so the
   * per-member hold gate (which only fires for a row-scoped actingMember)
   * cannot re-hold this into a second AllowanceRequest.
   */
  private async approveHeldExpense(
    familyGroupId: string,
    id: string,
    ownerUserId: string,
    request: AllowanceRequestRow,
  ): Promise<AllowanceRequestResponseDto> {
    const claim = await this.prisma.allowanceRequest.updateMany({
      where: { id, familyGroupId, status: "pending" },
      data: {
        status: "approved",
        decidedAt: new Date(),
        decidedByUserId: ownerUserId,
      },
    });
    if (claim.count !== 1) {
      throw new ConflictException(
        "This allowance request has already been decided",
      );
    }

    try {
      // Replay the deferred expense — a real debit on the account it
      // targeted, for the held amount/category/description. actingMember
      // null: this is an internal, already-authorised replay, so the
      // row-scope re-gate must not re-hold it.
      await this.transactionsService.create(
        familyGroupId,
        {
          accountId: request.targetAccountId,
          amount: Number(request.amount),
          type: "expense",
          categoryId: request.categoryId ?? undefined,
          description: request.description ?? undefined,
          occurredAt: new Date().toISOString(),
        },
        null,
      );
    } catch (err) {
      // Compensate the claim back to pending — no money moved, so it must
      // not be left stuck "approved"; the owner can retry.
      await this.prisma.allowanceRequest.update({
        where: { id },
        data: { status: "pending", decidedAt: null, decidedByUserId: null },
      });
      throw err;
    }

    const updated = await this.prisma.allowanceRequest.findUniqueOrThrow({
      where: { id },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });

    void this.notifyRequesterOfDecision(familyGroupId, updated, true);

    return this.toDto(updated);
  }

  /**
   * Same conditional-claim guard as approve() — no money moves on reject, but
   * the status flip must still be atomic so a reject can never race an
   * approve (or another reject) into a double-decision.
   */
  async reject(
    familyGroupId: string,
    id: string,
    ownerUserId: string,
    dto: RejectAllowanceRequestDto,
  ): Promise<AllowanceRequestResponseDto> {
    const request = await this.findOrThrow(familyGroupId, id);

    const claim = await this.prisma.allowanceRequest.updateMany({
      where: { id, familyGroupId, status: "pending" },
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
    });
    if (claim.count !== 1) {
      throw new ConflictException(
        "This allowance request has already been decided",
      );
    }

    const updated = await this.prisma.allowanceRequest.findUniqueOrThrow({
      where: { id },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });

    void this.notifyRequesterOfDecision(familyGroupId, updated, false);

    return this.toDto(updated);
  }

  private async findOrThrow(
    familyGroupId: string,
    id: string,
  ): Promise<AllowanceRequestRow> {
    const request = await this.prisma.allowanceRequest.findFirst({
      where: { id, familyGroupId },
      include: ALLOWANCE_REQUEST_INCLUDE,
    });
    if (!request) throw new NotFoundException("Allowance request not found");
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
          // Left household-wide (`userId` unset) on purpose: any approver may
          // act on it, and addressing it to one of them would hide it from
          // the rest. Row-scoped roles never see household rows, so this does
          // not show one member's request to another child.
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
          // The point of this notification, and for a long time the one thing
          // it failed to do: address it to the person who asked. As a
          // family-wide row it landed only in the owner's list, because the
          // roles that request funds (`dependant`/`operational`) had no CASL
          // grant on Notification at all — so the requester was the single
          // member who never learned the outcome.
          userId: request.requesterUserId,
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
      kind: row.kind,
      familyGroupId: row.familyGroupId,
      requesterUserId: row.requesterUserId,
      requesterName: row.requester?.name ?? "",
      targetAccountId: row.targetAccountId,
      targetAccountName: row.targetAccount?.name ?? "",
      fromAccountId: row.fromAccountId,
      fromAccountName: row.fromAccount?.name ?? null,
      amount: row.amount.toString(),
      note: row.note,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      decidedByUserId: row.decidedByUserId,
      decidedByName: row.decidedByUser?.name ?? null,
    };
  }
}
