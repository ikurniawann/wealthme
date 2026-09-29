import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class PaymentPreviewQueryDto {
  @ApiProperty({
    description: "Payment amount to preview as a numeric string (whole rupiah)",
  })
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "amount must be a numeric string" })
  amount!: string;
}
