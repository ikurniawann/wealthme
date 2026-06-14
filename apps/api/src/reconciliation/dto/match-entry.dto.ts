import { IsNotEmpty, IsString } from "class-validator";

export class MatchEntryDto {
  @IsString()
  @IsNotEmpty()
  transactionId!: string;
}
