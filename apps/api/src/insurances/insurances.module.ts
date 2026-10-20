import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { InsurancePaymentsService } from "./insurance-payments.service";
import { InsurancePremiumBudgetService } from "./insurance-premium-budget.service";
import { InsuranceRemindersService } from "./insurance-reminders.service";
import { InsuranceValuationsService } from "./insurance-valuations.service";
import { InsurancesController } from "./insurances.controller";
import { InsurancesService } from "./insurances.service";
import { InsuranceValueModule } from "./value/insurance-value.module";

@Module({
  // NotificationsModule — `pay()` fires `checkBudgetAlert`, which needs
  // `NOTIFICATION_SENDER_PORT` (H5). InsuranceValueModule — the shared S6
  // net-worth helper (also imported by dashboard/reports).
  imports: [PrismaModule, NotificationsModule, InsuranceValueModule],
  controllers: [InsurancesController],
  providers: [
    InsurancesService,
    InsurancePaymentsService,
    InsurancePremiumBudgetService,
    InsuranceRemindersService,
    InsuranceValuationsService,
  ],
  exports: [InsurancesService, InsuranceRemindersService],
})
export class InsurancesModule {}
