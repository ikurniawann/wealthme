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
import {
  RECONCILE_BALANCE_SPEC,
  accountBalanceSpec,
} from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  AccountReconcileService,
  type ReconcileResult,
} from "./account-reconcile.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AccountsService, type AccountActor } from "./accounts.service";
import { AccountResponseDto } from "./dto/account-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateAccountDto } from "./dto/create-account.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListAccountsQueryDto } from "./dto/list-accounts-query.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReconcileAccountDto } from "./dto/reconcile-account.dto";
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
    private readonly reconciler: AccountReconcileService,
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
      .then((rows) =>
        rows.map((a) => redactAccount(a, member, req.tenantContext?.userId)),
      );
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
          .then((a) =>
            redactAccount(
              a,
              req.tenantContext?.member,
              req.tenantContext?.userId,
            ),
          ),
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
      .then((a) => redactAccount(a, member, req.tenantContext?.userId));
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
    // No fx conversion here: UpdateAccountDto carries no money field (the
    // balance only moves through transactions — see update-account.dto.ts).
    return this.accountsService
      .update(familyGroupId, id, dto, actorOf(req))
      .then((a) =>
        redactAccount(a, req.tenantContext?.member, req.tenantContext?.userId),
      );
  }

  @Post(":id/reconcile")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Cocokkan saldo — book the difference to the counted balance and mark the account checked",
  })
  @ApiResponse({ status: 201 })
  reconcile(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: ReconcileAccountDto,
    @Req() req: Request,
  ): Promise<ReconcileResult> {
    const member = req.tenantContext?.member;
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Account",
        entityId: id,
        dto,
        spec: RECONCILE_BALANCE_SPEC,
      },
      (converted) =>
        this.reconciler
          .reconcile(
            familyGroupId,
            id,
            converted.actualBalance,
            member,
            req.tenantContext?.userId,
          )
          .then((r) => ({
            ...r,
            account: redactAccount(
              r.account,
              member,
              req.tenantContext?.userId,
            ),
          })),
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
