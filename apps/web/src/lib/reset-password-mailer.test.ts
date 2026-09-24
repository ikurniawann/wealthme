/**
 * @jest-environment node
 */
import {
  buildResetPasswordEmail,
  resolveResetMailTransport,
} from "./reset-password-mailer";

describe("resolveResetMailTransport", () => {
  it("uses SMTP when SMTP_HOST is set, sending from sysadmin@wit.id by default", () => {
    const t = resolveResetMailTransport({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_USER: "sysadmin@wit.id",
      SMTP_PASSWORD: "app-password",
    });
    expect(t).toEqual({
      kind: "smtp",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "sysadmin@wit.id", pass: "app-password" },
      from: "sysadmin@wit.id",
    });
  });

  it("uses STARTTLS (secure=false) on port 587 and honours SMTP_FROM", () => {
    const t = resolveResetMailTransport({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_USER: "sysadmin@wit.id",
      SMTP_PASSWORD: "x",
      SMTP_FROM: "noreply@wit.id",
    });
    expect(t).toMatchObject({ kind: "smtp", port: 587, secure: false });
    expect(t.kind === "smtp" && t.from).toBe("noreply@wit.id");
  });

  it("sends without auth when no SMTP_USER (e.g. MailHog)", () => {
    const t = resolveResetMailTransport({
      SMTP_HOST: "mailhog",
      SMTP_PORT: "1025",
    });
    expect(t).toMatchObject({ kind: "smtp", port: 1025, auth: undefined });
  });

  it("falls back to SendGrid when only SENDGRID_API_KEY is set", () => {
    const t = resolveResetMailTransport({ SENDGRID_API_KEY: "SG.key" });
    expect(t).toEqual({
      kind: "sendgrid",
      apiKey: "SG.key",
      from: "sysadmin@wit.id",
    });
  });

  it("prefers SMTP over SendGrid when both are configured", () => {
    const t = resolveResetMailTransport({
      SMTP_HOST: "smtp.gmail.com",
      SENDGRID_API_KEY: "SG.key",
    });
    expect(t.kind).toBe("smtp");
  });

  it("reports none when nothing is configured", () => {
    expect(resolveResetMailTransport({})).toEqual({ kind: "none" });
  });
});

describe("buildResetPasswordEmail", () => {
  it("escapes the user's name so it cannot inject HTML", () => {
    const mail = buildResetPasswordEmail({
      name: '<img src=x onerror="alert(1)">',
      url: "https://app.example/reset-password?token=abc&x=1",
    });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
    expect(mail.html).toContain(
      'href="https://app.example/reset-password?token=abc&amp;x=1"',
    );
    expect(mail.text).toContain(
      "https://app.example/reset-password?token=abc&x=1",
    );
    expect(mail.subject).toBe("Reset Password WealthMe");
  });
});
