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
// Server-only schema — EPIC-024 B2. `API_URL` (no NEXT_PUBLIC_ prefix) is
// read server-side ONLY by apps/web/src/app/api/device-unlock/route.ts to
// reach NestJS directly. That route previously fell back silently to
// `http://localhost:4000` when unset, which is wrong in every deployed
// environment and produces a misleading "PIN salah" toast instead of a
// clear failure. Validated separately from `envSchema` above so it is never
// accidentally inlined into the client bundle (only NEXT_PUBLIC_* vars may
// cross that boundary).
//
// Deliberately checked lazily (`getServerEnv()`, called from inside the
// route handler) rather than eagerly at module load like `env` above: this
// module is imported by a Route Handler that Jest imports directly in
// `route.test.ts`, and CI's test job does not populate `API_URL` — an eager
// top-level parse would throw during test collection, before any test gets
// to mock `fetch`. A lazy check still fails fast, on the first real request,
// with the same clear error instead of a silent bad-hostname fetch.
// ---------------------------------------------------------------------------

const serverEnvSchema = z.object({
  /** Base URL of the backend API reachable from the server (no trailing slash). */
  API_URL: z.string().url({
    message: "API_URL must be a valid URL (e.g. http://localhost:4000)",
  }),
});

function parseServerEnv(): Readonly<z.infer<typeof serverEnvSchema>> {
  const result = serverEnvSchema.safeParse({
    API_URL: process.env.API_URL,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `[env] Missing or invalid server-only environment variables:\n${issues}\n\n` +
        `Set API_URL in the repo-root .env (see .env.example).`,
    );
  }

  return Object.freeze(result.data);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Typed, immutable environment config validated at module load. */
export const env: Readonly<Env> = parseEnv();

/** Inferred type of the validated environment config. */
export type Env = z.infer<typeof envSchema>;

/** Inferred type of the validated server-only environment config. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validated SERVER-ONLY environment config. Call from server-side code only
 * (Route Handlers, Server Components/Actions) — `API_URL` is never exposed
 * to the client bundle. Throws a clear, actionable error on every call if
 * `API_URL` is missing or invalid, instead of silently defaulting to
 * `http://localhost:4000` (which is wrong for every deployed environment).
 * Deliberately NOT cached — this is a single cheap Zod parse of one string
 * per request, and caching would let a first-call result mask a later
 * misconfiguration (or complicate test isolation) for no real benefit.
 */
export function getServerEnv(): Readonly<ServerEnv> {
  return parseServerEnv();
}
