import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { MAX_STATEMENT_ROWS } from "../statement-reader/statement-reader.port";

import {
  StatementDraftRowDto,
  StatementDraftTotalsDto,
} from "./commit-statement-draft.dto";
import { MAX_STATEMENT_PDF_PAGES } from "./read-statement-pdf.dto";

/**
 * EPIC-029 follow-up — the merged draft, sent back for parsing and the
 * totals gate after the per-page reads finish.
 *
 * This endpoint makes NO AI call: it runs exactly the same deterministic
 * pipeline the commit does (`mapTableToRows` → `parseStatementDate` /
 * `parseStatementAmount` → `checkStatementTotals`) and returns a preview.
 *
 * The client assembling this payload does not widen the trust model. The
 * commit step already re-parses and re-runs the totals gate on whatever the
 * client posts, precisely because a preview is advisory and a client can
 * edit or skip it — so a merged draft is checked on the request that writes,
 * exactly as a single-call draft always was.
 */
export class PreviewStatementDraftDto {
  @ApiProperty({ example: "e-Statement Juli 2026.pdf" })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: MAX_STATEMENT_PDF_PAGES })
  @IsInt()
  @Min(1)
  @Max(MAX_STATEMENT_PDF_PAGES)
  pageCount!: number;

  @ApiProperty({ type: [StatementDraftRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STATEMENT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => StatementDraftRowDto)
  rows!: StatementDraftRowDto[];

  @ApiProperty({ type: StatementDraftTotalsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => StatementDraftTotalsDto)
  totals!: StatementDraftTotalsDto;
}
