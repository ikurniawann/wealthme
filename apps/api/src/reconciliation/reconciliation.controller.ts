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
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CommitStatementDraftDto } from "./dto/commit-statement-draft.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ImportEntriesDto } from "./dto/import-entries.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MatchEntryDto } from "./dto/match-entry.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PreviewStatementDraftDto } from "./dto/preview-statement-draft.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReadStatementPdfPageDto } from "./dto/read-statement-pdf-page.dto";
// VALUE import, and the eslint-disable is load-bearing: Nest reads the
// `@Body()` DTO class off `design:paramtypes`, so a `type` import erases it
// and ValidationPipe silently stops validating the body — every
// class-validator bound on the DTO would just stop applying. `--fix` wants
// to rewrite this line; do not let it. (`MAX_STATEMENT_PDF_PAGES` is a real
// value too, used in the throttle limit below.)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  MAX_STATEMENT_PDF_PAGES,
  ReadStatementPdfDto,
} from "./dto/read-statement-pdf.dto";
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
import { toStatementReaderHttpException } from "./statement-reader/statement-reader-http-error.util";

import type {
  AutoMatchResultDto,
  BankSyncDto,
  BankSyncEntryDto,
  ParsedRow,
  ImportEntriesResultDto,
  ReconciliationTemplateDto,
  StatementPageReadDto,
  StatementPreviewDto,
} from "./reconciliation.service";

/** 20 MiB — matches the pre-existing "Maksimal ukuran file: 20MB" copy on
 * the upload page; generous for a bank statement CSV/Excel export, small
 * enough to bound memory use (files are parsed in-memory via multer's
 * memoryStorage). */
const MAX_STATEMENT_FILE_BYTES = 20 * 1024 * 1024;

@ApiTags("reconciliation")
@ApiBearerAuth()
@PageAccess("reconciliation")
@Controller("family-groups/:familyGroupId/reconciliation")
export class ReconciliationController {
  private readonly logger = new Logger(ReconciliationController.name);

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

  /* ───────── EPIC-029 groups 1-3 — statement PDF on the family AI key ───────── */

