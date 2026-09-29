import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import { type Request as ExpressRequest, type Response } from "express";
import { memoryStorage } from "multer";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

/* eslint-disable @typescript-eslint/consistent-type-imports */
import {
  MAX_TAX_DOCUMENT_BYTES,
  TaxDocumentsService,
} from "./tax-documents.service";
/* eslint-enable @typescript-eslint/consistent-type-imports */

import type { TaxDocumentResponseDto } from "./dto/tax-document-response.dto";

class TaxDocumentYearParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

// Hardening batch G2 — tax's "+ Upload" used to only toast "belum tersedia".
// Real endpoints, mirroring AssetsController's attachment routes exactly.
@ApiTags("tax")
@ApiBearerAuth()
@PageAccess("tax")
@Controller("family-groups/:familyGroupId/tax/documents")
export class TaxDocumentsController {
  constructor(private readonly documents: TaxDocumentsService) {}

  @Post(":year")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Upload a tax document for a tax year (jpg/png/webp/pdf, ≤5MB)",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_TAX_DOCUMENT_BYTES },
    }),
  )
  createDocument(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param() { year }: TaxDocumentYearParamDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<TaxDocumentResponseDto> {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.documents.create(req.params.familyGroupId, year, {
      buffer: file.buffer,
      size: file.size,
    });
  }

  @Get(":year")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List documents uploaded for a tax year" })
  findDocuments(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param() { year }: TaxDocumentYearParamDto,
  ): Promise<TaxDocumentResponseDto[]> {
    return this.documents.findAll(req.params.familyGroupId, year);
  }

  @Get(":year/:documentId")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Stream a tax document" })
  async downloadDocument(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param() { year }: TaxDocumentYearParamDto,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, mimeType, size } = await this.documents.stream(
      req.params.familyGroupId,
      year,
      documentId,
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
        message: "Document file not found",
      });
    });
    stream.pipe(res);
  }

  @Delete(":year/:documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Delete a tax document" })
  removeDocument(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param() { year }: TaxDocumentYearParamDto,
    @Param("documentId") documentId: string,
  ): Promise<void> {
    return this.documents.remove(req.params.familyGroupId, year, documentId);
  }
}
