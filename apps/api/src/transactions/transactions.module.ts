import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { CategorizationModule } from "../categorization/categorization.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { ClaudeVisionOcrAdapter } from "./ocr/claude-vision-ocr.adapter";
import { MockOcrService } from "./ocr/mock-ocr.service";
import { OCR_PORT } from "./ocr/ocr.port";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

import type { Env } from "../config/env";

@Module({
  imports: [ConfigModule, CategorizationModule, NotificationsModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    {
      provide: OCR_PORT,
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get("ANTHROPIC_API_KEY", { infer: true });
        if (apiKey) return new ClaudeVisionOcrAdapter(apiKey);
        return new MockOcrService();
      },
      inject: [ConfigService],
    },
  ],
  // EPIC-021 Group C (#29) — ReconciliationModule reuses TransactionsService
  // directly (transfer + linked admin-fee creation) instead of re-deriving
  // that logic, so it must be exported for cross-module injection.
  // EPIC-019 Task B — AllowanceRequestsModule reuses TransactionsService to
  // execute an approved request as a REAL transfer (the EPIC-021 Group B
  // primitive), instead of duplicating the balance-move logic.
  exports: [TransactionsService],
})
export class TransactionsModule {}
