import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

const MAX_MESSAGE_LENGTH = 2000;

export class CreateFeedbackDto {
  @ApiProperty({
    type: String,
    description: "Feedback message from the user",
    maxLength: MAX_MESSAGE_LENGTH,
  })
  // Trim before validating/persisting so a whitespace-only submission (e.g.
  // a direct API call bypassing the frontend's own trim) is rejected by
  // @IsNotEmpty() below instead of silently stored as blank content.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message!: string;
}
