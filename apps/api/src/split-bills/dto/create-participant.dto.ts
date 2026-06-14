import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, MaxLength, Min } from "class-validator";

export class CreateParticipantDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: "Amount owed in smallest currency unit (cents/rupiah)",
  })
  @IsInt()
  @Min(0)
  amountOwed!: number;
}
