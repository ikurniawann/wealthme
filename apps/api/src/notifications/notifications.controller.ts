import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MarkReadDto } from "./dto/mark-read.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NotificationsService } from "./notifications.service";

import type { Request } from "express";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Notification"))
  @ApiOperation({ summary: "List notifications visible to the caller" })
  @ApiResponse({ status: 200, description: "Notification list" })
  findAll(@Param("familyGroupId") familyGroupId: string, @Req() req: Request) {
    // Both the user id and the role are load-bearing — see
    // NotificationsService's `visibilityWhere`.
    return this.notificationsService.findAll(
      familyGroupId,
      req.tenantContext!.userId,
      req.tenantContext?.member?.role,
    );
  }

  @Get("unread-count")
  @CheckAbility((ab) => ab.can("read", "Notification"))
  @ApiOperation({ summary: "Get unread notification count" })
  @ApiResponse({ status: 200, description: "Unread count" })
  getUnreadCount(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
  ) {
    return this.notificationsService.getUnreadCount(
      familyGroupId,
      req.tenantContext!.userId,
      req.tenantContext?.member?.role,
    );
  }

  // `update`, not `manage`: marking your own notification read is not
  // administering the family's notifications. `manage` still satisfies this
  // check for every trusted role, so nothing that could mark-read before
  // loses the ability — it only stops excluding `dependant`/`operational`,
  // who now have their own rows to mark and are scoped to exactly those.
  @Patch("mark-read")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab) => ab.can("update", "Notification"))
  @ApiOperation({ summary: "Mark the caller's visible notifications as read" })
  @ApiResponse({ status: 200, description: "Updated count" })
  markRead(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: MarkReadDto,
    @Req() req: Request,
  ) {
    return this.notificationsService.markRead(
      familyGroupId,
      req.tenantContext!.userId,
      req.tenantContext?.member?.role,
      dto,
    );
  }
}
