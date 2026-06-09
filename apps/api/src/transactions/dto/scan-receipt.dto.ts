import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ScanReceiptDto {
  @ApiProperty({ type: String, description: "Base64-encoded image" })
  @IsString()
  imageBase64!: string;
}
