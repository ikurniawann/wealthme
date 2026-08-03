import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { FamilyGroupsController } from "./family-groups.controller";
import { FamilyGroupsService } from "./family-groups.service";

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule],
  controllers: [FamilyGroupsController],
  providers: [FamilyGroupsService],
  exports: [FamilyGroupsService],
})
export class FamilyGroupsModule {}
