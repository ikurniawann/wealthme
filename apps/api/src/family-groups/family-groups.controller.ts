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
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { type Request as ExpressRequest } from "express";

import { type JwtPayload } from "../auth/strategies/jwt.strategy";
import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateFamilyGroupDto } from "./dto/create-family-group.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { FamilyGroupResponseDto } from "./dto/family-group-response.dto";
import { GoldPriceResponseDto } from "./dto/gold-price-response.dto";
import { InvitationResponseDto } from "./dto/invitation-response.dto";
import { MemberResponseDto } from "./dto/member-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateGoldPriceDto } from "./dto/update-gold-price.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FamilyGroupsService } from "./family-groups.service";

interface AuthRequest extends ExpressRequest {
  user: JwtPayload;
}

@ApiTags("family-groups")
@ApiBearerAuth()
@Controller("family-groups")
export class FamilyGroupsController {
  constructor(private readonly familyGroupsService: FamilyGroupsService) {}

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

  @Patch(":familyGroupId/gold-price")
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
    return this.familyGroupsService.updateGoldPrice(
      familyGroupId,
      req.user.sub,
      dto,
    );
  }

  @Patch(":familyGroupId/members/:memberId")
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
    return this.familyGroupsService.updateMemberRole(
      familyGroupId,
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
