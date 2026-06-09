import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class ScanReceiptDto {
  @ApiProperty({ type: String, description: "Base64-encoded image" })
  @IsString()
  @MaxLength(2_097_152)
  imageBase64!: string;
}
