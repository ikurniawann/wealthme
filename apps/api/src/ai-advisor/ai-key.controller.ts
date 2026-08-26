import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiKeyService } from "./ai-key.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetAiKeyDto } from "./dto/set-ai-key.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetAiModelDto } from "./dto/set-ai-model.dto";

import type { AiKeyStatusDto } from "./ai-key.service";
import type { ProviderModel } from "./provider-models.util";

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
    description:
      "EPIC-027 B5 (D11) — also reports `scanAvailable`: receipt OCR runs on this same family key, so the client checks this before offering a scan button.",
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

  @Get("models")
  @CheckAbility((ab: AppAbility) => ab.can("read", "AiKey"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "List the models this family's key can currently use",
    description:
      "Asked of the provider with the family's own key, never hardcoded — a baked-in list is wrong as soon as a model ships or is retired, and it would also not reflect what this particular key is entitled to. The key is used for the catalogue call only and never returned.",
  })
  @ApiResponse({ status: 200, description: "Usable models, newest first" })
  @ApiResponse({ status: 404, description: "No AI provider key configured" })
  listModels(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<ProviderModel[]> {
    return this.aiKeyService.listModels(familyGroupId);
  }

  @Patch("model")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "AiKey"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Choose which model of the configured provider WealthMe uses",
    description:
      "Send `model: null` to go back to the WealthMe default. Changing the KEY clears this choice, because a model id belongs to one provider.",
  })
  @ApiResponse({ status: 404, description: "No AI provider key configured" })
  setModel(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: SetAiModelDto,
  ): Promise<AiKeyStatusDto> {
    return this.aiKeyService.setModel(familyGroupId, dto.model ?? null);
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
