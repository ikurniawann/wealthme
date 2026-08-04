import { ApiProperty } from "@nestjs/swagger";
import { AllowanceRequestStatus } from "@prisma/client";

export class AllowanceRequestResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ type: String })
  requesterUserId!: string;

  @ApiProperty({ type: String })
  requesterName!: string;

  @ApiProperty({ type: String })
  targetAccountId!: string;

  @ApiProperty({ type: String })
  targetAccountName!: string;

  @ApiProperty({ type: String, nullable: true })
  fromAccountId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  fromAccountName!: string | null;

  @ApiProperty({ type: String, description: "Amount as string (BigInt-safe)" })
  amount!: string;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ enum: AllowanceRequestStatus })
  status!: AllowanceRequestStatus;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  decidedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decidedByUserId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decidedByName!: string | null;
}
