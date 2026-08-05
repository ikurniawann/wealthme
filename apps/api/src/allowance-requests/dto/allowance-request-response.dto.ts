import { ApiProperty } from "@nestjs/swagger";
import { AllowanceRequestKind, AllowanceRequestStatus } from "@prisma/client";

export class AllowanceRequestResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  // EPIC-023 Task D (D3/D9) — discriminates what approving this row DOES:
  // `funding` (every pre-existing row) executes a transfer; `held_expense`
  // replays a held expense. See schema.prisma's AllowanceRequest comment
  // for the field meaning under each kind.
  @ApiProperty({ enum: AllowanceRequestKind })
  kind!: AllowanceRequestKind;

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

  // EPIC-023 Task D (D3/D9) — held_expense only; always null for funding.
  @ApiProperty({ type: String, nullable: true })
  categoryId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  categoryName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

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
