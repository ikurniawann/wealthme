import { Module } from "@nestjs/common";

import { AiAdvisorModule } from "../ai-advisor/ai-advisor.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TransactionsModule } from "../transactions/transactions.module";

import { ReconciliationController } from "./reconciliation.controller";
import { ReconciliationService } from "./reconciliation.service";
import { StatementReaderFactory } from "./statement-reader/statement-reader.factory";

@Module({
  // EPIC-021 Group C (#29) — TransactionsModule supplies TransactionsService
  // so the fee-split endpoint can reuse its transfer/adminFee mechanics
  // instead of re-implementing balance updates here.
  // EPIC-029 E5 — AiAdvisorModule exports AiKeyService, the ONE place a
  // family's decrypted provider key comes from. Imported (not re-provided)
  // so the statement reader, receipt OCR and the advisor all share one
  // instance and one contract about where that key may go.
  imports: [PrismaModule, TransactionsModule, AiAdvisorModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, StatementReaderFactory],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
