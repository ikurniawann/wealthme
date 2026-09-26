import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { parseDigits } from "../tax-engine/money";
import { computePphOp } from "../tax-engine/pph-op.engine";
import { terYear } from "../tax-engine/ter.engine";
import { umkmYear } from "../tax-engine/umkm.engine";
import { ruleAt, yearEndDate } from "../tax-rules/tax-rules.registry";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  PphOpPreviewDto,
  TerPreviewDto,
  UmkmPreviewDto,
} from "./dto/tax-preview.dto";
import {
  mapEngineError,
  toPphOpResultDto,
  toTerResultDto,
  toUmkmResultDto,
} from "./tax-dto-mappers";

import type { PphOpInput } from "../tax-engine/pph-op.engine";
import type {
  PphOpResultDto,
  TerPreviewResultDto,
  UmkmResultDto,
} from "@wealthme/contracts";

const opt = (v: string | undefined) => (v === undefined ? 0n : parseDigits(v));

// Carry-over #3 (task-6-carry.md): NPPN is only accepted below the
// Rp4,8 miliar UMKM/final-regime turnover ceiling — above it the taxpayer
// must keep books, so NPPN input is rejected outright with a 400.
function assertNppnEligible(taxYear: number, freelanceGross: bigint): void {
  if (freelanceGross <= 0n) return;
  const ceiling = ruleAt("umkm.final", yearEndDate(taxYear)).value
    .turnoverCeiling;
  if (freelanceGross > ceiling) {
    throw new RangeError(
      "freelanceGross exceeds the NPPN turnover ceiling (Rp4,8 miliar); bookkeeping is required above it",
    );
  }
}

export function pphOpInputFromDto(dto: PphOpPreviewDto): PphOpInput {
  const freelanceGross = opt(dto.freelanceGross);
  assertNppnEligible(dto.taxYear, freelanceGross);
  return {
    taxYear: dto.taxYear,
    status: { maritalStatus: dto.maritalStatus, dependents: dto.dependents },
    employmentGross: parseDigits(dto.employmentGross),
    pensionContribution: opt(dto.pensionContribution),
    freelance:
      freelanceGross > 0n
        ? { gross: freelanceGross, nppnBps: dto.nppnRateBps ?? 0 }
        : null,
    otherNetIncome: opt(dto.otherNetIncome),
    zakat: opt(dto.zakat),
    withheldPph21: opt(dto.withheldPph21),
  };
}

@ApiTags("tax")
@ApiBearerAuth()
@PageAccess("tax")
@Controller("family-groups/:familyGroupId/tax")
export class TaxPreviewController {
  @Post("pph-op/preview")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Preview annual PPh OP (no persistence)" })
  pphOp(@Body() dto: PphOpPreviewDto): PphOpResultDto {
    try {
      return toPphOpResultDto(computePphOp(pphOpInputFromDto(dto)));
    } catch (e) {
      return mapEngineError(e);
    }
  }

  @Post("ter/preview")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Preview PPh 21 TER Jan–Nov + December true-up + DTP flags",
  })
  ter(@Body() dto: TerPreviewDto): TerPreviewResultDto {
    try {
      return toTerResultDto(
        terYear({
          taxYear: dto.taxYear,
          status: {
            maritalStatus: dto.maritalStatus,
            dependents: dto.dependents,
          },
          monthlyGross: dto.monthlyGross.map(parseDigits),
          monthlyPension: (
            dto.monthlyPension ?? Array.from({ length: 12 }, () => "0")
          ).map(parseDigits),
          monthlyFixedGross: dto.monthlyFixedGross
            ? dto.monthlyFixedGross.map(parseDigits)
            : null,
          zakat: opt(dto.zakat),
          dtp: dto.dtp
            ? {
                sector: dto.dtp.sector,
                employment: dto.dtp.employment,
                dailyWage: dto.dtp.dailyWage
                  ? parseDigits(dto.dtp.dailyWage)
                  : null,
                nikValidated: dto.dtp.nikValidated,
              }
            : null,
        }),
      );
    } catch (e) {
      return mapEngineError(e);
    }
  }

  @Post("umkm/preview")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Preview UMKM 0,5% final tax for a year of monthly omzet",
  })
  umkm(@Body() dto: UmkmPreviewDto): UmkmResultDto {
    try {
      const first = dto.firstRegisteredYear ?? null;
      return toUmkmResultDto(
        umkmYear({
          taxYear: dto.taxYear,
          monthlyOmzet: dto.monthlyOmzet.map(parseDigits),
          firstRegisteredYear: first,
        }),
        dto.taxYear,
        first,
        false,
      );
    } catch (e) {
      return mapEngineError(e);
    }
  }
}
