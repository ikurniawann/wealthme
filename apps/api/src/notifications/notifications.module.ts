import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PrismaModule } from "../prisma/prisma.module";

import { DisabledNotificationSenderService } from "./disabled-notification-sender.service";
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

        // Checked BEFORE the key so an explicit operator decision always wins
        // over a leftover credential. This is the only sanctioned way to run
        // production without a mail provider: a deployment that genuinely
        // sends no email says so out loud (every attempt is logged at WARN)
        // instead of carrying a placeholder key that fails at send time —
        // which is the silent failure the throw below exists to prevent, not
        // a workaround for it.
        if (
          config.get("NOTIFICATION_EMAIL_SENDER", { infer: true }) ===
          "disabled"
        ) {
          return new DisabledNotificationSenderService();
        }

        if (apiKey) return new SendGridNotificationSenderAdapter(apiKey, from);
        if (config.get("NODE_ENV", { infer: true }) === "production") {
          throw new Error(
            "No notification email sender configured. Set SENDGRID_API_KEY, " +
              "or NOTIFICATION_EMAIL_SENDER=disabled to run without email on purpose.",
          );
        }
        return new MockNotificationSenderService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NOTIFICATION_SENDER_PORT],
})
export class NotificationsModule {}
