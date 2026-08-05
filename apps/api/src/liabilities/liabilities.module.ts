import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { LiabilitiesController } from "./liabilities.controller";
import { LiabilitiesService } from "./liabilities.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [LiabilitiesController],
  providers: [LiabilitiesService],
  exports: [LiabilitiesService],
})
export class LiabilitiesModule {}
