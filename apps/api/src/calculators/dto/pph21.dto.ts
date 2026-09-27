import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, Max, Min } from "class-validator";

import { ptkpFor } from "../../tax-engine/ptkp";
import { wibDateString } from "../../tax-rules/tax-rules.registry";

const MARITAL_STATUSES = ["TK", "K", "KI"] as const;
const DEPENDENT_COUNTS = [0, 1, 2, 3] as const;

/**
 * Legal PTKP (non-taxable income threshold) values per UU HPP, one per
 * marital-status × dependents combination. Review fix round 1 (Important
 * #2) — this used to be a hardcoded 5-value TK/0..K/3 list, so this
 * `@Public()` endpoint rejected every K/I (istri penghasilan digabung)
 * household outright and would silently drift from the registry on any
 * future PTKP change. Built from `ptkpFor` (Task 2's engine) so it can
 * only ever agree with the registry.
 */
export const PTKP_VALUES: readonly number[] = MARITAL_STATUSES.flatMap(
  (maritalStatus) =>
    DEPENDENT_COUNTS.map((dependents) =>
      Number(
        ptkpFor({ maritalStatus, dependents }, wibDateString(new Date())).ptkp,
      ),
    ),
);

// EPIC-024 Group E (E1) — this endpoint is `@Public()` (no auth guard), and
// its `grossIncome`/`zakatPaid` ultimately get persisted as-is into
// TaxRecord's `BigInt` columns once saved via /tax. `@IsNumber()`/`@Min(0)`
// alone had no ceiling, so a caller could submit a value large enough to
// round-trip through JS's exponential `Number#toString` (>= 1e21) and break
// downstream numeric-string validation. 999_999_999_999_999 (15 nines) stays
// comfortably under Number.MAX_SAFE_INTEGER (~9.007e15) and BigInt's signed
// range, matching the digit cap enforced in create-tax-record.dto.ts.
export const MAX_TAX_AMOUNT = 999_999_999_999_999;
const MAX_TAX_AMOUNT_MESSAGE = (field: string) =>
  `${field} must not exceed ${MAX_TAX_AMOUNT.toLocaleString("en-US")}`;

export class Pph21RequestDto {
  @ApiProperty({ description: "Annual gross income (IDR)" })
  @IsNumber()
  @Min(0)
  @Max(MAX_TAX_AMOUNT, { message: MAX_TAX_AMOUNT_MESSAGE("grossIncome") })
  grossIncome!: number;

  @ApiPropertyOptional({ description: "Zakat paid in the year (reduces PKP)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_TAX_AMOUNT, { message: MAX_TAX_AMOUNT_MESSAGE("zakatPaid") })
  zakatPaid?: number;

  @ApiPropertyOptional({
    description:
      "PTKP (non-taxable income threshold) for the taxpayer's marital/dependents status (IDR): TK/K/K-I × 0-3 dependents, e.g. TK/0 54.000.000 through K-I/3 126.000.000. Defaults to TK/0 when omitted.",
    enum: PTKP_VALUES,
  })
  @IsOptional()
  @IsIn(PTKP_VALUES)
  ptkp?: number;
}

export class TaxBracketDto {
  @ApiProperty()
  bracket!: string;

  @ApiProperty()
  taxableAmount!: number;

  @ApiProperty()
  rate!: number;

  @ApiProperty()
  tax!: number;
}

export class Pph21ResultDto {
  @ApiProperty()
  grossIncome!: number;

  @ApiProperty()
  biayaJabatan!: number;

  @ApiProperty()
  ptkp!: number;

  @ApiProperty()
  zakatDeduction!: number;

  @ApiProperty()
  pkp!: number;

  @ApiProperty({ type: [TaxBracketDto] })
  taxBreakdown!: TaxBracketDto[];

  @ApiProperty()
  totalTax!: number;

  @ApiProperty()
  effectiveRate!: number;
}
