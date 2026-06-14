import { ApiProperty } from "@nestjs/swagger";

export class ConsentUrlDto {
  @ApiProperty() url!: string;
  @ApiProperty() sessionId!: string;
}

export class OBAccountDto {
  @ApiProperty() externalId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: string;
  @ApiProperty() balance!: number;
  @ApiProperty() currency!: string;
}

export class OBTransactionDto {
  @ApiProperty() externalId!: string;
  @ApiProperty() date!: string;
  @ApiProperty() description!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
}
