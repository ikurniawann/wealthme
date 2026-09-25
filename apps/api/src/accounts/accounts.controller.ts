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
import { canSeePrivateItems } from "../common/utils/privacy.util";

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
  constructor(private readonly accountsService: AccountsService) {}

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
    return this.accountsService.findAll(
      familyGroupId,
      canSeePrivate,
      query.owner,
      req.tenantContext?.userId,
      req.tenantContext?.member ?? null,
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
    return this.accountsService.create(familyGroupId, dto, actorOf(req));
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
    return this.accountsService.findOne(
      familyGroupId,
      id,
      canSeePrivate,
      req.tenantContext?.member ?? null,
      req.tenantContext?.userId,
    );
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update an account" })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiResponse({ status: 404, description: "Account not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: Request,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(familyGroupId, id, dto, actorOf(req));
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
