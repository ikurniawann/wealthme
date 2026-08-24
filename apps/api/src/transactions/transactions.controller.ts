import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { canSeePrivateItems } from "../common/utils/privacy.util";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateTransactionDto } from "./dto/create-transaction.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListTransactionsQueryDto } from "./dto/list-transactions-query.dto";
import { ScanReceiptResponseDto } from "./dto/scan-receipt-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ScanReceiptDto } from "./dto/scan-receipt.dto";
import {
  HeldExpenseResponseDto,
  TransactionListResponseDto,
  TransactionResponseDto,
  TransactionSummaryDto,
} from "./dto/transaction-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { toScanHttpException } from "./ocr/ocr-http-error.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "./transactions.service";

import type { Request, Response } from "express";

@ApiTags("transactions")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/transactions")
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Get("summary")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Get transaction summary for a family group" })
  @ApiResponse({ status: 200, type: TransactionSummaryDto })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
    @Query() query: ListTransactionsQueryDto,
    @Req() req: Request,
  ): Promise<TransactionSummaryDto> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.transactionsService.getSummary(
      familyGroupId,
      query,
      canSeePrivate,
      req.tenantContext?.member?.role ?? null,
      req.tenantContext?.userId,
    );
  }

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List transactions for a family group" })
  @ApiResponse({ status: 200, type: TransactionListResponseDto })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Query() query: ListTransactionsQueryDto,
    @Req() req: Request,
  ): Promise<TransactionListResponseDto> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.transactionsService.findAll(
      familyGroupId,
      query,
      canSeePrivate,
      req.tenantContext?.member?.role ?? null,
      req.tenantContext?.userId,
    );
  }

  // EPIC-023 Task C retry (CRITICAL six-reviewer finding) — CASL's "manage"
  // is NOT implied by holding "create" (verified against @casl/ability
  // 6.8.1): `dependant`/`operational` are granted only create+read on
  // Transaction (D3/D5), and `admin_staff` has the identical create-without-
  // manage shape, so gating this on "manage" 403'd all three roles on the
  // one action they exist to perform. Check the action actually performed.
  @Post("scan")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @CheckAbility((ab: AppAbility) => ab.can("create", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Scan a receipt image and extract transaction data",
  })
  @ApiResponse({ status: 201, type: ScanReceiptResponseDto })
  @ApiResponse({
    status: 412,
    description:
      "code=OCR_NOT_CONFIGURED — the family has no AI provider key (EPIC-027 D11: no server-key or mock fallback)",
  })
  @ApiResponse({
    status: 409,
    description:
      "code=AI_KEY_CORRUPTED — the stored key could not be decrypted; re-enter it in Pengaturan",
  })
  @ApiResponse({
    status: 502,
    description: "code=OCR_AUTH | OCR_PARSE_FAILED | OCR_UPSTREAM_FAILED",
  })
  @ApiResponse({ status: 429, description: "code=OCR_RATE_LIMITED" })
  @ApiResponse({ status: 504, description: "code=OCR_TIMEOUT" })
  async scan(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: ScanReceiptDto,
  ): Promise<ScanReceiptResponseDto> {
    // EPIC-027 D14 — anyone who may create a Transaction may scan; the
    // 10/min @Throttle above is the guard on a paid upstream call, not a
    // tighter ability check.
    try {
      return await this.transactionsService.scanReceipt(
        familyGroupId,
        dto.imageBase64,
      );
    } catch (err: unknown) {
      throw toScanHttpException(err, this.logger);
    }
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("create", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Create a transaction. EPIC-023 Task D (D3/D9) — a row-scoped member's over-threshold expense returns 202 + HeldExpenseResponseDto instead of posting: no Transaction is created and no balance changes until the head approves the resulting AllowanceRequest.",
  })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  @ApiResponse({
    status: 202,
    type: HeldExpenseResponseDto,
    description: "Held pending the head's approval — nothing was posted",
  })
  async create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateTransactionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionResponseDto | HeldExpenseResponseDto> {
    const result = await this.transactionsService.create(
      familyGroupId,
      dto,
      req.tenantContext?.member,
    );
    // EPIC-023 Task D (D3/D9) — 202 Accepted, not 201 Created: nothing that
    // looks like the requested Transaction was created, only an
    // AllowanceRequest tracking the hold. The web dialog must branch on
    // `"held" in result`, never surface this as a plain success.
    if ("held" in result) {
      res.status(202);
    }
    return result;
  }

  @Get(":id")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Get a single transaction" })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<TransactionResponseDto> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.transactionsService.findOne(
      familyGroupId,
      id,
      canSeePrivate,
      req.tenantContext?.member?.role ?? null,
      req.tenantContext?.userId,
    );
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update a transaction" })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTransactionDto,
    @Req() req: Request,
  ): Promise<TransactionResponseDto> {
    // EPIC-022 A6 follow-up — same role resolution as `findOne`/`findAll`.
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.transactionsService.update(
      familyGroupId,
      id,
      dto,
      req.tenantContext?.member,
      canSeePrivate,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a transaction" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<void> {
    // EPIC-022 A6 follow-up — same role resolution as `findOne`/`findAll`.
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.transactionsService.remove(familyGroupId, id, canSeePrivate);
  }
}
