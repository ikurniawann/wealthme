import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
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
  CryptoExchangeProfileDto,
  TaxYearQueryDto,
} from "./dto/final-income.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FinalTaxService } from "./final-tax.service";

import type {
  CryptoExchangeKind,
  FinalTaxEstimateDto,
} from "@wealthme/contracts";

@ApiTags("investments")
@ApiBearerAuth()
@PageAccess("investments")
@Controller("family-groups/:familyGroupId/investment-tax")
export class InvestmentTaxController {
  constructor(private readonly finalTaxService: FinalTaxService) {}

  @Get("estimate")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Holdings-only final-tax estimate (no manual entries)",
  })
  estimate(
    @Param("familyGroupId") familyGroupId: string,
    @Query() q: TaxYearQueryDto,
  ): Promise<FinalTaxEstimateDto> {
    return this.finalTaxService.estimate(familyGroupId, q.year, {
      includeEntries: false,
    });
  }

  @Patch(":investmentId/profile")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Investment"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "investmentId", type: String })
  @ApiOperation({ summary: "Set the crypto exchange profile of a holding" })
  setProfile(
    @Param("familyGroupId") familyGroupId: string,
    @Param("investmentId") investmentId: string,
    @Body() dto: CryptoExchangeProfileDto,
  ): Promise<{
    investmentId: string;
    cryptoExchange: CryptoExchangeKind | null;
  }> {
    return this.finalTaxService.setCryptoExchange(
      familyGroupId,
      investmentId,
      dto.cryptoExchange,
    );
  }
}
