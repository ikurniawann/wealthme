import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { TransactionsModule } from "../transactions/transactions.module";

import { ReconciliationController } from "./reconciliation.controller";
import { ReconciliationService } from "./reconciliation.service";

@Module({
  // EPIC-021 Group C (#29) — TransactionsModule supplies TransactionsService
  // so the fee-split endpoint can reuse its transfer/adminFee mechanics
  // instead of re-implementing balance updates here.
  imports: [PrismaModule, TransactionsModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
