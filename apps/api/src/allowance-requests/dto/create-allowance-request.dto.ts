import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateAllowanceRequestDto {
  @ApiProperty({
    type: String,
    description: "The requester's OWN account to be funded",
  })
  @IsUUID()
  targetAccountId!: string;

  @ApiProperty({
    type: Number,
    description: "Requested amount in smallest currency unit",
  })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ type: String, description: "Optional note" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
