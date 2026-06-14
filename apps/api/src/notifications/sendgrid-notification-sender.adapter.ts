import { NotificationSenderPort } from "./notification-sender.port";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

export class SendGridNotificationSenderAdapter extends NotificationSenderPort {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
  ) {
    super();
  }

  async sendEmail(
    to: string,
    toName: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const res = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to, name: toName }] }],
        from: { email: this.fromEmail, name: "WealthMe" },
        subject,
        content: [{ type: "text/html", value: body }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SendGrid error ${res.status}: ${text.slice(0, 200)}`);
    }
  }
}
