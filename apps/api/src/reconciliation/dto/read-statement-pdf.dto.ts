import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * EPIC-029 E6 — the page cap, re-declared on the server.
 *
 * The browser applies the same bound in `statement-pdf.ts` before it spends
 * anything, but the bound that MATTERS is this one: the family's AI key pays
 * for what reaches the endpoint, and a client-side cap is a suggestion.
 */
export const MAX_STATEMENT_PDF_PAGES = 40;

/**
 * Total extracted characters accepted across all pages.
 *
 * Coupled to `DEFAULT_JSON_BODY_BYTES` (512 KiB) in
 * `common/http/body-limits.ts`: this payload rides the DEFAULT JSON parser,
 * not the scan route's larger one, so the cap must leave room for JSON
 * escaping and the envelope. 200,000 characters of statement text is ~2.6x
 * under that ceiling even allowing for multi-byte characters, and is roughly
 * 20x the 9,552 characters the 5-page reference statement produces.
 */
export const MAX_STATEMENT_PDF_TEXT_CHARS = 200_000;

/**
 * EPIC-029 E8/E9/E10 — what the browser sends for a statement PDF.
 *
 * Note what is NOT here: the file, and the password. `pdfjs-dist` decrypts
 * for reading only and cannot emit a decrypted PDF, so the extraction runs
 * in the tab and only the resulting TEXT travels. Indonesian e-statement
 * passwords are date-of-birth / account-number / KTP digits — PII, and
 * reused — so there is deliberately no field here that could carry one, and
 * no request handling, log or crash report that could leak one.
 */
export class ReadStatementPdfDto {
  @ApiProperty({ example: "e-Statement Juli 2026.pdf" })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: MAX_STATEMENT_PDF_PAGES })
  @IsInt()
  @Min(1)
  @Max(MAX_STATEMENT_PDF_PAGES)
  pageCount!: number;

  @ApiProperty({
    description: "Extracted text layer, one entry per page, in page order.",
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STATEMENT_PDF_PAGES)
  @IsString({ each: true })
  // Per-entry ceiling; the sum across pages is checked in the service, where
  // a refusal can carry its own actionable code.
  @MaxLength(MAX_STATEMENT_PDF_TEXT_CHARS, { each: true })
  pages!: string[];
}
