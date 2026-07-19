import { ApiProperty } from "@nestjs/swagger";
import { AccountType } from "@prisma/client";

export class AccountResponseDto {
  @ApiProperty({ type: String, description: "Account UUID" })
  id!: string;

  @ApiProperty({ type: String, description: "Family group UUID" })
  familyGroupId!: string;

  @ApiProperty({ type: String, description: "Account display name" })
  name!: string;

  @ApiProperty({ enum: AccountType, description: "Account type" })
  type!: AccountType;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Institution name",
  })
  institution!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Masked account number",
  })
  maskedNumber!: string | null;

  @ApiProperty({
    type: String,
    description: "Current balance as string to preserve BigInt precision",
  })
  balance!: string;

  @ApiProperty({ type: String, description: "ISO 4217 currency code" })
  currency!: string;

  @ApiProperty({
    type: Boolean,
    description:
      "Hidden from `member` viewers in shared family views when true",
  })
  isPrivate!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}
