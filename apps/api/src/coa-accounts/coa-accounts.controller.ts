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
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CoaAccountsService } from "./coa-accounts.service";
import { CoaAccountResponseDto } from "./dto/coa-account-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS reflect-metadata needs value imports for @Body() DTO validation
import { CreateCoaAccountDto } from "./dto/create-coa-account.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS reflect-metadata needs value imports for @Body() DTO validation
import { UpdateCoaAccountDto } from "./dto/update-coa-account.dto";

@ApiTags("coa-accounts")
@ApiBearerAuth()
@PageAccess("coa-accounts")
@Controller("family-groups/:familyGroupId/coa-accounts")
export class CoaAccountsController {
  constructor(private readonly coaAccountsService: CoaAccountsService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "CoaAccount"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all COA accounts for a family group" })
  @ApiResponse({ status: 200, type: [CoaAccountResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<CoaAccountResponseDto[]> {
    return this.coaAccountsService.findAll(familyGroupId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility((ab: AppAbility) => ab.can("create", "CoaAccount"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a COA account" })
  @ApiResponse({ status: 201, type: CoaAccountResponseDto })
  @ApiResponse({ status: 409, description: "Code already exists" })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateCoaAccountDto,
  ): Promise<CoaAccountResponseDto> {
    return this.coaAccountsService.create(familyGroupId, dto);
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("update", "CoaAccount"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update a COA account" })
  @ApiResponse({ status: 200, type: CoaAccountResponseDto })
  @ApiResponse({ status: 404, description: "COA account not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCoaAccountDto,
  ): Promise<CoaAccountResponseDto> {
    return this.coaAccountsService.update(familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("delete", "CoaAccount"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a COA account" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "COA account not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.coaAccountsService.remove(familyGroupId, id);
  }
}
