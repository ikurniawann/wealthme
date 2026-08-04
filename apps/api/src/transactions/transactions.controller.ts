import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ScanReceiptDto } from "./dto/scan-receipt.dto";
import {
  TransactionListResponseDto,
  TransactionResponseDto,
  TransactionSummaryDto,
} from "./dto/transaction-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "./transactions.service";

import type { Request } from "express";

@ApiTags("transactions")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/transactions")
export class TransactionsController {
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
    );
  }

  @Post("scan")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Scan a receipt image and extract transaction data",
  })
  @ApiResponse({ status: 201 })
  scan(
    @Param("familyGroupId") _familyGroupId: string,
    @Body() dto: ScanReceiptDto,
  ) {
    return this.transactionsService.scanReceipt(dto.imageBase64);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a transaction" })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateTransactionDto,
    @Req() req: Request,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(
      familyGroupId,
      dto,
      req.tenantContext?.member,
    );
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
    return this.transactionsService.findOne(familyGroupId, id, canSeePrivate);
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
    return this.transactionsService.update(
      familyGroupId,
      id,
      dto,
      req.tenantContext?.member,
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
  ): Promise<void> {
    return this.transactionsService.remove(familyGroupId, id);
  }
}
