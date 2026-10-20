import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  InsurancePolicyType,
  InsuranceStatus,
  InsuranceType,
} from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

import { IsUserId } from "../../common/decorators/is-user-id.decorator";

/** Asuransi Task 22 — list filters (spec §2). All optional, AND-ed. */
export class ListInsurancesQueryDto {
  @ApiPropertyOptional({ description: "Search name, provider, policy number" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUserId()
  holderUserId?: string;

  @ApiPropertyOptional({ description: "Insured family member" })
  @IsOptional()
  @IsUserId()
  insuredUserId?: string;

  @ApiPropertyOptional({ description: "Provider (case-insensitive contains)" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  provider?: string;

  @ApiPropertyOptional({ enum: InsuranceType })
  @IsOptional()
  @IsEnum(InsuranceType)
  type?: InsuranceType;

  @ApiPropertyOptional({
    enum: [...Object.values(InsurancePolicyType), "unset"],
    description: "unset = belum ditentukan",
  })
  @IsOptional()
  @IsIn([...Object.values(InsurancePolicyType), "unset"])
  policyType?: InsurancePolicyType | "unset";

  @ApiPropertyOptional({ enum: InsuranceStatus })
  @IsOptional()
  @IsEnum(InsuranceStatus)
  status?: InsuranceStatus;

  @ApiPropertyOptional({ description: "nextPremiumDueDate from (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ description: "nextPremiumDueDate to (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}

/** Summary period; defaults to the current calendar month (Asia/Jakarta). */
export class InsuranceSummaryQueryDto {
  @ApiPropertyOptional({ description: "YYYY-MM-DD" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: "YYYY-MM-DD (inclusive)" })
  @IsOptional()
  @IsDateString()
  to?: string;
}
