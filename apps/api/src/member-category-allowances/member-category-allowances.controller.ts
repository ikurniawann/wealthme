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

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

import { MemberCategoryAllowanceResponseDto } from "./dto/member-category-allowance-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetMemberCategoryAllowanceDto } from "./dto/set-member-category-allowance.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MemberCategoryAllowancesService } from "./member-category-allowances.service";

import type { Request } from "express";

@ApiTags("member-category-allowances")
@ApiBearerAuth()
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
   * OWN allow-list, never another member's. Owner/admin_staff ("manage")
   * bypass this — they may inspect anyone's.
   */
  private assertSelfOrOwner(req: Request, memberId: string): void {
    const member = req.tenantContext?.member;
    if (!member) throw new ForbiddenException("Access denied");
    const isElevated = member.role === "owner" || member.role === "admin_staff";
    if (!isElevated && member.id !== memberId) {
      throw new ForbiddenException("Access denied");
    }
  }
}
