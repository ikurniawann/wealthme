import { Logger } from "@nestjs/common";

import { NotificationSenderPort } from "./notification-sender.port";

/**
 * The deliberate "this deployment sends no email" sender.
 *
 * Distinct from `MockNotificationSenderService`, which exists so local and
 * test runs have *something* to inject: this one is selected by an operator
 * setting `NOTIFICATION_EMAIL_SENDER=disabled`, and it is the only way a
 * production deployment is allowed to run without a mail provider (see
 * notifications.module.ts).
 *
 * It logs every dropped email at WARN, with the recipient and subject, so the
 * absence is visible in the logs rather than inferred from a user complaint —
 * the failure mode this whole branch exists to avoid is an email that everyone
 * assumes was sent. In-app notifications are unaffected: they are rows in the
 * `notifications` table written by NotificationsService, and never travel
 * through this port.
 */
export class DisabledNotificationSenderService extends NotificationSenderPort {
  private readonly logger = new Logger(DisabledNotificationSenderService.name);

  async sendEmail(
    to: string,
    _toName: string,
    subject: string,
    _body: string,
  ): Promise<void> {
    this.logger.warn(
      `Email NOT sent (NOTIFICATION_EMAIL_SENDER=disabled) → ${to}: ${subject}`,
    );
  }
}
