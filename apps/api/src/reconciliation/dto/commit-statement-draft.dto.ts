import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { MAX_STATEMENT_ROWS } from "../statement-reader/statement-reader.port";

/**
 * EPIC-029 E3a — one raw, unparsed row exactly as the preview returned it.
 *
 * `amount` is a STRING here for the same reason it is a string in
 * `statementReadingSchema`: the commit re-runs `parseStatementAmount` on it
 * server-side. No number the client sends can become a `BankSyncEntry`
 * amount, because no number the client sends is read as one.
 */
export class StatementDraftRowDto {
  @ApiProperty({ example: "2026-07-01" })
  @IsString()
  @MaxLength(40)
  date!: string;

  @ApiProperty({ example: "Pembayaran QR ke TOKO LUTHFI" })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: "-37.000,00" })
  @IsString()
  @MaxLength(60)
  amount!: string;
}

export class StatementDraftTotalsDto {
  @ApiPropertyOptional({ example: "1.517.061,00", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  openingBalance?: string | null;

  @ApiPropertyOptional({ example: "1.297.613,00", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  closingBalance?: string | null;

  @ApiPropertyOptional({ example: "+ 15.630.000,00", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  totalCredit?: string | null;

  @ApiPropertyOptional({ example: "- 15.849.448,00", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  totalDebit?: string | null;
}

/**
 * EPIC-029 E3a/E7 — the confirm step.
 *
 * The client sends back the SAME raw draft the preview returned, and the
 * server re-runs the whole deterministic pipeline on it: `mapTableToRows`,
 * `parseStatementDate`, `parseStatementAmount`, and the totals gate. Two
 * consequences, both deliberate:
 *
 *  - The AI is NOT called again, so confirming costs the family nothing.
 *  - The totals gate is enforced HERE, on the request that actually writes,
 *    not only on the preview that merely displayed it. A client that skips
 *    or edits the preview gets the same refusal.
 */
export class CommitStatementDraftDto {
  @ApiProperty({ example: "e-Statement Juli 2026.pdf" })
  @IsString()
  @MaxLength(255)
  fileName!: string;

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
