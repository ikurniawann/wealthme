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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { type Request as ExpressRequest } from "express";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AccessService } from "./access.service";

import type { JwtPayload } from "../auth/strategies/jwt.strategy";
import type { AccessRoleResponse, MyAccessResponse } from "@wealthme/contracts";

interface AuthRequest extends ExpressRequest {
  user: JwtPayload;
}

/**
 * EPIC-030 — IAM. Everything here is Master-only (`iam` resource, which no
 * page grant can open) except GET access/me, which any member uses to learn
 * their own menu and routes.
 */
@ApiTags("access")
@ApiBearerAuth()
@PageAccess("iam")
@Controller("family-groups/:familyGroupId")
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get("access/me")
  @PageAccess("my-access")
  @ApiOperation({ summary: "The current member's effective page access" })
  me(@Request() req: AuthRequest): MyAccessResponse {
    const access = req.tenantContext?.access;
    if (!access) throw new ForbiddenException("Access denied");
    return access;
  }

  @Get("access-roles")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiOperation({ summary: "List custom IAM roles (Master only)" })
  list(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<AccessRoleResponse[]> {
    return this.access.listRoles(familyGroupId, req.user.sub);
  }

  @Post("access-roles")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiOperation({ summary: "Create a custom IAM role (Master only)" })
  create(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Body() body: unknown,
  ): Promise<AccessRoleResponse> {
    return this.access.createRole(familyGroupId, req.user.sub, body);
  }

  @Patch("access-roles/:roleId")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiOperation({ summary: "Update a custom IAM role (Master only)" })
  update(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("roleId") roleId: string,
    @Body() body: unknown,
  ): Promise<AccessRoleResponse> {
    return this.access.updateRole(familyGroupId, roleId, req.user.sub, body);
  }

  @Delete("access-roles/:roleId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiOperation({ summary: "Delete a custom IAM role (Master only)" })
  remove(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("roleId") roleId: string,
  ): Promise<void> {
    return this.access.deleteRole(familyGroupId, roleId, req.user.sub);
  }

  @Put("members/:memberId/access")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Member"))
  @ApiOperation({
    summary: "Assign a custom role and per-member overrides (Master only)",
  })
  setMemberAccess(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.access.setMemberAccess(
      familyGroupId,
      memberId,
      req.user.sub,
      body,
    );
  }
}
