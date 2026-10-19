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

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { accountBalanceSpec } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreatePlatformAccountDto } from "./dto/create-platform-account.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreatePocketDto } from "./dto/create-pocket.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PocketTransferDto } from "./dto/pocket-transfer.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdatePlatformAccountDto } from "./dto/update-platform-account.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  PlatformAccountsService,
  type PlatformViewer,
} from "./platform-accounts.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  PocketTransfersService,
  type PocketTransferDirection,
} from "./pocket-transfers.service";

import type { AccountActor } from "../accounts/accounts.service";
import type { FxFieldSpec } from "../fx/fx-input.resolve";
import type {
  PlatformAccountDto,
  PlatformPocketDto,
  PocketTransferResultDto,
} from "@wealthme/contracts";
import type { Request, Response } from "express";

/** Foreign opening balances of the pockets created with a platform account. */
const PLATFORM_CREATE_SPEC: FxFieldSpec = {
  "pockets.*.balance": { kind: "int" },
};

function actorOf(req: Request): AccountActor | undefined {
  const m = req.tenantContext?.member;
  return m ? { userId: m.userId, role: m.role } : undefined;
}

function viewerOf(req: Request): PlatformViewer {
  return {
    member: req.tenantContext?.member ?? null,
    userId: req.tenantContext?.userId,
  };
}

/**
 * Investasi R2/§3/§4 — platform accounts ("akun platform") and their cash
 * pockets ("kantong dana"). Same page gate and abilities as the investments
 * module; moving money additionally needs `create Transaction`.
 */
@ApiTags("platform-accounts")
@ApiBearerAuth()
@PageAccess("investments")
@Controller("family-groups/:familyGroupId/platform-accounts")
export class PlatformAccountsController {
  constructor(
    private readonly platforms: PlatformAccountsService,
    private readonly transfers: PocketTransfersService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "List platform accounts with their pockets (recorded / held / available, IDR)",
  })
  @ApiResponse({ status: 200 })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
  ): Promise<PlatformAccountDto[]> {
    return this.platforms.findAll(familyGroupId, viewerOf(req));
  }

  @Get(":id")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Get one platform account with its pockets" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<PlatformAccountDto> {
    return this.platforms.findOne(familyGroupId, id, viewerOf(req));
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Create a platform account, optionally with initial pockets (fxInputs field: pockets.<i>.balance)",
  })
  @ApiResponse({ status: 201 })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreatePlatformAccountDto,
    @Req() req: Request,
  ): Promise<PlatformAccountDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "PlatformAccount",
        dto,
        spec: PLATFORM_CREATE_SPEC,
      },
      (converted) =>
        this.platforms.create(
          familyGroupId,
          converted,
          actorOf(req),
          viewerOf(req),
        ),
    );
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update a platform account (label, ref, owner)" })
  @ApiResponse({ status: 200 })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdatePlatformAccountDto,
    @Req() req: Request,
  ): Promise<PlatformAccountDto> {
    return this.platforms.update(
      familyGroupId,
      id,
      dto,
      actorOf(req),
      viewerOf(req),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary: "Delete an empty platform account (409 with pockets or holdings)",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409 })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.platforms.remove(familyGroupId, id, actorOf(req));
  }

  @Post(":id/pockets")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Create a pocket: an `investment` Account linked to this platform account",
  })
  @ApiResponse({ status: 201 })
  createPocket(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: CreatePocketDto,
    @Req() req: Request,
  ): Promise<PlatformPocketDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Account",
        dto,
        spec: accountBalanceSpec("investment"),
      },
      (converted) =>
        this.platforms.createPocket(
          familyGroupId,
          id,
          converted,
          actorOf(req),
          viewerOf(req),
        ),
    );
  }

  @Delete(":id/pockets/:pocketId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "pocketId", type: String })
  @ApiOperation({
    summary:
      "Delete an empty pocket (409 with a balance, transactions or linked holdings)",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409 })
  removePocket(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("pocketId") pocketId: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.platforms.removePocket(
      familyGroupId,
      id,
      pocketId,
      actorOf(req),
    );
  }

  @Post(":id/pockets/:pocketId/top-up")
  @CheckAbility(
    (ab: AppAbility) =>
      ab.can("manage", "Investment") && ab.can("create", "Transaction"),
  )
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "pocketId", type: String })
  @ApiOperation({
    summary:
      "Top up: transfer from a bank/e-wallet/cash account into the pocket (never income). Replay → 200.",
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 200, description: "Idempotent replay" })
  topUp(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("pocketId") pocketId: string,
    @Body() dto: PocketTransferDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PocketTransferResultDto> {
    return this.move("top-up", familyGroupId, id, pocketId, dto, req, res);
  }

  @Post(":id/pockets/:pocketId/withdraw")
  @CheckAbility(
    (ab: AppAbility) =>
      ab.can("manage", "Investment") && ab.can("create", "Transaction"),
  )
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "pocketId", type: String })
  @ApiOperation({
    summary:
      "Withdraw: transfer from the pocket to a bank/e-wallet/cash account (only available, settled cash). Replay → 200.",
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 200, description: "Idempotent replay" })
  withdraw(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("pocketId") pocketId: string,
    @Body() dto: PocketTransferDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PocketTransferResultDto> {
    return this.move("withdraw", familyGroupId, id, pocketId, dto, req, res);
  }

  private async move(
    direction: PocketTransferDirection,
    familyGroupId: string,
    id: string,
    pocketId: string,
    dto: PocketTransferDto,
    req: Request,
    res: Response,
  ): Promise<PocketTransferResultDto> {
    const result = await this.transfers.transfer(
      familyGroupId,
      id,
      pocketId,
      direction,
      dto,
      req.tenantContext?.member ?? undefined,
      viewerOf(req),
    );
    // R7 — a replay wrote nothing new: 200, not 201 Created.
    if (result.replayed) res.status(HttpStatus.OK);
    return result;
  }
}
