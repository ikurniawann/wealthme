import { Logger } from "@nestjs/common";

import { NotificationSenderPort } from "./notification-sender.port";

export class MockNotificationSenderService extends NotificationSenderPort {
  private readonly logger = new Logger(MockNotificationSenderService.name);

  async sendEmail(
    to: string,
    _toName: string,
    subject: string,
    _body: string,
  ): Promise<void> {
    this.logger.log(`[MOCK] Email → ${to}: ${subject}`);
  }
}
