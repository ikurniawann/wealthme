import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateSplitBillDto } from "./dto/create-split-bill.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SettleParticipantDto } from "./dto/settle-participant.dto";
import {
  SplitBillResponseDto,
  SplitParticipantResponseDto,
} from "./dto/split-bill-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SplitBillsService } from "./split-bills.service";

@ApiTags("split-bills")
@Controller()
export class SplitBillsController {
  constructor(private readonly splitBillsService: SplitBillsService) {}

  // EPIC-023 Task C retry (CRITICAL six-reviewer finding) — this whole
  // controller carried no `@CheckAbility`, so `AbilitiesGuard` waved every
  // route through for every role (including `dependant`/`operational`, who
  // must have no SplitBill access — see casl-ability.factory.ts). Gate
  // reads on "read" and writes on "manage" now that SplitBill has real
  // grants: owner/spouse/member get "manage", admin_staff gets "read" only,
  // dependant/operational get nothing.
  @Get("family-groups/:familyGroupId/split-bills")
  @CheckAbility((ab: AppAbility) => ab.can("read", "SplitBill"))
  @ApiBearerAuth()
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all split bills for a family group" })
  @ApiResponse({ status: 200, type: [SplitBillResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<SplitBillResponseDto[]> {
    return this.splitBillsService.findAll(familyGroupId);
  }

  @Post("family-groups/:familyGroupId/split-bills")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "SplitBill"))
  @ApiBearerAuth()
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a new split bill" })
  @ApiResponse({ status: 201, type: SplitBillResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateSplitBillDto,
  ): Promise<SplitBillResponseDto> {
    return this.splitBillsService.create(familyGroupId, dto);
  }

  @Get("family-groups/:familyGroupId/split-bills/:id")
  @CheckAbility((ab: AppAbility) => ab.can("read", "SplitBill"))
  @ApiBearerAuth()
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Get a single split bill" })
  @ApiResponse({ status: 200, type: SplitBillResponseDto })
  @ApiResponse({ status: 404, description: "Split bill not found" })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<SplitBillResponseDto> {
    return this.splitBillsService.findOne(familyGroupId, id);
  }

  @Delete("family-groups/:familyGroupId/split-bills/:id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "SplitBill"))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a split bill" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Split bill not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.splitBillsService.remove(familyGroupId, id);
  }

  @Patch(
    "family-groups/:familyGroupId/split-bills/:id/participants/:participantId/settle",
  )
  @CheckAbility((ab: AppAbility) => ab.can("manage", "SplitBill"))
  @ApiBearerAuth()
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "participantId", type: String })
  @ApiOperation({ summary: "Mark a participant as paid" })
  @ApiResponse({ status: 200, type: SplitParticipantResponseDto })
  @ApiResponse({
    status: 404,
    description: "Split bill or participant not found",
  })
  settleParticipant(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") splitId: string,
    @Param("participantId") participantId: string,
    @Body() _dto: SettleParticipantDto,
  ): Promise<SplitParticipantResponseDto> {
    return this.splitBillsService.settleParticipant(
      familyGroupId,
      splitId,
      participantId,
    );
  }

  @Get("split-bills/share/:token")
  @Public()
  @ApiOperation({ summary: "Get split bill by share token (public)" })
  @ApiResponse({ status: 200, type: SplitBillResponseDto })
  @ApiResponse({ status: 404, description: "Split bill not found" })
  getByShareToken(
    @Param("token") token: string,
  ): Promise<SplitBillResponseDto> {
    return this.splitBillsService.getByShareToken(token);
  }
}
