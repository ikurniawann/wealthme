import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class ChatMessageDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}

export class ChatRequestDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  // The saved session this turn belongs to. Omitted on the first turn of a
  // new chat — the server creates the session and returns its id on the
  // `done` event, which the client then sends back on every later turn.
  @ApiPropertyOptional({
    description:
      "Existing conversation to append this exchange to. Omit to start a new one.",
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
