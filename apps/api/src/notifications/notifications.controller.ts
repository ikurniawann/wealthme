import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NotificationsService } from "./notifications.service";

import type { MarkReadDto } from "./dto/mark-read.dto";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("family-groups/:familyGroupId/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Notification"))
  @ApiOperation({ summary: "List all notifications for a family group" })
  @ApiResponse({ status: 200, description: "Notification list" })
  findAll(@Param("familyGroupId") familyGroupId: string) {
    return this.notificationsService.findAll(familyGroupId);
  }

  @Get("unread-count")
  @CheckAbility((ab) => ab.can("read", "Notification"))
  @ApiOperation({ summary: "Get unread notification count" })
  @ApiResponse({ status: 200, description: "Unread count" })
  getUnreadCount(@Param("familyGroupId") familyGroupId: string) {
    return this.notificationsService.getUnreadCount(familyGroupId);
  }

  @Patch("mark-read")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab) => ab.can("manage", "Notification"))
  @ApiOperation({ summary: "Mark notifications as read" })
  @ApiResponse({ status: 200, description: "Updated count" })
  markRead(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.notificationsService.markRead(familyGroupId, dto);
  }
}
