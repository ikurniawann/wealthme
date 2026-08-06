import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { InsurancesController } from "./insurances.controller";
import { InsurancesService } from "./insurances.service";

@Module({
  // H5 (group E retry round 4) — `InsurancesService.pay()` now fires
  // `checkBudgetAlert` (mirrors `LiabilitiesModule`'s own import), which
  // needs `NOTIFICATION_SENDER_PORT`.
  imports: [PrismaModule, NotificationsModule],
  controllers: [InsurancesController],
  providers: [InsurancesService],
  exports: [InsurancesService],
})
export class InsurancesModule {}
