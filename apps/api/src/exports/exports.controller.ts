import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import {
  assertHouseholdWideReadAllowed,
  canSeePrivateItems,
} from "../common/utils/privacy.util";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ExportsService } from "./exports.service";

import type {
  ExportJobRequestDto,
  ExportJobStatusDto,
} from "@wealthme/contracts";
import type { Request } from "express";

@ApiTags("exports")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/exports")
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiBody({
    schema: {
      type: "object",
      required: ["type", "format"],
      properties: {
        type: {
          type: "string",
          enum: [
            "summary",
            "bank",
            "detail",
            "pnl",
            "balance-sheet",
            "cashflow",
          ],
        },
        format: { type: "string", enum: ["pdf", "excel"] },
        startDate: { type: "string", example: "2025-01-01" },
        endDate: { type: "string", example: "2025-12-31" },
        months: { type: "number", example: 6 },
      },
    },
  })
  @ApiOperation({ summary: "Create an async export job" })
  @ApiResponse({ status: 201, description: "Export job created" })
  createJob(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: ExportJobRequestDto,
    @Req() req: Request,
  ): Promise<ExportJobStatusDto> {
    // EPIC-023 Task C — exports repackage the same family-wide reports as
    // ReportsController; denied outright for dependant/operational for the
    // identical reason (see reports.controller.ts).
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    // Snapshotted now — the job runs later on a background worker with no
    // request scope, so the requester's privacy visibility must travel with it.
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.exportsService.createJob(familyGroupId, dto, canSeePrivate);
  }

  @Get(":jobId")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "jobId", type: String })
  @ApiOperation({ summary: "Poll export job status / get download URL" })
  @ApiResponse({ status: 200, description: "Job status" })
  @ApiResponse({ status: 404, description: "Job not found" })
  getJobStatus(
    @Param("familyGroupId") familyGroupId: string,
    @Param("jobId") jobId: string,
    @Req() req: Request,
  ): Promise<ExportJobStatusDto> {
    // EPIC-023 Task C — defense-in-depth: a dependant/operational could
    // otherwise poll another member's real jobId (this route has no other
    // per-role check) and read its status/download link.
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    return Promise.resolve(
      this.exportsService.getJobStatus(jobId, familyGroupId),
    );
  }
}
