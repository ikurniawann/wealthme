import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// AttachmentsService is injected by class reference — must stay a real
// import (see the same note in attachments.service.ts).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AttachmentsService } from "./attachments.service";
import { TransactionAttachmentResponseDto } from "./dto/transaction-attachment-response.dto";

import type { Request, Response } from "express";

// EPIC-024 Task L2 (US-TXN-9) — matches the epic's ≤5MB limit. Enforced here
// at the multer layer (fast 413-style rejection before the buffer is fully
// read into memory) AND again in AttachmentsService (defense in depth —
// mirrors reconciliation's own MAX_STATEMENT_FILE_BYTES pattern).
const MAX_ATTACHMENT_FILE_BYTES = 5 * 1024 * 1024;

@ApiTags("attachments")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/transactions/:txId/attachments")
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("create", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "txId", type: String })
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Attach a receipt/photo to a transaction (jpg/png/webp/pdf, ≤5MB)",
  })
  @ApiResponse({ status: 201, type: TransactionAttachmentResponseDto })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_FILE_BYTES },
    }),
  )
  async create(
    @Param("familyGroupId") familyGroupId: string,
    @Param("txId") txId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): Promise<TransactionAttachmentResponseDto> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.attachmentsService.create(
      familyGroupId,
      txId,
      { buffer: file.buffer, size: file.size },
      req.tenantContext?.member
        ? {
            userId: req.tenantContext.member.userId,
            role: req.tenantContext.member.role,
            rowScoped: req.tenantContext.member.rowScoped,
          }
        : null,
    );
  }

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "txId", type: String })
  @ApiOperation({ summary: "List attachments for a transaction" })
  @ApiResponse({ status: 200, type: [TransactionAttachmentResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Param("txId") txId: string,
    @Req() req: Request,
  ): Promise<TransactionAttachmentResponseDto[]> {
    return this.attachmentsService.findAllForTransaction(
      familyGroupId,
      txId,
      req.tenantContext?.member
        ? {
            userId: req.tenantContext.member.userId,
            role: req.tenantContext.member.role,
            rowScoped: req.tenantContext.member.rowScoped,
          }
        : null,
    );
  }

  @Get(":attachmentId")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "txId", type: String })
  @ApiParam({ name: "attachmentId", type: String })
  @ApiOperation({ summary: "Stream an attachment's file content" })
  @ApiResponse({ status: 200, description: "Raw file bytes" })
  @ApiResponse({ status: 404, description: "Attachment not found" })
  async download(
    @Param("familyGroupId") familyGroupId: string,
    @Param("txId") txId: string,
    @Param("attachmentId") attachmentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, mimeType, size } = await this.attachmentsService.stream(
      familyGroupId,
      txId,
      attachmentId,
      req.tenantContext?.member
        ? {
            userId: req.tenantContext.member.userId,
            role: req.tenantContext.member.role,
            rowScoped: req.tenantContext.member.rowScoped,
          }
        : null,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(size));
    // "inline", not "attachment" — a display filename would have to come
    // from somewhere, and the only candidate (client-supplied original
    // filename) is untrusted; inline display sidesteps that without
    // fabricating a filename.
    res.setHeader("Content-Disposition", "inline");

    // A ReadStream's "error" event (e.g. ENOENT — the file was deleted from
    // disk between the DB lookup in `stream()` and this read, a real race:
    // `remove()` deletes the DB row THEN the disk file, so a concurrent GET
    // can land in that gap) is async and, if unlistened, throws on the
    // EventEmitter and crashes the whole Node process. Listening here turns
    // it into a clean HTTP error response instead.
    stream.on("error", (err: Error) => {
      if (res.headersSent) {
        res.destroy(err);
        return;
      }
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: "Attachment file not found",
      });
    });
    stream.pipe(res);
  }

  @Delete(":attachmentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Transaction"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "txId", type: String })
  @ApiParam({ name: "attachmentId", type: String })
  @ApiOperation({ summary: "Delete an attachment" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Attachment not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("txId") txId: string,
    @Param("attachmentId") attachmentId: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.attachmentsService.remove(
      familyGroupId,
      txId,
      attachmentId,
      req.tenantContext?.member
        ? {
            userId: req.tenantContext.member.userId,
            role: req.tenantContext.member.role,
            rowScoped: req.tenantContext.member.rowScoped,
          }
        : null,
    );
  }
}
