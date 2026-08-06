import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { CreateParticipantDto } from "./create-participant.dto";

export class CreateSplitBillDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: "Total amount in smallest currency unit" })
  @IsInt()
  @Min(1)
  totalAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // EPIC-023 F3 (D21) — the account (in the SAME family group, checked in
  // SplitBillsService.create) that receives transfers for this bill: shown
  // to every recipient via their own share link ("how to pay"), and
  // credited for real once the owner confirms a participant's claim.
  @ApiProperty({
    description: "Account that receives transfers for this split bill",
  })
  @IsString()
  @IsUUID()
  payoutAccountId!: string;

  @ApiPropertyOptional({
    description:
      "Free-text payment instructions shown alongside the account (e.g. an e-wallet number)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  payoutInstructions?: string;

  @ApiProperty({ type: [CreateParticipantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @Type(() => CreateParticipantDto)
  participants!: CreateParticipantDto[];
}
