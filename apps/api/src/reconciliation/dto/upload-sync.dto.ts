import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class ParsedRowDto {
  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class UploadSyncDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedRowDto)
  rows!: ParsedRowDto[];
}
