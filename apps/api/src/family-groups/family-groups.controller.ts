import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { type Request as ExpressRequest } from "express";

import { type JwtPayload } from "../auth/strategies/jwt.strategy";
import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { Public } from "../common/decorators/public.decorator";
import { FX_FIELD_SPECS } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateDependantMemberDto } from "./dto/create-dependant-member.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateFamilyGroupDto } from "./dto/create-family-group.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { DependantMemberResponseDto } from "./dto/dependant-member-response.dto";
import { FamilyGroupResponseDto } from "./dto/family-group-response.dto";
import { FamilyReligionResponseDto } from "./dto/family-religion-response.dto";
import { GoldPriceResponseDto } from "./dto/gold-price-response.dto";
import { InvitationResponseDto } from "./dto/invitation-response.dto";
import { MemberResponseDto } from "./dto/member-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ResetMemberPasswordDto } from "./dto/reset-member-password.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  ConfirmMemberEmailDto,
  SetMemberEmailDto,
} from "./dto/set-member-email.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateFamilyReligionDto } from "./dto/update-family-religion.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateGoldPriceDto } from "./dto/update-gold-price.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateLoginHandleDto } from "./dto/update-login-handle.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FamilyGroupsService } from "./family-groups.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MemberEmailService } from "./member-email.service";

interface AuthRequest extends ExpressRequest {
  user: JwtPayload;
}

