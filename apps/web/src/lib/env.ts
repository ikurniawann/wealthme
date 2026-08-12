/**
 * Zod-validated environment config for the web app.
 *
 * Only NEXT_PUBLIC_* variables are validated here — they are the ones
 * inlined at build time by Next.js and available on both server and client.
 *
 * Import `env` wherever a typed env var is needed instead of reading
 * `process.env` directly. Fails fast at module load with a clear error
 * listing every missing or invalid variable.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema — extend this as new public variables are introduced.
// ---------------------------------------------------------------------------

const envSchema = z.object({
  /** Base URL of this Next.js application (no trailing slash). */
  NEXT_PUBLIC_APP_URL: z.string().url({
    message:
      "NEXT_PUBLIC_APP_URL must be a valid URL (e.g. http://localhost:3000)",
  }),

  /** Base URL of the backend API (no trailing slash). */
  NEXT_PUBLIC_API_URL: z.string().url({
    message:
      "NEXT_PUBLIC_API_URL must be a valid URL (e.g. http://localhost:4000)",
  }),
});

// ---------------------------------------------------------------------------
// Parse — fail fast if any required variable is absent or invalid.
// ---------------------------------------------------------------------------

function parseEnv(): Readonly<z.infer<typeof envSchema>> {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `[env] Missing or invalid environment variables:\n${issues}\n\n` +
        `Copy apps/web/.env.example to apps/web/.env.local and fill in the required values.`,
    );
  }

  return Object.freeze(result.data);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// EPIC-024 hotfix: the server-only `API_URL` schema (`getServerEnv()`) that
// used to live in this file was moved to `./server-env.ts`. Importing THIS
// module (for the NEXT_PUBLIC_* client schema below) always triggers the
// eager `parseEnv()` call at the bottom of this file; a route that only
// needed `getServerEnv()` was paying for — and crashing on — that unrelated
// eager parse in any environment without NEXT_PUBLIC_APP_URL/API_URL set
// (e.g. CI's `next build`, which correctly has no committed `.env`). See
// `./server-env.ts`'s module comment for the full incident.

/** Typed, immutable environment config validated at module load. */
export const env: Readonly<Env> = parseEnv();

/** Inferred type of the validated environment config. */
export type Env = z.infer<typeof envSchema>;
