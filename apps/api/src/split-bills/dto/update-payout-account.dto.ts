import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

// Group F (task F3) — legacy split bills can end up with a null (or later
// deleted) payoutAccountId, since create() requires one but there was no
// way to fix it afterward. This is the repair path: same family-group
// scoping check as CreateSplitBillDto.payoutAccountId.
export class UpdatePayoutAccountDto {
  @ApiProperty({
    description: "Account that receives transfers for this split bill",
  })
  @IsString()
  @IsUUID()
  payoutAccountId!: string;
}
