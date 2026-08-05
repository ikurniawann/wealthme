import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MatchEntryDto } from "./dto/match-entry.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SplitEntryDto } from "./dto/split-entry.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UploadSyncDto } from "./dto/upload-sync.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReconciliationService } from "./reconciliation.service";

import type {
  AutoMatchResultDto,
  BankSyncDto,
  BankSyncEntryDto,
  ParsedRow,
} from "./reconciliation.service";

@ApiTags("reconciliation")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  // EPIC-023 Task C retry (HIGH six-reviewer finding) — this whole controller
  // carried no `@CheckAbility` except `splitEntry` below, so `AbilitiesGuard`
  // waved every route through for every role, including the row-scoped
  // `dependant`/`operational`. The FIRST retry over-corrected by flattening
  // every route onto "manage Reconciliation" (owner/admin_staff/spouse
  // only) — but EPIC-021 Group C (#29) never touched these routes; its own
  // commit message states "the pre-existing upload/match/auto-match
  // endpoints are left untouched", reserving only the ledger-writing
  // `split` action (below) for the bookkeeping roles. Gate each route on
  // the action it actually performs instead: "read" for the list endpoints,
  // "create" for upload/match/auto-match — `member` now holds both (see
  // casl-ability.factory.ts), while `dependant`/`operational` (granted
  // neither) stay refused on every route below.
  @Post("upload")
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Upload bank statement rows for reconciliation" })
  @ApiResponse({ status: 201, description: "BankSync created" })
  upload(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: UploadSyncDto,
  ): Promise<BankSyncDto> {
    const rows: ParsedRow[] = dto.rows.map((r) => ({
      date: new Date(r.date),
      description: r.description,
      amount: BigInt(Math.round(r.amount)),
      currency: r.currency,
    }));
    return this.reconciliationService.upload(familyGroupId, dto.fileName, rows);
  }

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all bank syncs for a family group" })
  @ApiResponse({ status: 200, description: "List of BankSync records" })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<BankSyncDto[]> {
    return this.reconciliationService.findAll(familyGroupId);
  }

  @Get(":syncId/entries")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "syncId", type: String })
  @ApiOperation({ summary: "List entries for a bank sync" })
  @ApiResponse({ status: 200, description: "List of BankSyncEntry records" })
  getEntries(
    @Param("familyGroupId") familyGroupId: string,
    @Param("syncId") syncId: string,
  ): Promise<BankSyncEntryDto[]> {
    return this.reconciliationService.getEntries(familyGroupId, syncId);
  }

  @Patch(":syncId/entries/:entryId/match")
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "syncId", type: String })
  @ApiParam({ name: "entryId", type: String })
  @ApiOperation({ summary: "Mark a bank sync entry as matched" })
  @ApiResponse({ status: 200, description: "Updated BankSyncEntry" })
  matchEntry(
    @Param("familyGroupId") familyGroupId: string,
    @Param("syncId") syncId: string,
    @Param("entryId") entryId: string,
    @Body() dto: MatchEntryDto,
  ): Promise<BankSyncEntryDto> {
    return this.reconciliationService.matchEntry(
      familyGroupId,
      syncId,
      entryId,
      dto.transactionId,
    );
  }

  @Post(":syncId/auto-match")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "syncId", type: String })
  @ApiOperation({ summary: "Run auto-match for unmatched entries" })
  @ApiResponse({ status: 200, description: "Auto-match result" })
  autoMatch(
    @Param("familyGroupId") familyGroupId: string,
    @Param("syncId") syncId: string,
  ): Promise<AutoMatchResultDto> {
    return this.reconciliationService.autoMatch(familyGroupId, syncId);
  }

  // EPIC-021 Group C (#29) — reconciliation fee-split creates real ledger
  // Transactions, so it is gated as a bookkeeping action (owner/admin_staff)
  // rather than left open like the read/upload/match endpoints above.
  @Post(":syncId/entries/:entryId/split")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "syncId", type: String })
  @ApiParam({ name: "entryId", type: String })
  @ApiOperation({
    summary:
      "Split a bank-statement entry into a principal transfer + admin-fee expense, then mark it matched",
  })
  @ApiResponse({ status: 201, description: "Updated BankSyncEntry" })
  splitEntry(
    @Param("familyGroupId") familyGroupId: string,
    @Param("syncId") syncId: string,
    @Param("entryId") entryId: string,
    @Body() dto: SplitEntryDto,
  ): Promise<BankSyncEntryDto> {
    return this.reconciliationService.splitEntry(
      familyGroupId,
      syncId,
      entryId,
      dto,
    );
  }
}
