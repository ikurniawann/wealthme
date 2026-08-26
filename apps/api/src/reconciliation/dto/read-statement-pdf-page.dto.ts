import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator";

import {
  MAX_STATEMENT_PDF_PAGES,
  MAX_STATEMENT_PDF_TEXT_CHARS,
} from "./read-statement-pdf.dto";

/**
 * EPIC-029 follow-up — ONE page of an already-extracted statement PDF.
 *
 * The original design read the whole statement in a single call. That could
 * not work in production: a 5-page statement took the model longer than
 * 120s, while nginx cuts an idle upstream at 60s and Cloudflare caps any
 * single request at ~100s. No timeout value fixes that — the request is
 * simply longer than the path allows, so the browser only ever saw a dead
 * connection.
 *
 * Reading page by page makes each call small (roughly ten rows), which fits
 * inside every one of those ceilings with room to spare, and lets the UI
 * show real progress instead of a spinner that ends in nothing.
 *
 * What is NOT here is unchanged and deliberate: no file, no password. See
 * `ReadStatementPdfDto` for why.
 */
export class ReadStatementPdfPageDto {
  @ApiProperty({ example: "e-Statement Juli 2026.pdf" })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: MAX_STATEMENT_PDF_PAGES })
  @IsInt()
  @Min(1)
  @Max(MAX_STATEMENT_PDF_PAGES)
  pageCount!: number;

  /** Zero-based, and bounded by the same page cap the whole-file DTO uses. */
  @ApiProperty({ example: 0, minimum: 0, maximum: MAX_STATEMENT_PDF_PAGES - 1 })
  @IsInt()
  @Min(0)
  @Max(MAX_STATEMENT_PDF_PAGES - 1)
  pageIndex!: number;

  @ApiProperty({ description: "Extracted text layer for this page only." })
  @IsString()
  @MaxLength(MAX_STATEMENT_PDF_TEXT_CHARS)
  text!: string;
}
