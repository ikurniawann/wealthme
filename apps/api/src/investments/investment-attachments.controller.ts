import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { BalancesVisibleGuard } from "../common/guards/balances-visible.guard";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  InvestmentAttachmentsService,
  MAX_INVESTMENT_ATTACHMENT_BYTES,
} from "./investment-attachments.service";

import type { Request, Response } from "express";

function actor(req: Request) {
  return {
    member: req.tenantContext?.member ?? null,
    userId: req.tenantContext?.userId ?? null,
  };
}
@UseGuards(BalancesVisibleGuard)
@PageAccess("investments")
@Controller("family-groups/:familyGroupId/investments/:id/attachments")
export class InvestmentAttachmentsController {
  constructor(private readonly attachments: InvestmentAttachmentsService) {}
  @Post()
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_INVESTMENT_ATTACHMENT_BYTES },
    }),
  )
  create(
    @Param("familyGroupId") fg: string,
    @Param("id") id: string,
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.attachments.create(fg, id, file, actor(req));
  }
  @Get()
  @CheckAbility((ab) => ab.can("read", "Investment"))
  list(
    @Param("familyGroupId") fg: string,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.attachments.findAll(fg, id, actor(req));
  }
  @Get(":attachmentId")
  @CheckAbility((ab) => ab.can("read", "Investment"))
  async download(
    @Param("familyGroupId") fg: string,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { stream, mimeType, size } = await this.attachments.stream(
      fg,
      id,
      attachmentId,
      actor(req),
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(size));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    stream.on("error", (error: Error) => {
      if (res.headersSent) res.destroy(error);
      else res.status(404).json({ message: "Attachment file not found" });
    });
    stream.pipe(res);
  }
  @Delete(":attachmentId")
  @HttpCode(204)
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  remove(
    @Param("familyGroupId") fg: string,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Req() req: Request,
  ) {
    return this.attachments.remove(fg, id, attachmentId, actor(req));
  }
}
