import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Put,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Role } from "@prisma/client";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

import { MemberCategoryAllowanceResponseDto } from "./dto/member-category-allowance-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetMemberCategoryAllowanceDto } from "./dto/set-member-category-allowance.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MemberCategoryAllowancesService } from "./member-category-allowances.service";

import type { Request } from "express";

@ApiTags("member-category-allowances")
@ApiBearerAuth()
@PageAccess("member-category-allowances")
@Controller(
  "family-groups/:familyGroupId/members/:memberId/category-allowances",
)
export class MemberCategoryAllowancesController {
  constructor(
    private readonly memberCategoryAllowancesService: MemberCategoryAllowancesService,
  ) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "MemberCategoryAllowance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "memberId", type: String })
  @ApiOperation({
    summary: "Get a member's allowed expense categories (empty = unrestricted)",
  })
  @ApiResponse({ status: 200, type: MemberCategoryAllowanceResponseDto })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
    @Req() req: Request,
  ): Promise<MemberCategoryAllowanceResponseDto> {
    this.assertSelfOrOwner(req, memberId);
    return this.memberCategoryAllowancesService.findAll(
      familyGroupId,
      memberId,
    );
  }

  @Put()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "MemberCategoryAllowance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "memberId", type: String })
  @ApiOperation({
    summary:
      "Replace a member's allowed expense category set (owner only, per CASL manage)",
  })
  @ApiResponse({ status: 200, type: MemberCategoryAllowanceResponseDto })
  replace(
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
    @Body() dto: SetMemberCategoryAllowanceDto,
  ): Promise<MemberCategoryAllowanceResponseDto> {
    return this.memberCategoryAllowancesService.replace(
      familyGroupId,
      memberId,
      dto,
    );
  }

  /**
   * CASL's "read" grant is role-level, not row-level: a plain `member` may
   * "read" MemberCategoryAllowance in general, but must only ever see their
   * OWN allow-list, never another member's. Owner (full "manage"),
   * admin_staff (elevated "read"-only bypass, pre-existing), and spouse
   * (full "manage", D2) all bypass this row check — they may inspect
   * anyone's.
   *
   * EPIC-023 Task C retry (HIGH six-reviewer finding) — `spouse` holds
   * "manage MemberCategoryAllowance" (D2) and can blindly PUT another
   * member's allow-list with no per-row check, but was missing here, so
   * they were 403'd reading the very allow-list they can already overwrite.
   * This closes that asymmetry.
   */
  private assertSelfOrOwner(req: Request, memberId: string): void {
    const member = req.tenantContext?.member;
    if (!member) throw new ForbiddenException("Access denied");
    const isElevated =
      member.role === Role.owner ||
      member.role === Role.admin_staff ||
      member.role === Role.spouse;
    if (!isElevated && member.id !== memberId) {
      throw new ForbiddenException("Access denied");
    }
  }
}
