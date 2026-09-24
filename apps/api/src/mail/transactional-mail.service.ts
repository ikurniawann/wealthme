import { Injectable, Logger } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

import type { Env } from "../config/env";

const DEFAULT_FROM = "sysadmin@wit.id";
const SMTPS_PORT = 465;
const DEFAULT_SMTP_PORT = 587;

export type TransactionalMail = {
  to: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * EPIC-031 — account mail the API itself must deliver (the member
 * email-confirmation link), over the same SMTP the web app uses for
 * "Lupa Password". Kept separate from NotificationSenderPort on purpose:
 * enabling SMTP here must not start mailing budget alerts from dev servers.
 *
 * No SMTP configured: outside production the message (with its link) is
 * logged so a local run can still finish the flow; in production it is
 * dropped with an error log — never a silent success.
 */
@Injectable()
export class TransactionalMailService {
  private readonly logger = new Logger(TransactionalMailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const host = this.config.get("SMTP_HOST", { infer: true });
    const port =
      this.config.get("SMTP_PORT", { infer: true }) ?? DEFAULT_SMTP_PORT;
    const user = this.config.get("SMTP_USER", { infer: true });
    this.from = this.config.get("SMTP_FROM", { infer: true }) ?? DEFAULT_FROM;
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === SMTPS_PORT,
          auth: user
            ? {
                user,
                pass: this.config.get("SMTP_PASSWORD", { infer: true }) ?? "",
              }
            : undefined,
        })
      : null;
  }

  async send(mail: TransactionalMail): Promise<void> {
    if (!this.transporter) {
      if (this.config.get("NODE_ENV", { infer: true }) !== "production") {
        this.logger.log(
          `[dev mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`,
        );
      } else {
        this.logger.error(
          `SMTP_HOST is unset — "${mail.subject}" to ${mail.to} was not sent`,
        );
      }
      return;
    }
    await this.transporter.sendMail({
      from: { name: "WealthMe", address: this.from },
      to: { name: mail.toName, address: mail.to },
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  }
}
