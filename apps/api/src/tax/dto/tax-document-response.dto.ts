import { ApiProperty } from "@nestjs/swagger";

export class TaxDocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() taxYear!: number;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
  @ApiProperty() createdAt!: string;
}
