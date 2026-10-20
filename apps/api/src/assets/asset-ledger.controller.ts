import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { type Request as ExpressRequest } from "express";

import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { assertBalancesVisible } from "../common/utils/balance-visibility.util";
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from "../prisma/prisma.service";

import {
  AssetValuationDto,
  CreateAssetTransactionDto,
  UpdateAssetTransactionDto,
  UpdateAssetValuationDto,
  VoidAssetEventDto,
} from "./dto/asset-ledger.dto";
import { buildLedger } from "./ledger/asset-events";
import { actorViewer, lockAsset } from "./ledger/asset-ledger-support";
import { AssetTransactionsService } from "./ledger/asset-transactions.service";
import { AssetValuationsService } from "./ledger/asset-valuations.service";
/* eslint-enable @typescript-eslint/consistent-type-imports */

import type { AssetActor } from "./ledger/asset-ledger-support";
import type {
  AssetLedgerDto,
  AssetTransactionResultDto,
  AssetValuationPreviewDto,
  AssetValuationResultDto,
} from "@wealthme/contracts";

type Req = ExpressRequest & { params: { familyGroupId: string } };

/** A7 — who writes (audit) and their row scope (every route). */
function actorOf(req: Req): AssetActor {
  return {
    member: req.tenantContext?.member ?? null,
    userId: req.tenantContext?.userId ?? null,
  };
}

/**
 * Aset Task 18 — transactions (buy / sell / opening), Update Nilai
 * (preview / create / edit / void) and the event history. Page access
 * "assets" + CASL Asset on every route; row scope (A7) inside the services
 * (another member's asset is a 404). Every response carries money, so a
 * member with "Lihat saldo" off gets 403.
 */
@ApiTags("assets")
@ApiBearerAuth()
@PageAccess("assets")
@Controller("family-groups/:familyGroupId/assets/:id")
export class AssetLedgerController {
  constructor(
    private readonly transactions: AssetTransactionsService,
    private readonly valuations: AssetValuationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("events")
  @CheckAbility((ab) => ab.can("read", "Asset"))
  @ApiOperation({
    summary: "Asset history events, transactions, holding and A6 changes",
  })
  async events(
    @Request() req: Req,
    @Param("id") id: string,
  ): Promise<AssetLedgerDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.prisma.$transaction(async (tx) => {
      const asset = await lockAsset(
        tx,
        req.params.familyGroupId,
        id,
        actorViewer(actorOf(req)),
        "read",
      );
      return buildLedger(tx, asset);
    });
  }

  @Post("transactions")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({
    summary:
      "Record a buy / sell / opening (idempotent, moves cash for buy/sell)",
  })
  createTransaction(
    @Request() req: Req,
    @Param("id") id: string,
    @Body() dto: CreateAssetTransactionDto,
  ): Promise<AssetTransactionResultDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.transactions.create(
      req.params.familyGroupId,
      id,
      dto,
      actorOf(req),
    );
  }

  @Patch("transactions/:transactionId")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Edit an asset transaction (audited, recomputed)" })
  updateTransaction(
    @Request() req: Req,
    @Param("id") id: string,
    @Param("transactionId") transactionId: string,
    @Body() dto: UpdateAssetTransactionDto,
  ): Promise<AssetTransactionResultDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.transactions.update(
      req.params.familyGroupId,
      id,
      transactionId,
      dto,
      actorOf(req),
    );
  }

  @Post("transactions/:transactionId/void")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({
    summary: "Void an asset transaction (cash reversed, audited)",
  })
  voidTransaction(
    @Request() req: Req,
    @Param("id") id: string,
    @Param("transactionId") transactionId: string,
    @Body() dto: VoidAssetEventDto,
  ): Promise<AssetTransactionResultDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.transactions.void(
      req.params.familyGroupId,
      id,
      transactionId,
      dto,
      actorOf(req),
    );
  }

  @Post("valuations/preview")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Preview an Update Nilai (nothing is saved)" })
  preview(
    @Request() req: Req,
    @Param("id") id: string,
    @Body() dto: AssetValuationDto,
  ): Promise<AssetValuationPreviewDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.valuations.preview(
      req.params.familyGroupId,
      id,
      dto,
      actorViewer(actorOf(req)),
    );
  }

  @Post("valuations")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({
    summary: "Record a valuation (idempotent; never moves cash or cost)",
  })
  createValuation(
    @Request() req: Req,
    @Param("id") id: string,
    @Body() dto: AssetValuationDto,
  ): Promise<AssetValuationResultDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.valuations.create(
      req.params.familyGroupId,
      id,
      dto,
      actorOf(req),
    );
  }

  @Patch("valuations/:historyId")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Edit a valuation (audited, recomputed)" })
  updateValuation(
    @Request() req: Req,
    @Param("id") id: string,
    @Param("historyId") historyId: string,
    @Body() dto: UpdateAssetValuationDto,
  ): Promise<AssetValuationResultDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.valuations.update(
      req.params.familyGroupId,
      id,
      historyId,
      dto,
      actorOf(req),
    );
  }

  @Post("valuations/:historyId/void")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Void a valuation (kept, audited, recomputed)" })
  voidValuation(
    @Request() req: Req,
    @Param("id") id: string,
    @Param("historyId") historyId: string,
    @Body() dto: VoidAssetEventDto,
  ): Promise<AssetValuationResultDto> {
    assertBalancesVisible(req.tenantContext?.member);
    return this.valuations.void(
      req.params.familyGroupId,
      id,
      historyId,
      dto,
      actorOf(req),
    );
  }
}
