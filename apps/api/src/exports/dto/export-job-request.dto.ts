import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";

import type {
  ExportFormat,
  ExportJobRequestDto as ExportJobRequestShape,
  ExportReportType,
} from "@wealthme/contracts";

const EXPORT_REPORT_TYPES: ExportReportType[] = [
  "summary",
  "bank",
  "detail",
  "pnl",
  "balance-sheet",
  "cashflow",
];
const EXPORT_FORMATS: ExportFormat[] = ["pdf", "excel"];

/**
 * Hardening audit (validation, HIGH) — the controller used to `@Body()` the
 * `@wealthme/contracts` interface directly, imported with `import type`.
 * `ValidationPipe` only validates a real class (it needs `class-validator`
 * metadata attached to an instance), so every field arrived unchecked: a
 * non-numeric `months` became `NaN` deep in `exports.service.ts`, and a bad
 * `type`/`format`/date string silently passed through. This is a genuine
 * class, imported as a VALUE, that `ExportsController` now validates
 * against — it still satisfies the contracts shape for callers that only
 * care about the type.
 */
export class ExportJobRequestDto implements ExportJobRequestShape {
  @ApiProperty({ enum: EXPORT_REPORT_TYPES })
  @IsIn(EXPORT_REPORT_TYPES)
  type!: ExportReportType;

  @ApiProperty({ enum: EXPORT_FORMATS })
  @IsIn(EXPORT_FORMATS)
  format!: ExportFormat;

  @ApiPropertyOptional({ example: "2025-01-01" })
  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ example: "2025-12-31" })
  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
