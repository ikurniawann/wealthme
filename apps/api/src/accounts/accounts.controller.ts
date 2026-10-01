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

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { redactAccount } from "../common/utils/balance-visibility.util";
import { canSeePrivateItems } from "../common/utils/privacy.util";
import { accountBalanceSpec } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AccountsService, type AccountActor } from "./accounts.service";
import { AccountResponseDto } from "./dto/account-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateAccountDto } from "./dto/create-account.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListAccountsQueryDto } from "./dto/list-accounts-query.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateAccountDto } from "./dto/update-account.dto";

import type { Request } from "express";

/** EPIC-033 R3 follow-up — who is creating/updating, for the owner rule. */
function actorOf(req: Request): AccountActor | undefined {
  const m = req.tenantContext?.member;
  return m ? { userId: m.userId, role: m.role } : undefined;
}

@ApiTags("accounts")
@ApiBearerAuth()
@PageAccess("accounts")
@Controller("family-groups/:familyGroupId/accounts")
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all accounts for a family group" })
  @ApiResponse({ status: 200, type: [AccountResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Query() query: ListAccountsQueryDto,
    @Req() req: Request,
  ): Promise<AccountResponseDto[]> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    const member = req.tenantContext?.member ?? null;
    return this.accountsService
      .findAll(
        familyGroupId,
        canSeePrivate,
        query.owner,
        req.tenantContext?.userId,
        member,
      )
      .then((rows) => rows.map((a) => redactAccount(a, member)));
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create an account in a family group" })
  @ApiResponse({ status: 201, type: AccountResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateAccountDto,
    @Req() req: Request,
  ): Promise<AccountResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Account",
        dto,
        spec: accountBalanceSpec(dto.type),
      },
      (converted) =>
        this.accountsService
          .create(familyGroupId, converted, actorOf(req))
          .then((a) => redactAccount(a, req.tenantContext?.member)),
    );
  }

  @Get(":id")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Get a single account by ID" })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiResponse({ status: 404, description: "Account not found" })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<AccountResponseDto> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    const member = req.tenantContext?.member ?? null;
    return this.accountsService
      .findOne(
        familyGroupId,
        id,
        canSeePrivate,
        member,
        req.tenantContext?.userId,
      )
      .then((a) => redactAccount(a, member));
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update an account" })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiResponse({ status: 404, description: "Account not found" })
  async update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: Request,
  ): Promise<AccountResponseDto> {
    // UpdateAccountDto is a PartialType, so `type` is optional and client-controlled. The negative
    // allowance must come from the STORED account. Only look it up when a conversion is requested.
    const storedType = dto.fxInputs?.length
      ? (
          await this.accountsService.findOne(
            familyGroupId,
            id,
            canSeePrivateItems(req.tenantContext?.member?.role),
            req.tenantContext?.member ?? null,
            req.tenantContext?.userId,
          )
        ).type
      : undefined;
    // Both the STORED type and the type this request would leave the account as must be
    // "cash" — `AccountsService.update` applies `dto.type` with no balance re-check, so a
    // client sending `type: "bank"` alongside a negative foreign preview must not slip
    // through just because the account was cash before this PATCH.
    const effectiveType = dto.type ?? storedType;
    const allowsNegative = storedType === "cash" && effectiveType === "cash";
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Account",
        entityId: id,
        dto,
        spec: accountBalanceSpec(allowsNegative ? "cash" : undefined),
      },
      (converted) =>
        this.accountsService
          .update(familyGroupId, id, converted, actorOf(req))
          .then((a) => redactAccount(a, req.tenantContext?.member)),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete an account" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Account not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.accountsService.remove(familyGroupId, id);
  }
}
