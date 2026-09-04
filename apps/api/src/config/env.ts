import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  // Required — Prisma connects to Postgres at startup; fail fast if absent.
  DATABASE_URL: z.string().url(),
  // Auth / Redis — required by Task 3 (auth module)
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  // Google OAuth — optional; empty string treated as unset
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default("http://localhost:4000/auth/google/callback")
    .refine(
      (url) =>
        process.env["NODE_ENV"] !== "production" || url.startsWith("https://"),
      { message: "GOOGLE_CALLBACK_URL must use HTTPS in production" },
    ),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),
  // EPIC-024 Task L1 (D15) — root directory StorageDiskService reads/writes
  // under. Backed by a persistent Docker volume in docker-compose.yml
  // (`attachments_data`), not MinIO — disk now, S3 later without feature
  // changes per the epic's design decision.
  STORAGE_DIR: z.string().default("/data/storage"),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().optional(),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  // Anthropic — optional; enables real Claude OCR when set.
  // Empty string (from .env placeholder) is treated as unset.
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  // Brick Open Banking — optional; both must be set to enable real adapter.
  // Empty string (from .env placeholder) is treated as unset.
  BRICK_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  BRICK_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  // Encryption at rest — optional; 64 hex chars = 32 bytes for AES-256-GCM
  ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]+$/)
    .optional()
    .refine(
      (key) => process.env["NODE_ENV"] !== "production" || key !== undefined,
      { message: "ENCRYPTION_KEY is required in production" },
    ),
  // Market data — optional; set to "true" to use Yahoo Finance instead of mock
  USE_REAL_MARKET_DATA: z.enum(["true", "false"]).optional(),
  // Email notifications — optional; both must be set to enable real SendGrid sender.
  // Empty string (from .env placeholder) is treated as unset.
  SENDGRID_API_KEY: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  NOTIFICATION_FROM_EMAIL: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .pipe(z.string().email().optional()),
  // Set to "disabled" to run WITHOUT any email sender on purpose — the only
  // way a production deployment may start with no SENDGRID_API_KEY. Every
  // email it would have sent is logged at WARN instead (see
  // notifications.module.ts and disabled-notification-sender.service.ts).
  // In-app notifications are unaffected.
  NOTIFICATION_EMAIL_SENDER: z.enum(["disabled"]).optional(),
  // Observability — optional; Sentry error tracking.
  // Empty string (from .env placeholder) is treated as unset.
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .pipe(z.string().url().optional()),
  // Optional; structured log level override (default: info in prod, debug in dev)
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return result.data;
}
