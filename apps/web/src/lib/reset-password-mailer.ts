import nodemailer from "nodemailer";

/**
 * Delivers better-auth's "Lupa Password" link (auth.ts →
 * emailAndPassword.sendResetPassword).
 *
 * Transport order: SMTP (SMTP_HOST set — e.g. Google Workspace
 * smtp.gmail.com with a sysadmin@wit.id app password) → SendGrid
 * (SENDGRID_API_KEY) → none. The sender defaults to sysadmin@wit.id and can
 * be overridden with SMTP_FROM.
 */
const DEFAULT_FROM = "sysadmin@wit.id";
const SENDER_NAME = "WealthMe";
const SMTPS_PORT = 465;
const DEFAULT_SMTP_PORT = 587;

type MailEnv = Readonly<Record<string, string | undefined>>;

export type ResetMailTransport =
  | {
      kind: "smtp";
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string } | undefined;
      from: string;
    }
  | { kind: "sendgrid"; apiKey: string; from: string }
  | { kind: "none" };

const blankToUndefined = (v: string | undefined) => v?.trim() || undefined;

export function resolveResetMailTransport(env: MailEnv): ResetMailTransport {
  const from = blankToUndefined(env.SMTP_FROM) ?? DEFAULT_FROM;
  const host = blankToUndefined(env.SMTP_HOST);
  if (host) {
    const port = Number(blankToUndefined(env.SMTP_PORT) ?? DEFAULT_SMTP_PORT);
    const user = blankToUndefined(env.SMTP_USER);
    return {
      kind: "smtp",
      host,
      port,
      // 465 is implicit TLS; 587/25 upgrade via STARTTLS.
      secure: port === SMTPS_PORT,
      auth: user ? { user, pass: env.SMTP_PASSWORD ?? "" } : undefined,
      from,
    };
  }
  const apiKey = blankToUndefined(env.SENDGRID_API_KEY);
  if (apiKey) return { kind: "sendgrid", apiKey, from };
  return { kind: "none" };
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function buildResetPasswordEmail({
  name,
  url,
}: {
  name: string;
  url: string;
}) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  return {
    subject: "Reset Password WealthMe",
    html: `<p>Halo ${safeName},</p><p>Klik link berikut untuk mereset password Anda:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>Link ini berlaku selama 1 jam. Abaikan email ini jika Anda tidak meminta reset password.</p>`,
    text: `Halo ${name},\n\nKlik link berikut untuk mereset password Anda:\n${url}\n\nLink ini berlaku selama 1 jam. Abaikan email ini jika Anda tidak meminta reset password.`,
  };
}

export async function sendResetPasswordEmail(
  to: { email: string; name: string },
  url: string,
  env: MailEnv = process.env,
): Promise<void> {
  const transport = resolveResetMailTransport(env);
  const mail = buildResetPasswordEmail({ name: to.name, url });

  if (transport.kind === "none") {
    // Dev-only escape hatch so a local run without mail can still finish a
    // reset. NEVER in production: the URL is a bearer credential.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[reset-password] URL for ${to.email}: ${url}`);
    } else {
      console.error(
        "[reset-password] No mail transport (SMTP_HOST / SENDGRID_API_KEY) — no reset email was sent.",
      );
    }
    return;
  }

  if (transport.kind === "smtp") {
    await nodemailer
      .createTransport({
        host: transport.host,
        port: transport.port,
        secure: transport.secure,
        auth: transport.auth,
      })
      .sendMail({
        from: { name: SENDER_NAME, address: transport.from },
        to: { name: to.name, address: to.email },
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    return;
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${transport.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to.email, name: to.name }] }],
      from: { email: transport.from, name: SENDER_NAME },
      subject: mail.subject,
      content: [
        { type: "text/plain", value: mail.text },
        { type: "text/html", value: mail.html },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`SendGrid responded ${res.status}`);
  }
}
