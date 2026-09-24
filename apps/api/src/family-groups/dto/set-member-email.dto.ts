import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

// EPIC-031 — null clears the pending address.
export class SetMemberEmailDto {
  @ApiProperty({ type: String, nullable: true, example: "budi@gmail.com" })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEmail()
  @MaxLength(254)
  email!: string | null;
}

export class ConfirmMemberEmailDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  token!: string;
}
