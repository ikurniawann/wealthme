import { Module } from "@nestjs/common";

import { AiAdvisorModule } from "../ai-advisor/ai-advisor.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";

import { InsuranceDocumentsService } from "./insurance-documents.service";
import { InsurancePaymentsService } from "./insurance-payments.service";
import { InsurancePremiumBudgetService } from "./insurance-premium-budget.service";
import { InsuranceRemindersService } from "./insurance-reminders.service";
import { InsuranceReportController } from "./insurance-report.controller";
import { InsuranceReportService } from "./insurance-report.service";
import { InsuranceValuationsService } from "./insurance-valuations.service";
import { InsurancesController } from "./insurances.controller";
import { InsurancesService } from "./insurances.service";
import { InsuranceReportReaderFactory } from "./report-reader/insurance-report-reader.factory";
import { InsuranceValueModule } from "./value/insurance-value.module";

@Module({
  // NotificationsModule — `pay()` fires `checkBudgetAlert`, which needs
  // `NOTIFICATION_SENDER_PORT` (H5). InsuranceValueModule — the shared S6
  // net-worth helper (also imported by dashboard/reports). Task 23:
  // AiAdvisorModule exports AiKeyService (the ONE source of the family's
  // decrypted key); StorageModule provides StoragePort for documents.
  imports: [
    PrismaModule,
    NotificationsModule,
    InsuranceValueModule,
    AiAdvisorModule,
    StorageModule,
  ],
  controllers: [InsurancesController, InsuranceReportController],
  providers: [
    InsurancesService,
    InsurancePaymentsService,
    InsurancePremiumBudgetService,
    InsuranceRemindersService,
    InsuranceValuationsService,
    InsuranceDocumentsService,
    InsuranceReportService,
    InsuranceReportReaderFactory,
  ],
  exports: [InsurancesService, InsuranceRemindersService],
})
export class InsurancesModule {}
