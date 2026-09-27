import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { type Request as ExpressRequest, type Response } from "express";
import { memoryStorage } from "multer";

import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { FX_FIELD_SPECS } from "../fx/fx-field-specs";
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { FxInputService } from "../fx/fx-input.service";

import {
  AssetAttachmentsService,
  MAX_ASSET_ATTACHMENT_BYTES,
} from "./asset-attachments.service";
import { AssetsService } from "./assets.service";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { RecordAssetValueDto } from "./dto/record-asset-value.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";
/* eslint-enable @typescript-eslint/consistent-type-imports */

import type {
  AssetHistoryResponseDto,
  AssetAttachmentResponseDto,
  AssetResponseDto,
} from "./dto/asset-response.dto";

@ApiTags("assets")
@ApiBearerAuth()
@PageAccess("assets")
@Controller("family-groups/:familyGroupId/assets")
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly attachments: AssetAttachmentsService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Asset"))
  @ApiOperation({ summary: "List all assets for a family group" })
  @ApiResponse({ status: 200, description: "Array of assets" })
  findAll(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
  ): Promise<AssetResponseDto[]> {
    return this.assetsService.findAll(req.params.familyGroupId);
  }

  @Post()
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Create a new asset" })
  @ApiResponse({ status: 201, description: "Created asset" })
  create(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Body() dto: CreateAssetDto,
  ): Promise<AssetResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId: req.params.familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Asset",
        dto,
        spec: FX_FIELD_SPECS.asset,
      },
      (converted) =>
        this.assetsService.create(req.params.familyGroupId, converted),
    );
  }

  @Patch(":id")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Update an asset" })
  @ApiResponse({ status: 200, description: "Updated asset" })
  update(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<AssetResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId: req.params.familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Asset",
        entityId: id,
        dto,
        spec: FX_FIELD_SPECS.asset,
      },
      (converted) =>
        this.assetsService.update(req.params.familyGroupId, id, converted),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Delete an asset" })
  @ApiResponse({ status: 204 })
  remove(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<void> {
    return this.assetsService.remove(req.params.familyGroupId, id);
  }

  @Post(":id/history")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Record a dated valuation for an asset (EPIC-033)" })
  @ApiResponse({ status: 201, description: "The created history entry" })
  recordValue(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: RecordAssetValueDto,
  ): Promise<AssetHistoryResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId: req.params.familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Asset",
        entityId: id,
        fieldPrefix: "history",
        dto,
        spec: FX_FIELD_SPECS.assetHistory,
      },
      (converted) =>
        this.assetsService.recordValue(
          req.params.familyGroupId,
          id,
          converted,
          req.tenantContext?.userId ?? null,
        ),
    );
  }

  // EPIC-033 p14 — documents on an asset.
  @Post(":id/attachments")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Attach a document to an asset (jpg/png/webp/pdf, ≤5MB)",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ASSET_ATTACHMENT_BYTES },
    }),
  )
  createAttachment(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AssetAttachmentResponseDto> {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.attachments.create(req.params.familyGroupId, id, {
      buffer: file.buffer,
      size: file.size,
    });
  }

  @Get(":id/attachments")
  @CheckAbility((ab) => ab.can("read", "Asset"))
  @ApiOperation({ summary: "List documents attached to an asset" })
  findAttachments(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<AssetAttachmentResponseDto[]> {
    return this.attachments.findAll(req.params.familyGroupId, id);
  }

  @Get(":id/attachments/:attachmentId")
  @CheckAbility((ab) => ab.can("read", "Asset"))
  @ApiOperation({ summary: "Stream an asset document" })
  async downloadAttachment(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, mimeType, size } = await this.attachments.stream(
      req.params.familyGroupId,
      id,
      attachmentId,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(size));
    res.setHeader("Content-Disposition", "inline");
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

  @Delete(":id/attachments/:attachmentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Delete an asset document" })
  removeAttachment(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
  ): Promise<void> {
    return this.attachments.remove(req.params.familyGroupId, id, attachmentId);
  }

  @Get(":id/history")
  @CheckAbility((ab) => ab.can("read", "Asset"))
  @ApiOperation({ summary: "Get value history for an asset" })
  @ApiResponse({ status: 200, description: "Array of asset history records" })
  findHistory(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<AssetHistoryResponseDto[]> {
    return this.assetsService.findHistory(req.params.familyGroupId, id);
  }
}
