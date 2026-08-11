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
import { Throttle } from "@nestjs/throttler";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfirmParticipantDto } from "./dto/confirm-participant.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateSplitBillDto } from "./dto/create-split-bill.dto";
import { PublicSplitParticipantResponseDto } from "./dto/public-split-participant-response.dto";
import {
  SplitBillResponseDto,
  SplitParticipantResponseDto,
} from "./dto/split-bill-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdatePayoutAccountDto } from "./dto/update-payout-account.dto";
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

  // Group F (task F3) — repairs a bill with a null/deleted payoutAccountId.
  // create() requires an account up front, so legacy bills that predate F3
  // (or whose account was later deleted) had no way to be fixed. Same
  // "manage" grant as every other write on this subject.
  @Patch("family-groups/:familyGroupId/split-bills/:id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "SplitBill"))
  @ApiBearerAuth()
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Set/repair a split bill's payout account" })
  @ApiResponse({ status: 200, type: SplitBillResponseDto })
  @ApiResponse({ status: 404, description: "Split bill not found" })
  updatePayoutAccount(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdatePayoutAccountDto,
  ): Promise<SplitBillResponseDto> {
    return this.splitBillsService.updatePayoutAccount(familyGroupId, id, dto);
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

  // EPIC-023 F3 (D21) — "revocable": kills every participant's public
  // share link for this bill at once. Owner/spouse/member only (same
  // "manage" grant as every other write on this subject).
  @Patch("family-groups/:familyGroupId/split-bills/:id/revoke")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "SplitBill"))
  @ApiBearerAuth()
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary: "Revoke every participant's share link for this bill",
  })
  @ApiResponse({ status: 200, type: SplitBillResponseDto })
  @ApiResponse({ status: 404, description: "Split bill not found" })
  revoke(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<SplitBillResponseDto> {
    return this.splitBillsService.revoke(familyGroupId, id);
  }

  // EPIC-023 F3 (D21) — renamed from "settle": this now posts a REAL
  // Transaction crediting the bill's payout account (see
  // SplitBillsService.confirmParticipant), not just a status flip. "The
  // owner confirms, and only then does it become real income."
  @Patch(
    "family-groups/:familyGroupId/split-bills/:id/participants/:participantId/confirm",
  )
  @CheckAbility((ab: AppAbility) => ab.can("manage", "SplitBill"))
  @ApiBearerAuth()
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "participantId", type: String })
  @ApiOperation({
    summary:
      "Confirm a participant paid: posts real income to the bill's payout account",
  })
  @ApiResponse({ status: 200, type: SplitParticipantResponseDto })
  @ApiResponse({
    status: 404,
    description: "Split bill or participant not found",
  })
  confirmParticipant(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") splitId: string,
    @Param("participantId") participantId: string,
    @Body() dto: ConfirmParticipantDto,
  ): Promise<SplitParticipantResponseDto> {
    return this.splitBillsService.confirmParticipant(
      familyGroupId,
      splitId,
      participantId,
      dto,
    );
  }

  // EPIC-023 F3 (D21) — PUBLIC, unauthenticated: identified by THIS
  // participant's own `shareToken`, never the family group, never a
  // bill-wide secret, never another participant's data — see
  // SplitBillsService.getPublicParticipant. No `:familyGroupId` param, so
  // TenantGuard passes it through untouched and AbilitiesGuard's fail-open
  // (no `@CheckAbility` handlers) is exactly the intended "public" shape.
  // Throttled tighter than the global default (100/min) since a share
  // token is the only access control this route has — a wide-open budget
  // would make token-guessing/enumeration cheap to attempt.
  @Get("split-bills/participant/:token")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: "Get one participant's own share (public)" })
  @ApiResponse({ status: 200, type: PublicSplitParticipantResponseDto })
  @ApiResponse({ status: 404, description: "Link not found" })
  @ApiResponse({ status: 410, description: "Link has been revoked" })
  getPublicParticipant(
    @Param("token") token: string,
  ): Promise<PublicSplitParticipantResponseDto> {
    return this.splitBillsService.getPublicParticipant(token);
  }

  // EPIC-023 F3 (D21) — PUBLIC, unauthenticated: the "saya sudah transfer"
  // claim. Moves NO money — see SplitBillsService.claimParticipant.
  // Throttled tighter still: this is a write, not just a read.
  @Patch("split-bills/participant/:token/claim")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: "Claim 'I already transferred' (public, posts no money)",
  })
  @ApiResponse({ status: 200, type: PublicSplitParticipantResponseDto })
  @ApiResponse({ status: 404, description: "Link not found" })
  @ApiResponse({ status: 409, description: "Already confirmed paid" })
  @ApiResponse({ status: 410, description: "Link has been revoked" })
  claimParticipant(
    @Param("token") token: string,
  ): Promise<PublicSplitParticipantResponseDto> {
    return this.splitBillsService.claimParticipant(token);
  }
}