@ApiTags("family-groups")
@ApiBearerAuth()
@PageAccess("family-groups")
@Controller("family-groups")
export class FamilyGroupsController {
  constructor(
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly memberEmail: MemberEmailService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get("mine")
  @ApiOperation({ summary: "List family groups the current user belongs to" })
  @ApiResponse({ status: 200, type: [FamilyGroupResponseDto] })
  findMine(@Request() req: AuthRequest): Promise<FamilyGroupResponseDto[]> {
    return this.familyGroupsService.findMine(req.user.sub);
  }

  @Post()
  @ApiOperation({ summary: "Create a new family group (caller becomes owner)" })
  @ApiResponse({ status: 201, type: FamilyGroupResponseDto })
  create(
    @Request() req: AuthRequest,
    @Body() dto: CreateFamilyGroupDto,
  ): Promise<FamilyGroupResponseDto> {
    return this.familyGroupsService.create(req.user.sub, dto);
  }

  // EPIC-023 Task C retry (HIGH six-reviewer finding) — this route carried
  // no `@CheckAbility`; the service only calls `assertMember` (passes for
  // ANY role), so a `dependant`/`operational` could fetch every member's
  // name/email/role/kinship despite CASL explicitly denying them
  // "read Member" (see casl-ability.factory.spec.ts).
  @Get(":familyGroupId/members")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Member"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List members of a family group" })
  @ApiResponse({ status: 200, type: [MemberResponseDto] })
  listMembers(
    @Param("familyGroupId") familyGroupId: string,
    @Request() req: AuthRequest,
  ): Promise<MemberResponseDto[]> {
    return this.familyGroupsService.listMembers(familyGroupId, req.user.sub);
  }

  @Get(":familyGroupId/gold-price")
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Get the family's manually-entered gold price per gram (null until an owner sets one)",
  })
  @ApiResponse({ status: 200, type: GoldPriceResponseDto })
  getGoldPrice(
    @Param("familyGroupId") familyGroupId: string,
    @Request() req: AuthRequest,
  ): Promise<GoldPriceResponseDto> {
    return this.familyGroupsService.getGoldPrice(familyGroupId, req.user.sub);
  }

  // EPIC-023 F2 (D20) — unlike getGoldPrice/updateGoldPrice above (a known,
  // pre-existing gap — AbilitiesGuard fails OPEN on an undecorated route),
  // this NEW route is explicitly decorated so it never depends on that gap.
  @Get(":familyGroupId/religion")
  @CheckAbility((ab: AppAbility) => ab.can("read", "FamilyGroup"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Get the family's religion setting (drives which donation calculator — zakat/perpuluhan/neither — is shown)",
  })
  @ApiResponse({ status: 200, type: FamilyReligionResponseDto })
  getReligion(
    @Param("familyGroupId") familyGroupId: string,
    @Request() req: AuthRequest,
  ): Promise<FamilyReligionResponseDto> {
    return this.familyGroupsService.getReligion(familyGroupId, req.user.sub);
  }

  // EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head creates a dependant/
  // operational member directly (name + username + initial password, no
  // email). Gated on the "manage Member" ability, which per D2 ("a spouse
  // is a full financial co-owner EXCEPT 'manage' of Member itself — one
  // accountable head stays responsible for who is in the family") and
  // casl-ability.factory.ts's `spouse` case is owner-only: spouse holds only
  // "read Member", never "manage". FIX 3 correction — an earlier version of
  // this comment incorrectly claimed spouse held the same "manage Member"
  // ability; it does not, and the frontend button is gated owner-only to
  // match (apps/web/src/app/(app)/akun/page.tsx).
  @Post(":familyGroupId/members/dependant")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Create a dependant/operational member with a username + initial password (no email; forced password change at first login)",
  })
  @ApiResponse({ status: 201, type: DependantMemberResponseDto })
  async createDependantMember(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateDependantMemberDto,
  ): Promise<DependantMemberResponseDto> {
    // `req.tenantContext.familyGroupId` is TenantGuard's own verified copy
    // of the URL param (only set once a Member row for THIS caller + THIS
    // group was found) — used here instead of the raw `@Param` so the
    // service never trusts a client-supplied value directly, per this
    // task's tenant-scoping requirement.
    const tenantFamilyGroupId = req.tenantContext?.familyGroupId;
    if (!tenantFamilyGroupId || tenantFamilyGroupId !== familyGroupId) {
      throw new ForbiddenException("Access denied");
    }
    const created = await this.familyGroupsService.createDependantMember(
      tenantFamilyGroupId,
      dto,
    );
    // EPIC-031 — an email is only attached after its owner confirms it.
    if (dto.email) {
      await this.memberEmail.startConfirmation(created.userId, dto.email);
      return { ...created, pendingEmail: dto.email.trim().toLowerCase() };
    }
    return created;
  }

  @Put(":familyGroupId/members/:memberId/email")
  // Sends mail to an address the Master typed — keep it far below the global limit.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "memberId", type: String })
  @ApiOperation({
    summary:
      "Set (and email a confirmation link to) or clear a Master-created member's email (owner only)",
  })
  setMemberEmail(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
    @Body() dto: SetMemberEmailDto,
  ): Promise<{ pendingEmail: string | null }> {
    return this.memberEmail.setForMember(
      familyGroupId,
      memberId,
      req.user.sub,
      dto.email ?? null,
    );
  }

  /** Public — the mailbox owner confirms from the link in the email. */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post("member-email/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm a member email from its emailed link" })
  confirmMemberEmail(
    @Body() dto: ConfirmMemberEmailDto,
  ): Promise<{ email: string }> {
    return this.memberEmail.confirm(dto.token);
  }

  // EPIC-031 — "kode keluarga" used in members' `username@kode` login IDs.
  @Get(":familyGroupId/login-handle")
  @CheckAbility((ab: AppAbility) => ab.can("read", "FamilyGroup"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "The family's login handle (kode keluarga)" })
  getLoginHandle(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<{ handle: string }> {
    return this.familyGroupsService.getLoginHandle(familyGroupId, req.user.sub);
  }

  @Patch(":familyGroupId/login-handle")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "FamilyGroup"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Rename the kode keluarga; rewrites every Master-created login ID (owner only)",
  })
  updateLoginHandle(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: UpdateLoginHandleDto,
  ): Promise<{ handle: string }> {
    return this.familyGroupsService.updateLoginHandle(
      familyGroupId,
      req.user.sub,
      dto.handle,
    );
  }

  @Patch(":familyGroupId/gold-price")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "FamilyGroup"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Set the family's manually-entered gold price per gram (owner only)",
  })
  @ApiResponse({ status: 200, type: GoldPriceResponseDto })
  updateGoldPrice(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: UpdateGoldPriceDto,
  ): Promise<GoldPriceResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.user.sub,
        entity: "FamilyGroup",
        entityId: familyGroupId,
        fieldPrefix: "goldPrice",
        dto,
        spec: FX_FIELD_SPECS.goldPrice,
      },
      (converted) =>
        this.familyGroupsService.updateGoldPrice(
          familyGroupId,
          req.user.sub,
          converted,
        ),
    );
  }

  // EPIC-023 F2 (D20) — explicitly decorated for the same reason getReligion
  // above is: this is a NEW route and must not rely on AbilitiesGuard's
  // fail-open default the way the (pre-existing) gold-price routes do.
  @Patch(":familyGroupId/religion")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "FamilyGroup"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Set the family's religion setting (owner only)",
  })
  @ApiResponse({ status: 200, type: FamilyReligionResponseDto })
  updateReligion(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: UpdateFamilyReligionDto,
  ): Promise<FamilyReligionResponseDto> {
    return this.familyGroupsService.updateReligion(
      familyGroupId,
      req.user.sub,
      dto,
    );
  }

  @Patch(":familyGroupId/members/:memberId")
  // EPIC-023 Task D (D3) — controller-level guard, not just the service's
  // assertOwner(). AbilitiesGuard fails OPEN on an undecorated route, and
  // this route is D3's threshold control surface, so the decorator is
  // defense-in-depth against a future refactor dropping the service check.
  // `manage Member` is owner-only (matches createDependantMember above).
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "memberId", type: String })
  @ApiOperation({ summary: "Change a member role (owner only)" })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  updateMemberRole(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.user.sub,
        entity: "Member",
        entityId: memberId,
        dto,
        spec: FX_FIELD_SPECS.memberThreshold,
      },
      (converted) =>
        this.familyGroupsService.updateMemberRole(
          familyGroupId,
          memberId,
          req.user.sub,
          converted,
        ),
    );
  }

  @Post(":familyGroupId/members/:memberId/password")
  @HttpCode(HttpStatus.NO_CONTENT)
  // Explicitly gated — AbilitiesGuard fails OPEN on an undecorated route.
  // The service re-checks assertOwner and that the target is a managed login.
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "memberId", type: String })
  @ApiOperation({
    summary:
      "Set a new password for a head-created (username) member (owner only)",
  })
  @ApiResponse({ status: 204 })
  resetMemberPassword(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
    @Body() dto: ResetMemberPasswordDto,
  ): Promise<void> {
    const tenantFamilyGroupId = req.tenantContext?.familyGroupId;
    if (!tenantFamilyGroupId || tenantFamilyGroupId !== familyGroupId) {
      throw new ForbiddenException("Access denied");
    }
    return this.familyGroupsService.resetMemberPassword(
      tenantFamilyGroupId,
      memberId,
      req.user.sub,
      dto,
    );
  }

  @Delete(":familyGroupId/members/:memberId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "memberId", type: String })
  @ApiOperation({
    summary: "Remove a member from the family group (owner only)",
  })
  @ApiResponse({ status: 204 })
  removeMember(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
  ): Promise<void> {
    return this.familyGroupsService.removeMember(
      familyGroupId,
      memberId,
      req.user.sub,
    );
  }

  /**
   * EPIC-027 A8 (D5) — the two halves of "Anggota Nonaktif". Both are
   * `manage Member` (owner-only, same as removal) AND re-checked by
   * `assertOwner` in the service: seeing who was removed, and undoing it, are
   * exactly as sensitive as the removal itself.
   *
   * The route is `/members/removed`, a literal segment that must not be
   * shadowed by a `/members/:memberId` parameter route.
   */
  @Get(":familyGroupId/members/removed")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List removed (soft-deleted) members (owner only)" })
  @ApiResponse({ status: 200, type: [MemberResponseDto] })
  listRemovedMembers(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<MemberResponseDto[]> {
    return this.familyGroupsService.listRemovedMembers(
      familyGroupId,
      req.user.sub,
    );
  }

  @Post(":familyGroupId/members/:memberId/restore")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "memberId", type: String })
  @ApiOperation({
    summary: "Restore a previously removed member (owner only)",
  })
  @ApiResponse({ status: 204 })
  restoreMember(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
  ): Promise<void> {
    return this.familyGroupsService.restoreMember(
      familyGroupId,
      memberId,
      req.user.sub,
    );
  }

  @Post(":familyGroupId/invitations")
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Create an invitation (owner only); returns the token",
  })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  createInvitation(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    return this.familyGroupsService.createInvitation(
      familyGroupId,
      req.user.sub,
      dto,
    );
  }

  @Get("invitations/:token")
  @Public()
  @ApiParam({ name: "token", type: String })
  @ApiOperation({
    summary: "Get invitation details by token (public, no auth)",
  })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  getInvitation(@Param("token") token: string): Promise<InvitationResponseDto> {
    return this.familyGroupsService.getInvitationByToken(token);
  }

  @Post("invitations/:token/accept")
  @ApiParam({ name: "token", type: String })
  @ApiOperation({ summary: "Accept an invitation (creates member record)" })
  @ApiResponse({ status: 201, type: MemberResponseDto })
  acceptInvitation(
    @Request() req: AuthRequest,
    @Param("token") token: string,
  ): Promise<MemberResponseDto> {
    return this.familyGroupsService.acceptInvitation(token, req.user.sub);
  }
}
