import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";

export class ZakatRequestDto {
  @ApiProperty({ description: "Total cash holdings (IDR)" })
  @IsNumber()
  @Min(0)
  cash!: number;

  @ApiProperty({ description: "Total investment value (IDR)" })
  @IsNumber()
  @Min(0)
  investments!: number;

  @ApiProperty({ description: "Total gold value (IDR)" })
  @IsNumber()
  @Min(0)
  gold!: number;

  @ApiProperty({ description: "Total liabilities / debts (IDR)" })
  @IsNumber()
  @Min(0)
  liabilities!: number;
}

export class ZakatResultDto {
  @ApiProperty()
  zakatable!: number;

  @ApiProperty()
  nisab!: number;

  @ApiProperty()
  zakat!: number;

  @ApiProperty()
  isObligated!: boolean;
}
