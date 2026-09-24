import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { FamilyGroupsController } from "./family-groups.controller";
import { FamilyGroupsService } from "./family-groups.service";
import { MemberEmailService } from "./member-email.service";

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule, MailModule],
  controllers: [FamilyGroupsController],
  providers: [FamilyGroupsService, MemberEmailService],
  exports: [FamilyGroupsService],
})
export class FamilyGroupsModule {}
