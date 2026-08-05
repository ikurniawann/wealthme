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

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MatchEntryDto } from "./dto/match-entry.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SplitEntryDto } from "./dto/split-entry.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UploadFileDto } from "./dto/upload-file.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UploadSyncDto } from "./dto/upload-sync.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpsertReconciliationTemplateDto } from "./dto/upsert-reconciliation-template.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReconciliationService } from "./reconciliation.service";

import type {
  AutoMatchResultDto,
  BankSyncDto,
  BankSyncEntryDto,
  ParsedRow,
  ReconciliationTemplateDto,
} from "./reconciliation.service";

/** 20 MiB — matches the pre-existing "Maksimal ukuran file: 20MB" copy on
 * the upload page; generous for a bank statement CSV/Excel export, small
 * enough to bound memory use (files are parsed in-memory via multer's
 * memoryStorage). */
const MAX_STATEMENT_FILE_BYTES = 20 * 1024 * 1024;

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

  // EPIC-023 G2 (D17) — the real upload path: the raw file is parsed
  // SERVER-SIDE (CSV with proper quote handling, .xlsx via `exceljs`, PDF
  // and legacy .xls refused with a clear reason). Same "create
  // Reconciliation" gate as the legacy JSON-rows `upload` above — this is
  // the same action, just with honest parsing instead of a client-side
  // guess.
  @Post("upload-file")
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Upload a bank statement file (CSV/Excel) for reconciliation — parsed server-side; PDF refused",
  })
  @ApiResponse({ status: 201, description: "BankSync created" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_STATEMENT_FILE_BYTES },
    }),
  )
  uploadFile(
    @Param("familyGroupId") familyGroupId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadFileDto,
  ): Promise<BankSyncDto> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.reconciliationService.uploadFile(
      familyGroupId,
      file,
      dto.bankCode,
    );
  }

  // EPIC-023 G2 (D17) — column-mapping templates are a saved-configuration
  // surface (like the AI key), gated owner-level for writes; `member`
  // (who already runs the day-to-day upload/match workflow) can read the
  // saved templates to know which banks are already mapped.
  @Get("templates")
  @CheckAbility((ab: AppAbility) => ab.can("read", "ReconciliationTemplate"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List saved bank column-mapping templates" })
  @ApiResponse({ status: 200, description: "List of ReconciliationTemplate" })
  listTemplates(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<ReconciliationTemplateDto[]> {
    return this.reconciliationService.listTemplates(familyGroupId);
  }

  @Post("templates")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "ReconciliationTemplate"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Create or replace the column-mapping template for a bank",
  })
  @ApiResponse({ status: 201, description: "Created/updated template" })
  upsertTemplate(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: UpsertReconciliationTemplateDto,
  ): Promise<ReconciliationTemplateDto> {
    return this.reconciliationService.upsertTemplate(familyGroupId, dto);
  }

  @Delete("templates/:bankCode")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "ReconciliationTemplate"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "bankCode", type: String })
  @ApiOperation({ summary: "Delete a bank's column-mapping template" })
  @ApiResponse({ status: 204 })
  deleteTemplate(
    @Param("familyGroupId") familyGroupId: string,
    @Param("bankCode") bankCode: string,
  ): Promise<void> {
    return this.reconciliationService.deleteTemplate(familyGroupId, bankCode);
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
