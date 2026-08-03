import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

// EPIC-019 Task A — "mine vs family" lens on the accounts list.
export enum AccountOwnerFilter {
  me = "me",
  family = "family",
  all = "all",
}

export class ListAccountsQueryDto {
  @ApiPropertyOptional({
    enum: AccountOwnerFilter,
    default: AccountOwnerFilter.all,
    description:
      "me = only accounts owned by the caller; family = only family-shared (ownerUserId null) accounts; all = today's behavior (default)",
  })
  @IsEnum(AccountOwnerFilter)
  @IsOptional()
  owner?: AccountOwnerFilter;
}
