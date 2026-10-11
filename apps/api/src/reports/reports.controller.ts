import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
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
import { PageAccess } from "../common/decorators/page-access.decorator";
import { BalancesVisibleGuard } from "../common/guards/balances-visible.guard";
import {
  areBalancesHidden,
  hiddenReportSummary,
} from "../common/utils/balance-visibility.util";
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
  CoaMatrixDto,
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

/**
 * EPIC-023 Task B3 review (LOW, batch fix 6) — WIB (UTC+7, fixed, no DST)
 * start-of-month, mirroring `wibWallClockToIso`/`wibCalendarParts` in
 * `apps/web/src/lib/laporan-period.ts` (EPIC-022 B7). Scoped to
 * `getReconciliationBridge` only, NOT applied to this controller's other
 * `new Date(now.getFullYear(), now.getMonth(), 1)` call sites — those use
 * server-LOCAL month boundaries and changing them is a wider blast radius
 * than this fix's scope; every real client already sends an explicit
 * `startDate` from `resolvePreset`, so this only matters for a caller that
 * omits it.
 */
const WIB_UTC_OFFSET_MINUTES = 7 * 60;

function defaultMonthStartWib(now: Date): Date {
  const wibNow = new Date(now.getTime() + WIB_UTC_OFFSET_MINUTES * 60_000);
  const utcMs =
    Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), 1, 0, 0, 0, 0) -
    WIB_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMs);
}

@ApiTags("reports")
@ApiBearerAuth()
// "Lihat saldo" — every report is a money aggregate: denied when off,
// except /summary (ringkasan), which returns nulls + balancesHidden.
@PageAccess("reports")
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
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description:
      "Exact start of the range. With it the summary covers [startDate, " +
      "endDate] instead of whole calendar months, matching the other reports.",
  })
  @ApiOperation({ summary: "Get report summary with period points" })
  @ApiResponse({ status: 200, description: "Report summary data" })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("months") months?: string,
    @Query("period") period?: string,
    @Query("endDate") endDateStr?: string,
    @Query("startDate") startDateStr?: string,
  ): Promise<ReportSummaryDto> {
    if (areBalancesHidden(req.tenantContext?.member)) {
      return Promise.resolve(hiddenReportSummary(period));
    }
    const raw = parseInt(months ?? "", 10);
    const parsedMonths = Number.isNaN(raw) ? 6 : Math.min(Math.max(raw, 1), 24);
    const safePeriod: ReportPeriod =
      period === "daily" || period === "yearly" ? period : "monthly";
    const anchor = parseDate(endDateStr, new Date());
    const rangeStart = startDateStr
      ? parseDate(startDateStr, anchor)
      : undefined;
    // EPIC-023 Task C — reports.service.ts stays untouched (settled by Task
    // A); a family-wide P&L/balance-sheet/cashflow statement cannot be
    // narrowed to "my own" without producing a misleading result, so
    // dependant/operational are denied outright at the entry point.
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getSummary(
      familyGroupId,
      safePeriod,
      parsedMonths,
      canSeePrivate,
      anchor,
      rangeStart && rangeStart <= anchor ? rangeStart : undefined,
    );
  }

  @UseGuards(BalancesVisibleGuard)
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
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getBankReport(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @UseGuards(BalancesVisibleGuard)
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
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getDetailReport(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @UseGuards(BalancesVisibleGuard)
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
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getPnl(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @UseGuards(BalancesVisibleGuard)
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
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getBalanceSheet(
      familyGroupId,
      asOfDate,
      canSeePrivate,
    );
  }

  @UseGuards(BalancesVisibleGuard)
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
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getCashflowStatement(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  @UseGuards(BalancesVisibleGuard)
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
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
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
  @UseGuards(BalancesVisibleGuard)
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
    // EPIC-023 Task B3 review (LOW, batch fix 6) — WIB-anchored, not
    // server-local: `new Date(y, m, 1)` drops the first 7 hours of the WIB
    // month when the client omits `startDate`, consistent with what B1
    // established for the web-side presets.
    const defaultStart = defaultMonthStartWib(now);
    const startDate = parseDate(startDateStr, defaultStart);
    const endDate = parseDate(endDateStr, now);
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getReconciliationBridge(
      familyGroupId,
      startDate,
      endDate,
      canSeePrivate,
    );
  }

  // EPIC-024 Task M (M1, D16, US-RPT-14) — same ability/tenant-scoping shape
  // as every other route here: `@CheckAbility` is required or
  // `AbilitiesGuard` fails OPEN (see the project's AbilitiesGuard note).
  @UseGuards(BalancesVisibleGuard)
  @Get("coa-matrix")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "coaAccountId", required: true, type: String })
  @ApiQuery({ name: "year", required: true, type: Number })
  @ApiOperation({
    summary:
      "Get the yearly tanggal x bulan matrix for one COA account (US-RPT-14)",
  })
  @ApiResponse({ status: 200, description: "COA matrix data" })
  getCoaMatrix(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("coaAccountId") coaAccountId: string,
    @Query("year") yearStr: string,
  ): Promise<CoaMatrixDto> {
    const parsedYear = parseInt(yearStr, 10);
    const year = Number.isNaN(parsedYear)
      ? new Date().getFullYear()
      : parsedYear;
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.reportsService.getCoaMatrix(
      familyGroupId,
      coaAccountId,
      year,
      canSeePrivate,
    );
  }
}
