import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

import { CreateInheritanceAssetDto } from "./create-inheritance-asset.dto";

// TS review fix #2 — `assetId` is omitted from the base before `PartialType`
// so it can be re-declared below as `string | null` (a plain re-declaration,
// not a class-property override, which TS would otherwise reject since
// `string | null` is not assignable to the base's `string | undefined`).
export class UpdateInheritanceAssetDto extends PartialType(
  OmitType(CreateInheritanceAssetDto, ["assetId"] as const),
) {
  // Explicit `null` clears a previously picked Asset link (switching back to
  // manual entry); omitting the field leaves the existing link untouched.
  // `@IsOptional()` already treats `null` like `undefined` and skips
  // `@IsString()`, so no extra validator is needed.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  assetId?: string | null;
}
