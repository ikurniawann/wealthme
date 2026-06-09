import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({
    example: "user@example.com",
    description: "User email address",
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: "strongPass123",
    minLength: 8,
    description: "Password (min 8 characters)",
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: "Jane Doe",
    description: "Display name (min 2 characters)",
  })
  @IsString()
  @MinLength(2)
  name!: string;
}
