import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../common/decorators/public.decorator";
import {
  mapEngineError,
  toPpnResultDto,
  toRuleRefDtos,
} from "../tax/tax-dto-mappers";
import { ppnPreview } from "../tax-engine/ppn.engine";
import {
  TAX_RULES,
  ruleAt,
  wibDateString,
} from "../tax-rules/tax-rules.registry";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CalculatorsService } from "./calculators.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  InvestmentCalcRequestDto,
  InvestmentCalcResultDto,
  KprCalcRequestDto,
  KprCalcResultDto,
  RetirementCalcRequestDto,
  RetirementCalcResultDto,
} from "./dto/investment.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  PerpuluhanRequestDto,
  PerpuluhanResultDto,
} from "./dto/perpuluhan.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Pph21RequestDto, Pph21ResultDto } from "./dto/pph21.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PpnPreviewDto, TaxRulesQueryDto } from "./dto/ppn.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ZakatRequestDto, ZakatResultDto } from "./dto/zakat.dto";

import type { TaxRuleKey } from "../tax-rules/tax-rule.types";
import type {
  PpnPreviewResultDto,
  TaxRuleDetailDto,
} from "@wealthme/contracts";

@ApiTags("calculators")
@Public()
@Controller("calculators")
export class CalculatorsController {
  constructor(private readonly calculatorsService: CalculatorsService) {}

  @Post("zakat")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Calculate Zakat Maal" })
  @ApiResponse({ status: 200, type: ZakatResultDto })
  calculateZakat(@Body() dto: ZakatRequestDto): ZakatResultDto {
    return this.calculatorsService.calculateZakat(dto);
  }

  @Post("perpuluhan")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Calculate perpuluhan (tithe) — 10% of income" })
  @ApiResponse({ status: 200, type: PerpuluhanResultDto })
  calculatePerpuluhan(@Body() dto: PerpuluhanRequestDto): PerpuluhanResultDto {
    return this.calculatorsService.calculatePerpuluhan(dto);
  }

  @Post("pph21")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Calculate PPh 21 income tax (UU HPP)" })
  @ApiResponse({ status: 200, type: Pph21ResultDto })
  calculatePph21(@Body() dto: Pph21RequestDto): Pph21ResultDto {
    return this.calculatorsService.calculatePph21(dto);
  }

  @Post("investment")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Calculate compound investment future value" })
  @ApiResponse({ status: 200, type: InvestmentCalcResultDto })
  calculateInvestment(
    @Body() dto: InvestmentCalcRequestDto,
  ): InvestmentCalcResultDto {
    return this.calculatorsService.calculateInvestment(dto);
  }

  @Post("kpr")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Calculate KPR / mortgage monthly payment" })
  @ApiResponse({ status: 200, type: KprCalcResultDto })
  calculateKpr(@Body() dto: KprCalcRequestDto): KprCalcResultDto {
    return this.calculatorsService.calculateKpr(dto);
  }

  @Post("retirement")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Calculate required monthly savings for retirement",
  })
  @ApiResponse({ status: 200, type: RetirementCalcResultDto })
  calculateRetirement(
    @Body() dto: RetirementCalcRequestDto,
  ): RetirementCalcResultDto {
    return this.calculatorsService.calculateRetirement(dto);
  }

  @Get("tax-rules")
  @ApiOperation({
    summary: "Tax rules in force on a date (static law, no family data)",
  })
  taxRules(@Query() q: TaxRulesQueryDto): TaxRuleDetailDto[] {
    const known = [...new Set<string>(TAX_RULES.map((e) => e.key))];
    const keys = q.keys ? q.keys.split(",").filter(Boolean) : known;
    if (keys.some((k) => !known.includes(k)))
      throw new BadRequestException("unknown tax rule key");
    const date = q.date ?? wibDateString(new Date());
    return (keys as TaxRuleKey[]).map((k) => {
      const r = ruleAt(k, date);
      const value: unknown = JSON.parse(
        JSON.stringify(r.value, (_key, v: unknown) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      );
      return { ...toRuleRefDtos([r.ref])[0]!, value };
    });
  }

  @Post("ppn")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "PPN information for a price (information only)" })
  ppn(@Body() dto: PpnPreviewDto): PpnPreviewResultDto {
    try {
      return toPpnResultDto(
        ppnPreview({
          date: dto.date,
          amount: BigInt(dto.amount),
          luxury: dto.luxury,
          priceIncludesPpn: dto.priceIncludesPpn,
        }),
      );
    } catch (e) {
      return mapEngineError(e);
    }
  }
}
