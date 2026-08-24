import { Module } from "@nestjs/common";

import { AiAdvisorModule } from "../ai-advisor/ai-advisor.module";
import { CategorizationModule } from "../categorization/categorization.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { OcrFactory } from "./ocr/ocr.factory";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

/**
 * EPIC-027 B5 (D11) — the `OCR_PORT` binding is gone. It read
 * `ANTHROPIC_API_KEY` once at boot (one server key billed for every
 * family) and fell back to `MockOcrService`, so a server without that env
 * var answered receipt scans with `Math.random()` amounts. Scanning now
 * resolves the caller's OWN family AI key per request via `AiKeyService`
 * (imported from `AiAdvisorModule`, which exports it, rather than
 * re-provided here — a second provider entry would be a second instance)
 * and builds the adapter with `OcrFactory`.
 */
@Module({
  imports: [AiAdvisorModule, CategorizationModule, NotificationsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, OcrFactory],
  // EPIC-021 Group C (#29) — ReconciliationModule reuses TransactionsService
  // directly (transfer + linked admin-fee creation) instead of re-deriving
  // that logic, so it must be exported for cross-module injection.
  // EPIC-019 Task B — AllowanceRequestsModule reuses TransactionsService to
  // execute an approved request as a REAL transfer (the EPIC-021 Group B
  // primitive), instead of duplicating the balance-move logic.
  exports: [TransactionsService],
})
export class TransactionsModule {}
