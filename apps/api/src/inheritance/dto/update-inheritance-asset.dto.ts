import { PartialType } from "@nestjs/swagger";

import { CreateInheritanceAssetDto } from "./create-inheritance-asset.dto";

export class UpdateInheritanceAssetDto extends PartialType(
  CreateInheritanceAssetDto,
) {}
