import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { ReportsService } from "./reports.service";

import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
  DetailReportDto,
  PnlDto,
  ReconciliationBridgeDto,
  ReportPeriod,
  ReportSummaryDto,
  SankeyDto,
} from "@wealthme/contracts";
import type { Request } from "express";

function parseDate(iso: string | undefined, fallback: Date): Date {
  if (!iso) return fallback;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? fallback : d;
}

@ApiTags("reports")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("summary")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "months", required: false, type: Number })
  @ApiQuery({
    name: "period",
    required: false,
    enum: ["daily", "monthly", "yearly"],
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description:
      "Anchor date for the trailing-months window (defaults to now). Lets " +
      "callers re-query the summary trend for a past period, e.g. the last " +
      "N months ending at a selected month/year.",
  })
  @ApiOperation({ summary: "Get report summary with period points" })
  @ApiResponse({ status: 200, description: "Report summary data" })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("months") months?: string,
    @Query("period") period?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<ReportSummaryDto> {
    const raw = parseInt(months ?? "", 10);
    const parsedMonths = Number.isNaN(raw) ? 6 : Math.min(Math.max(raw, 1), 24);
    const safePeriod: ReportPeriod =
      period === "daily" || period === "yearly" ? period : "monthly";
    const anchor = parseDate(endDateStr, new Date());
    // EPIC-023 Task C — reports.service.ts stays untouched (settled by Task
    // A); a family-wide P&L/balance-sheet/cashflow statement cannot be
    // narrowed to "my own" without producing a misleading result, so
    // dependant/operational are denied outright at the entry point.
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getSummary(
      familyGroupId,
      safePeriod,
      parsedMonths,
      canSeePrivate,
      anchor,
    );
  }

  @Get("bank")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiOperation({ summary: "Get bank breakdown report" })
  @ApiResponse({ status: 200, description: "Bank report data" })
  getBankReport(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<BankReportDto> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(startDateStr, defaultStart);
    const endDate = parseDate(endDateStr, now);
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getBankReport(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @Get("detail")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiOperation({ summary: "Get detailed transaction report" })
  @ApiResponse({ status: 200, description: "Detail report data" })
  getDetailReport(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<DetailReportDto> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(startDateStr, defaultStart);
    const endDate = parseDate(endDateStr, now);
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getDetailReport(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @Get("pnl")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiOperation({ summary: "Get profit and loss statement" })
  @ApiResponse({ status: 200, description: "PnL data" })
  getPnl(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<PnlDto> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(startDateStr, defaultStart);
    const endDate = parseDate(endDateStr, now);
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getPnl(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @Get("balance-sheet")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "asOfDate", required: false, type: String })
  @ApiOperation({ summary: "Get balance sheet" })
  @ApiResponse({ status: 200, description: "Balance sheet data" })
  getBalanceSheet(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("asOfDate") asOfDateStr?: string,
  ): Promise<BalanceSheetDto> {
    const asOfDate = parseDate(asOfDateStr, new Date());
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getBalanceSheet(
      familyGroupId,
      asOfDate,
      canSeePrivate,
    );
  }

  @Get("cashflow")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiOperation({ summary: "Get cashflow statement" })
  @ApiResponse({ status: 200, description: "Cashflow statement data" })
  getCashflowStatement(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<CashflowStatementDto> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(startDateStr, defaultStart);
    const endDate = parseDate(endDateStr, now);
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getCashflowStatement(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @Get("sankey")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiOperation({ summary: "Get Sankey flow diagram data" })
  @ApiResponse({ status: 200, description: "Sankey data" })
  getSankey(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<SankeyDto> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(startDateStr, defaultStart);
    const endDate = parseDate(endDateStr, now);
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getSankey(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  // EPIC-023 Task B (B3, D24, US-RPT-11) — same ability/tenant-scoping shape
  // as every other route on this controller: `@CheckAbility` is required or
  // `AbilitiesGuard` fails OPEN, and `assertHouseholdWideReadAllowed` keeps
  // dependant/operational off this household-wide reconciliation view.
  @Get("reconciliation-bridge")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiOperation({
    summary:
      "Get the profit vs. net-worth-change reconciliation bridge (US-RPT-11)",
  })
  @ApiResponse({ status: 200, description: "Reconciliation bridge data" })
  getReconciliationBridge(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<ReconciliationBridgeDto> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(startDateStr, defaultStart);
    const endDate = parseDate(endDateStr, now);
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getReconciliationBridge(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }
}
