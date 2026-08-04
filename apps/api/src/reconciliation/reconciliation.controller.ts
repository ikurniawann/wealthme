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

  @Post("upload")
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
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all bank syncs for a family group" })
  @ApiResponse({ status: 200, description: "List of BankSync records" })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<BankSyncDto[]> {
    return this.reconciliationService.findAll(familyGroupId);
  }

  @Get(":syncId/entries")
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
