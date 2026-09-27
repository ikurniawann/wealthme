import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { LiabilitiesController } from "./liabilities.controller";
import { LiabilitiesService } from "./liabilities.service";
import { LiabilityFloatingRatesController } from "./liability-floating-rates.controller";
import { LiabilityFloatingRatesService } from "./liability-floating-rates.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [LiabilitiesController, LiabilityFloatingRatesController],
  providers: [LiabilitiesService, LiabilityFloatingRatesService],
  exports: [LiabilitiesService],
})
export class LiabilitiesModule {}
