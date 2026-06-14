import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CalculatorsService } from "./calculators.service";
import {
  InvestmentCalcResultDto,
  KprCalcResultDto,
  RetirementCalcResultDto,
} from "./dto/investment.dto";
import { Pph21ResultDto, type Pph21RequestDto } from "./dto/pph21.dto";
import { ZakatResultDto, type ZakatRequestDto } from "./dto/zakat.dto";

import type {
  InvestmentCalcRequestDto,
  KprCalcRequestDto,
  RetirementCalcRequestDto,
} from "./dto/investment.dto";

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
}