  // Same "create Reconciliation" gate as every other import route. Stated
  // explicitly because `AbilitiesGuard` waves through any route that carries
  // no `@CheckAbility` at all — an ungated route here would be open to
  // `dependant` and `operational`, who are refused everywhere else on this
  // controller.
  //
  // The 5/min `@Throttle` is tighter than the scan's 10/min: this call bills
  // the FAMILY's own AI key for a whole statement, not one receipt.
  @Post("statement-pdf")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Read an already-extracted statement PDF text layer with the family's own AI key and return a PREVIEW. Nothing is stored (EPIC-029 E3a). The PDF file and its password never reach this endpoint (E8/E9/E10) — pdfjs decrypts and extracts in the browser.",
  })
  @ApiResponse({ status: 200, description: "Preview — nothing persisted" })
  @ApiResponse({
    status: 412,
    description:
      "code=STATEMENT_AI_NOT_CONFIGURED — the family has no AI provider key (E5: no server-key or mock fallback)",
  })
  @ApiResponse({
    status: 409,
    description: "code=AI_KEY_CORRUPTED — re-enter the key in Pengaturan",
  })
  @ApiResponse({
    status: 422,
    description:
      "code=STATEMENT_TEXT_TOO_LARGE | STATEMENT_NO_TEXT_LAYER | STATEMENT_NO_ROWS | STATEMENT_ZERO_VALID_ROWS | STATEMENT_COLUMN_MAPPING_MISMATCH",
  })
  @ApiResponse({
    status: 502,
    description:
      "code=STATEMENT_AI_AUTH | STATEMENT_AI_PARSE_FAILED | STATEMENT_AI_UPSTREAM_FAILED",
  })
  @ApiResponse({ status: 429, description: "code=STATEMENT_AI_RATE_LIMITED" })
  @ApiResponse({ status: 504, description: "code=STATEMENT_AI_TIMEOUT" })
  async readStatementPdf(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: ReadStatementPdfDto,
  ): Promise<StatementPreviewDto> {
    try {
      return await this.reconciliationService.readStatementPdf(
        familyGroupId,
        dto,
      );
    } catch (err: unknown) {
      throw toStatementReaderHttpException(err, this.logger);
    }
  }

  /**
   * EPIC-029 follow-up — read ONE page.
   *
   * The whole-statement route above cannot finish inside the request path in
   * production: a 5-page statement ran past 120s, nginx cuts an idle
   * upstream at 60s and Cloudflare caps a request at ~100s, so the browser
   * only ever saw a dead connection. A page at a time fits with room to
   * spare and gives the UI something honest to show while it works.
   *
   * The throttle is per page rather than per statement, so a 40-page
   * statement is not refused halfway through: the limit is sized to the page
   * cap, not to the old one-call-per-statement shape.
   */
  @Post("statement-pdf/page")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: MAX_STATEMENT_PDF_PAGES + 5 } })
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Read ONE page of an already-extracted statement PDF with the family's own AI key. Returns RAW strings; nothing is parsed or stored. The file and its password never reach this endpoint (E8/E9/E10).",
  })
  @ApiResponse({ status: 200, description: "Raw rows for this page" })
  @ApiResponse({
    status: 412,
    description: "code=STATEMENT_AI_NOT_CONFIGURED",
  })
  @ApiResponse({ status: 409, description: "code=AI_KEY_CORRUPTED" })
  @ApiResponse({ status: 422, description: "code=STATEMENT_NO_TEXT_LAYER" })
  @ApiResponse({
    status: 502,
    description:
      "code=STATEMENT_AI_AUTH | STATEMENT_AI_PARSE_FAILED | STATEMENT_AI_UPSTREAM_FAILED",
  })
  @ApiResponse({ status: 429, description: "code=STATEMENT_AI_RATE_LIMITED" })
  @ApiResponse({ status: 504, description: "code=STATEMENT_AI_TIMEOUT" })
  async readStatementPdfPage(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: ReadStatementPdfPageDto,
  ): Promise<StatementPageReadDto> {
    try {
      return await this.reconciliationService.readStatementPdfPage(
        familyGroupId,
        dto,
      );
    } catch (err: unknown) {
      throw toStatementReaderHttpException(err, this.logger);
    }
  }

  /**
   * EPIC-029 follow-up — parse the merged per-page reading and run the
   * totals gate. No AI call, so no throttle beyond the global one and no
   * second charge to the family.
   */
  @Post("statement-pdf/preview")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Parse a merged statement draft and cross-check it against the statement's own printed totals. Nothing is persisted (E3a) — the confirm step writes, and re-runs this same pipeline.",
  })
  @ApiResponse({ status: 200, description: "Preview — nothing persisted" })
  @ApiResponse({
    status: 422,
    description:
      "code=STATEMENT_ZERO_VALID_ROWS | STATEMENT_COLUMN_MAPPING_MISMATCH",
  })
  previewStatementDraft(
    @Body() dto: PreviewStatementDraftDto,
  ): StatementPreviewDto {
    return this.reconciliationService.previewStatementDraft(dto);
  }

  // The confirm half. No AI call, so no extra throttle beyond the global
  // one — and no second charge to the family for pressing "import".
  @Post("statement-pdf/confirm")
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Confirm a statement-PDF preview. Re-parses the SAME raw draft server-side (every amount through parseStatementAmount) and re-runs the totals gate before storing anything.",
  })
  @ApiResponse({ status: 201, description: "BankSync created" })
  @ApiResponse({
    status: 422,
    description:
      "code=STATEMENT_TOTALS_MISMATCH — the extracted rows disagree with the statement's own totals; the import is refused (E7), with the discrepancy in the body",
  })
  confirmStatementPdf(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CommitStatementDraftDto,
  ): Promise<BankSyncDto> {
    return this.reconciliationService.commitStatementDraft(familyGroupId, dto);
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

  /**
   * Turn ONE bank line into a real Transaction.
   *
   * `match` above links a line to a transaction that already EXISTS. If the
   * family never typed it in there was nothing to link to, so every line
   * stayed "Tidak Ditemukan" and an imported statement never appeared on
   * /transaksi. This is the missing direction.
   */
  @Post(":syncId/entries/:entryId/import")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "syncId", type: String })
  @ApiParam({ name: "entryId", type: String })
  @ApiOperation({
    summary:
      "Create a Transaction from an unmatched bank sync entry and link the two. Direction comes from the sign on the bank line.",
  })
  @ApiResponse({ status: 200, description: "Updated BankSyncEntry" })
  @ApiResponse({
    status: 400,
    description:
      "code=ENTRY_ALREADY_MATCHED | ENTRY_ZERO_AMOUNT | ENTRY_AMOUNT_OUT_OF_RANGE",
  })
  importEntry(
    @Param("familyGroupId") familyGroupId: string,
    @Param("syncId") syncId: string,
    @Param("entryId") entryId: string,
    @Body() dto: ImportEntriesDto,
  ): Promise<BankSyncEntryDto> {
    return this.reconciliationService.importEntry(
      familyGroupId,
      syncId,
      entryId,
      dto,
    );
  }

  /**
   * The bulk half. A real statement is 50+ lines, so importing them one press
   * at a time is a chore, not a feature. Rows that cannot be imported are
   * REPORTED rather than silently dropped.
   */
  @Post(":syncId/import-unmatched")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("create", "Reconciliation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "syncId", type: String })
  @ApiOperation({
    summary:
      "Create a Transaction for every still-unlinked entry on this sync. Idempotent: a line already linked to a transaction is never imported twice.",
  })
  @ApiResponse({
    status: 200,
    description: "How many were imported, what was skipped, what remains",
  })
  importUnmatchedEntries(
    @Param("familyGroupId") familyGroupId: string,
    @Param("syncId") syncId: string,
    @Body() dto: ImportEntriesDto,
  ): Promise<ImportEntriesResultDto> {
    return this.reconciliationService.importUnmatchedEntries(
      familyGroupId,
      syncId,
      dto,
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
