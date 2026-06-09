import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsUUID } from "class-validator";

export class MarkReadDto {
  @ApiPropertyOptional({
    type: [String],
    description: "IDs to mark read; omit to mark all",
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  ids?: string[];
}
