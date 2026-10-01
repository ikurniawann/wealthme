import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";

import { type JwtPayload } from "../auth/strategies/jwt.strategy";

import { MAX_AVATAR_BYTES } from "./avatar.util";
// Injected by class reference — must stay a real import (Nest DI).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AvatarsService } from "./avatars.service";

import type { Request, Response } from "express";

type AuthRequest = Request & { user: JwtPayload };

/**
 * Profile pictures. Write routes are `/users/me/...` only — the target is
 * always the authenticated subject, never a client-supplied id. Reads are
 * per-user but limited to the user and their family (see AvatarsService).
 */
@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class AvatarsController {
  constructor(private readonly avatars: AvatarsService) {}

  @Put("me/avatar")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload my profile picture (jpg/png/webp, ≤2MB)" })
  @ApiResponse({ status: 200, description: "{ avatarUrl }" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_BYTES },
    }),
  )
  async upload(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ avatarUrl: string | null }> {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.avatars.setAvatar(req.user.sub, {
      buffer: file.buffer,
      size: file.size,
      mimetype: file.mimetype,
    });
  }

  @Delete("me/avatar")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove my profile picture" })
  @ApiResponse({ status: 204 })
  remove(@Req() req: AuthRequest): Promise<void> {
    return this.avatars.clearAvatar(req.user.sub);
  }

  @Get("me/avatar")
  @ApiOperation({ summary: "Stream my profile picture" })
  streamMine(@Req() req: AuthRequest, @Res() res: Response): Promise<void> {
    return this.send(req.user.sub, req.user.sub, res);
  }

  @Get(":userId/avatar")
  @ApiParam({ name: "userId", type: String })
  @ApiOperation({
    summary: "Stream a family member's profile picture (same family only)",
  })
  @ApiResponse({ status: 404, description: "No avatar, or not in your family" })
  stream(
    @Param("userId") userId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.send(req.user.sub, userId, res);
  }

  private async send(
    requesterId: string,
    targetUserId: string,
    res: Response,
  ): Promise<void> {
    const { stream, mimeType } = await this.avatars.streamAvatar(
      requesterId,
      targetUserId,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // The URL carries `?v=<file>` so a new upload changes it; private so
    // shared caches never hold one family's pictures.
    res.setHeader("Cache-Control", "private, max-age=86400");
    stream.on("error", () => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: "Avatar not found",
      });
    });
    stream.pipe(res);
  }
}
