import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PrismaModule } from "../prisma/prisma.module";

import { MockNotificationSenderService } from "./mock-notification-sender.service";
import { NOTIFICATION_SENDER_PORT } from "./notification-sender.port";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { SendGridNotificationSenderAdapter } from "./sendgrid-notification-sender.adapter";

import type { Env } from "../config/env";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: NOTIFICATION_SENDER_PORT,
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get("SENDGRID_API_KEY", { infer: true });
        const from =
          config.get("NOTIFICATION_FROM_EMAIL", { infer: true }) ??
          "noreply@wealthme.app";
        if (apiKey) return new SendGridNotificationSenderAdapter(apiKey, from);
        if (config.get("NODE_ENV", { infer: true }) === "production") {
          throw new Error("SENDGRID_API_KEY is required in production");
        }
        return new MockNotificationSenderService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NOTIFICATION_SENDER_PORT],
})
export class NotificationsModule {}
