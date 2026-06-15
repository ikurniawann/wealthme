import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Request,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { type Request as ExpressRequest } from "express";

import { type JwtPayload } from "../auth/strategies/jwt.strategy";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GdprService } from "./gdpr.service";

interface AuthRequest extends ExpressRequest {
  user: JwtPayload;
}

@ApiTags("gdpr")
@ApiBearerAuth()
@Controller("users/me/gdpr")
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Get("export")
  @ApiOperation({ summary: "Export all personal data (PDP right of access)" })
  exportData(@Request() req: AuthRequest) {
    return this.gdprService.exportUserData(req.user.sub);
  }

  @Delete("account")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete account and all personal data (PDP right to erasure)",
  })
  deleteAccount(@Request() req: AuthRequest) {
    return this.gdprService.deleteAccount(req.user.sub);
  }
}
