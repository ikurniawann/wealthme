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

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AccountsService } from "./accounts.service";
import { AccountResponseDto } from "./dto/account-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateAccountDto } from "./dto/create-account.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateAccountDto } from "./dto/update-account.dto";

@ApiTags("accounts")
@ApiBearerAuth()
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
  ): Promise<AccountResponseDto[]> {
    return this.accountsService.findAll(familyGroupId);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create an account in a family group" })
  @ApiResponse({ status: 201, type: AccountResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(familyGroupId, dto);
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
  ): Promise<AccountResponseDto> {
    return this.accountsService.findOne(familyGroupId, id);
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
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(familyGroupId, id, dto);
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
