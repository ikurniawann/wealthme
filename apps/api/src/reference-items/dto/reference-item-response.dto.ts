import { ApiProperty } from "@nestjs/swagger";
import { ReferenceItemGroup } from "@prisma/client";

export class ReferenceItemResponseDto {
  @ApiProperty({ type: String, description: "Reference item UUID" })
  id!: string;

  @ApiProperty({ type: String, description: "Family group UUID" })
  familyGroupId!: string;

  @ApiProperty({ enum: ReferenceItemGroup, description: "Reference list" })
  group!: ReferenceItemGroup;

  @ApiProperty({ type: String, description: "Item label" })
  label!: string;

  @ApiProperty({ type: Number, description: "Display order within the group" })
  sortOrder!: number;

  @ApiProperty({
    type: Boolean,
    description:
      "Seeded default (true) — cannot be deleted. Owner-added items are false.",
  })
  isSystem!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
