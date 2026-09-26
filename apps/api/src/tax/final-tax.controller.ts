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
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateFinalIncomeEntryDto,
  TaxYearQueryDto,
  UpdateFinalIncomeEntryDto,
} from "./dto/final-income.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FinalTaxService } from "./final-tax.service";

import type {
  FinalTaxEstimateDto,
  TaxFinalIncomeEntryDto,
} from "@wealthme/contracts";

@ApiTags("tax")
@ApiBearerAuth()
@PageAccess("tax")
@Controller("family-groups/:familyGroupId/tax")
export class FinalTaxController {
  constructor(private readonly finalTaxService: FinalTaxService) {}

  @Get("final-income")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List manual final-income entries for a year" })
  listEntries(
    @Param("familyGroupId") familyGroupId: string,
    @Query() q: TaxYearQueryDto,
  ): Promise<TaxFinalIncomeEntryDto[]> {
    return this.finalTaxService.listEntries(familyGroupId, q.year);
  }

  @Post("final-income")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a manual final-income entry" })
  createEntry(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateFinalIncomeEntryDto,
  ): Promise<TaxFinalIncomeEntryDto> {
    return this.finalTaxService.createEntry(familyGroupId, dto);
  }

  @Patch("final-income/:entryId")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "entryId", type: String })
  @ApiOperation({ summary: "Update a manual final-income entry" })
  updateEntry(
    @Param("familyGroupId") familyGroupId: string,
    @Param("entryId") entryId: string,
    @Body() dto: UpdateFinalIncomeEntryDto,
  ): Promise<TaxFinalIncomeEntryDto> {
    return this.finalTaxService.updateEntry(familyGroupId, entryId, dto);
  }

  @Delete("final-income/:entryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "entryId", type: String })
  @ApiOperation({ summary: "Delete a manual final-income entry" })
  removeEntry(
    @Param("familyGroupId") familyGroupId: string,
    @Param("entryId") entryId: string,
  ): Promise<void> {
    return this.finalTaxService.removeEntry(familyGroupId, entryId);
  }

  @Get("final-tax")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Estimate final-tax lines from holdings and manual entries",
  })
  estimate(
    @Param("familyGroupId") familyGroupId: string,
    @Query() q: TaxYearQueryDto,
  ): Promise<FinalTaxEstimateDto> {
    return this.finalTaxService.estimate(familyGroupId, q.year, {
      includeEntries: true,
    });
  }
}
