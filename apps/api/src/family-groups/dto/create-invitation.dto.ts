import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional } from "class-validator";

export class CreateInvitationDto {
  @ApiProperty({ type: String, description: "Email address to invite" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    enum: Role,
    description: "Role to assign (defaults to member)",
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
