import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { DisabledNotificationSenderService } from "./disabled-notification-sender.service";
import { MockNotificationSenderService } from "./mock-notification-sender.service";
import { NOTIFICATION_SENDER_PORT } from "./notification-sender.port";
import { NotificationsModule } from "./notifications.module";
import { NotificationsService } from "./notifications.service";
import { SendGridNotificationSenderAdapter } from "./sendgrid-notification-sender.adapter";

/**
 * Which email sender a deployment gets is a security-relevant decision — a
 * production instance that quietly stops emailing is the failure this factory
 * is built to prevent — so every branch is pinned here.
 */
async function resolveSender(env: Record<string, string | undefined>) {
  const moduleRef = await Test.createTestingModule({
    imports: [NotificationsModule],
  })
    .overrideProvider(ConfigService)
    .useValue({ get: (key: string) => env[key] })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(NotificationsService)
    .useValue({})
    .compile();
  return moduleRef.get(NOTIFICATION_SENDER_PORT);
}

describe("NotificationsModule — email sender selection", () => {
  it("uses SendGrid when a key is present", async () => {
    const sender = await resolveSender({
      NODE_ENV: "production",
      SENDGRID_API_KEY: "SG.real-key",
      NOTIFICATION_FROM_EMAIL: "noreply@wealthme.id",
    });
    expect(sender).toBeInstanceOf(SendGridNotificationSenderAdapter);
  });

  it("refuses to boot in production with no key and no explicit opt-out", async () => {
    await expect(
      resolveSender({ NODE_ENV: "production", SENDGRID_API_KEY: undefined }),
    ).rejects.toThrow(/No notification email sender configured/);
  });

  it("boots in production with NOTIFICATION_EMAIL_SENDER=disabled", async () => {
    const sender = await resolveSender({
      NODE_ENV: "production",
      SENDGRID_API_KEY: undefined,
      NOTIFICATION_EMAIL_SENDER: "disabled",
    });
    expect(sender).toBeInstanceOf(DisabledNotificationSenderService);
  });

  it("lets the explicit opt-out win over a leftover key", async () => {
    const sender = await resolveSender({
      NODE_ENV: "production",
      SENDGRID_API_KEY: "SG.stale-key",
      NOTIFICATION_EMAIL_SENDER: "disabled",
    });
    expect(sender).toBeInstanceOf(DisabledNotificationSenderService);
  });

  it("falls back to the mock outside production", async () => {
    const sender = await resolveSender({
      NODE_ENV: "development",
      SENDGRID_API_KEY: undefined,
    });
    expect(sender).toBeInstanceOf(MockNotificationSenderService);
  });

  it("logs every dropped email at warn rather than swallowing it", async () => {
    const sender = new DisabledNotificationSenderService();
    const warn = jest
      .spyOn(
        (sender as unknown as { logger: { warn: (m: string) => void } }).logger,
        "warn",
      )
      .mockImplementation(() => undefined);

    await sender.sendEmail(
      "ana@example.com",
      "Ana",
      "Tagihan jatuh tempo",
      "…",
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ana@example.com"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Tagihan jatuh tempo"),
    );
  });
});
