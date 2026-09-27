import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import type { TaxRuleRefDto } from "@wealthme/contracts";

export class TaxRecordResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() taxYear!: number;
  @ApiProperty() grossIncome!: string;
  @ApiProperty() ptkp!: string;
  @ApiProperty() zakatDeduction!: string;
  @ApiProperty() netTax!: string;
  @ApiProperty() sptStatus!: string;
  @ApiPropertyOptional() documentUrl!: string | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ enum: ["legacy", "detailed"] }) calcMode!:
    | "legacy"
    | "detailed";
  @ApiPropertyOptional({ enum: ["TK", "K", "KI"], nullable: true })
  maritalStatus!: "TK" | "K" | "KI" | null;
  @ApiPropertyOptional({ nullable: true }) dependents!: number | null;
  @ApiPropertyOptional({ nullable: true }) pensionContribution!: string | null;
  @ApiPropertyOptional({ nullable: true }) freelanceGross!: string | null;
  @ApiPropertyOptional({ nullable: true }) nppnRateBps!: number | null;
  @ApiPropertyOptional({ nullable: true }) otherNetIncome!: string | null;
  @ApiPropertyOptional({ nullable: true }) withheldPph21!: string | null;
  @ApiProperty({ description: "netTax − (withheldPph21 ?? 0)" })
  balance!: string;
  @ApiPropertyOptional({ nullable: true }) sptFiledAt!: string | null;
  @ApiProperty({ type: () => Object, isArray: true }) rules!: TaxRuleRefDto[];
}
