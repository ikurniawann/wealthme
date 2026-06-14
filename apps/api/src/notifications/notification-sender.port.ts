export abstract class NotificationSenderPort {
  abstract sendEmail(
    to: string,
    toName: string,
    subject: string,
    body: string,
  ): Promise<void>;
}

export const NOTIFICATION_SENDER_PORT = "NOTIFICATION_SENDER_PORT";
