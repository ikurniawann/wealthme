import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiKeyService } from "./ai-key.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetAiKeyDto } from "./dto/set-ai-key.dto";

import type { AiKeyStatusDto } from "./ai-key.service";

/**
 * EPIC-023 G3 (D16) — the raw key is never accepted or returned outside a
 * PUT body / never returned at all: every response here is a
 * configured/not-configured indicator plus a masked hint, matching the
 * task's explicit constraint.
 */
@ApiTags("ai-advisor")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/ai-key")
export class AiKeyController {
  constructor(private readonly aiKeyService: AiKeyService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "AiKey"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Get whether an AI provider key is configured (never the key itself)",
  })
  getStatus(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<AiKeyStatusDto> {
    return this.aiKeyService.getStatus(familyGroupId);
  }

  @Put()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "AiKey"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Set (or replace) the family's AI provider key",
  })
  setKey(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: SetAiKeyDto,
  ): Promise<AiKeyStatusDto> {
    return this.aiKeyService.setKey(familyGroupId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "AiKey"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Remove the family's AI provider key" })
  deleteKey(@Param("familyGroupId") familyGroupId: string): Promise<void> {
    return this.aiKeyService.deleteKey(familyGroupId);
  }
}
