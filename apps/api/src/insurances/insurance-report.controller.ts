import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
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
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  ConfirmInsuranceReportDto,
  PreviewInsuranceReportDto,
  UploadInsuranceDocumentDto,
} from "./dto/insurance-report.dto";
/* eslint-disable @typescript-eslint/consistent-type-imports */
import {
  InsuranceDocumentsService,
  MAX_INSURANCE_DOCUMENT_BYTES,
} from "./insurance-documents.service";
/* eslint-enable @typescript-eslint/consistent-type-imports */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceReportService } from "./insurance-report.service";
import { viewerFromTenant } from "./insurance-scope.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsurancesService } from "./insurances.service";
import { toInsuranceReportHttpException } from "./report-reader/insurance-report-http-error.util";

import type {
  ConfirmInsuranceReportResultDto,
  InsuranceDocumentDto,
  InsuranceReportPreviewDto,
} from "@wealthme/contracts";
import type { Request, Response } from "express";

const canRead = (ab: AppAbility) => ab.can("read", "Insurance");
const canManage = (ab: AppAbility) => ab.can("manage", "Insurance");

/**
 * Asuransi Task 23 — policy documents (S8/S9) and AI report reading (S8).
 * EVERY route carries @CheckAbility (AbilitiesGuard fails open on ungated
 * routes) and every :id route checks S9 row visibility first: a document
 * follows its policy, so a viewer who cannot see the policy gets 404 for
 * its documents too.
 */
@ApiTags("insurances")
@ApiBearerAuth()
@PageAccess("insurances")
@Controller("family-groups/:familyGroupId/insurances")
export class InsuranceReportController {
  private readonly logger = new Logger(InsuranceReportController.name);

  constructor(
    private readonly insurances: InsurancesService,
    private readonly documents: InsuranceDocumentsService,
    private readonly reports: InsuranceReportService,
  ) {}

  // Paid call on the family's own key: manage-gated (a read-only member
  // cannot spend the family's AI quota) and throttled per minute.
  @Post("report-preview")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Read an insurance report's browser-extracted text with the family's AI key. Returns strings with page + snippet and deterministic drafts; nothing is stored.",
  })
  @ApiResponse({ status: 200, description: "Preview — nothing persisted" })
  @ApiResponse({ status: 412, description: "code=INSURANCE_AI_NOT_CONFIGURED" })
  @ApiResponse({ status: 409, description: "code=AI_KEY_CORRUPTED" })
  @ApiResponse({
    status: 422,
    description: "code=INSURANCE_REPORT_NO_TEXT_LAYER",
  })
  @ApiResponse({ status: 413, description: "code=INSURANCE_REPORT_TOO_LARGE" })
  @ApiResponse({
    status: 502,
    description:
      "code=INSURANCE_AI_AUTH | INSURANCE_AI_PARSE_FAILED | INSURANCE_AI_UPSTREAM_FAILED",
  })
  @ApiResponse({ status: 429, description: "code=INSURANCE_AI_RATE_LIMITED" })
  @ApiResponse({ status: 504, description: "code=INSURANCE_AI_TIMEOUT" })
  async preview(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: PreviewInsuranceReportDto,
    @Req() req: Request,
  ): Promise<InsuranceReportPreviewDto> {
    if (dto.insuranceId) {
      await this.visible(req, familyGroupId, dto.insuranceId);
    }
    try {
      return await this.reports.preview(familyGroupId, dto);
    } catch (err) {
      throw toInsuranceReportHttpException(err, this.logger);
    }
  }

  @Post(":id/valuations/confirm")
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Save user-reviewed report values as CONFIRMED value statements with the document reference. Never creates a cash transaction.",
  })
  async confirm(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: ConfirmInsuranceReportDto,
    @Req() req: Request,
  ): Promise<ConfirmInsuranceReportResultDto> {
    await this.visible(req, familyGroupId, id);
    return this.reports.confirm(
      familyGroupId,
      id,
      dto,
      req.tenantContext?.userId ?? null,
    );
  }

  @Post(":id/documents")
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @CheckAbility(canManage)
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Upload a policy document (pdf/jpg/png, ≤ 5 MB)" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_INSURANCE_DOCUMENT_BYTES },
    }),
  )
  async upload(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadInsuranceDocumentDto,
    @Req() req: Request,
  ): Promise<InsuranceDocumentDto> {
    if (!file) throw new BadRequestException("Tidak ada file yang diunggah");
    await this.visible(req, familyGroupId, id);
    return this.documents.create(
      familyGroupId,
      id,
      { buffer: file.buffer, size: file.size, originalname: file.originalname },
      {
        reportDate: dto.reportDate,
        actorUserId: req.tenantContext?.userId ?? null,
      },
    );
  }

  @Get(":id/documents")
  @CheckAbility(canRead)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  async list(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<InsuranceDocumentDto[]> {
    await this.visible(req, familyGroupId, id);
    return this.documents.list(familyGroupId, id);
  }

  @Get(":id/documents/:documentId")
  @CheckAbility(canRead)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "documentId", type: String })
  @ApiOperation({ summary: "Stream a policy document (tenant + S9 scoped)" })
  async download(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.visible(req, familyGroupId, id);
    const { stream, mimeType, size, fileName } = await this.documents.stream(
      familyGroupId,
      id,
      documentId,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(size));
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    // Sensitive: never cached by a proxy or the browser's shared cache.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    stream.on("error", (err: Error) => {
      if (res.headersSent) {
        res.destroy(err);
        return;
      }
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: "File dokumen tidak ditemukan",
      });
    });
    stream.pipe(res);
  }

  @Delete(":id/documents/:documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "documentId", type: String })
  @ApiOperation({ summary: "Delete a policy document and its stored file" })
  async remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.visible(req, familyGroupId, id);
    await this.documents.remove(familyGroupId, id, documentId);
  }

  private visible(req: Request, familyGroupId: string, id: string) {
    return this.insurances.assertVisible(
      familyGroupId,
      id,
      viewerFromTenant(req.tenantContext),
    );
  }
}
