import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ApproveAllowanceRequestDto {
  @ApiProperty({
    type: String,
    description:
      "Owner-chosen source account (e.g. the family master account) to debit",
  })
  @IsUUID()
  fromAccountId!: string;
}
