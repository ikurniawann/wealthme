import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
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

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AllowanceRequestsService } from "./allowance-requests.service";
import { AllowanceRequestResponseDto } from "./dto/allowance-request-response.dto";
import { type ApproveAllowanceRequestDto } from "./dto/approve-allowance-request.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateAllowanceRequestDto } from "./dto/create-allowance-request.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RejectAllowanceRequestDto } from "./dto/reject-allowance-request.dto";

import type { Request } from "express";

function requireMember(req: Request) {
  const member = req.tenantContext?.member;
  if (!member) throw new ForbiddenException("Access denied");
  return member;
}

@ApiTags("allowance-requests")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/allowance-requests")
export class AllowanceRequestsController {
  constructor(
    private readonly allowanceRequestsService: AllowanceRequestsService,
  ) {}

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("create", "AllowanceRequest"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Request funding for an account the caller owns",
  })
  @ApiResponse({ status: 201, type: AllowanceRequestResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateAllowanceRequestDto,
    @Req() req: Request,
  ): Promise<AllowanceRequestResponseDto> {
    const member = requireMember(req);
    return this.allowanceRequestsService.create(
      familyGroupId,
      member.userId,
      dto,
    );
  }

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "AllowanceRequest"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "List allowance requests (owner/admin_staff see all, member sees only their own)",
  })
  @ApiResponse({ status: 200, type: [AllowanceRequestResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
  ): Promise<AllowanceRequestResponseDto[]> {
    const member = requireMember(req);
    // EPIC-023 Task C retry (HIGH six-reviewer finding) — a spouse holds
    // "manage AllowanceRequest" (D2, full financial co-owner) and CAN
    // approve/reject, but was missing from this list here, so they could
    // never discover a request to act on in the first place.
    const canSeeAll =
      member.role === Role.owner ||
      member.role === Role.admin_staff ||
      member.role === Role.spouse;
    return this.allowanceRequestsService.findAll(
      familyGroupId,
      member.userId,
      canSeeAll,
    );
  }

  @Patch(":id/approve")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "AllowanceRequest"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Approve a pending request — executes a real transfer from the owner-chosen source account",
  })
  @ApiResponse({ status: 200, type: AllowanceRequestResponseDto })
  approve(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: ApproveAllowanceRequestDto,
    @Req() req: Request,
  ): Promise<AllowanceRequestResponseDto> {
    const member = requireMember(req);
    return this.allowanceRequestsService.approve(
      familyGroupId,
      id,
      member.userId,
      dto,
    );
  }

  @Patch(":id/reject")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "AllowanceRequest"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Reject a pending request" })
  @ApiResponse({ status: 200, type: AllowanceRequestResponseDto })
  reject(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: RejectAllowanceRequestDto,
    @Req() req: Request,
  ): Promise<AllowanceRequestResponseDto> {
    const member = requireMember(req);
    return this.allowanceRequestsService.reject(
      familyGroupId,
      id,
      member.userId,
      dto,
    );
  }
}
