import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, MaxLength, Min } from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";

export class CreateParticipantDto {
  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: "Amount owed in smallest currency unit (cents/rupiah)",
  })
  @IsInt()
  @Min(0)
  amountOwed!: number;
}
