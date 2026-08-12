/**
 * Zod-validated SERVER-ONLY environment config.
 *
 * Split out from `./env.ts` (EPIC-024 hotfix) — that module also exports a
 * top-level `env` constant validated EAGERLY at import time
 * (`NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_API_URL`). Any route that imported
 * `./env` just to reach `getServerEnv()` (server-only `API_URL`) also
 * triggered that unrelated eager parse — which throws during `next build`'s
 * page-data-collection step in any environment without the NEXT_PUBLIC_*
 * vars set (e.g. CI, which correctly has no committed `.env`). This broke
 * `next build` for every push since the PIN nginx fix (EPIC-024 Group B)
 * introduced the `getServerEnv()` import in
 * `apps/web/src/app/api/device-unlock/route.ts`, silently blocking the
 * GHCR image pipeline for the rest of the epic.
 *
 * `API_URL` (no NEXT_PUBLIC_ prefix) is read server-side ONLY by
 * `apps/web/src/app/api/device-unlock/route.ts` to reach NestJS directly.
 * Kept in its own module, never imported by any client-reachable code path,
 * so it can never be inlined into the client bundle.
 */

import { z } from "zod";

const serverEnvSchema = z.object({
  /** Base URL of the backend API reachable from the server (no trailing slash). */
  API_URL: z.string().url({
    message: "API_URL must be a valid URL (e.g. http://localhost:4000)",
  }),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseServerEnv(): Readonly<ServerEnv> {
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

/**
 * Validated SERVER-ONLY environment config. Call from server-side code only
 * (Route Handlers, Server Components/Actions) — `API_URL` is never exposed
 * to the client bundle. Throws a clear, actionable error on every call if
 * `API_URL` is missing or invalid, instead of silently defaulting to
 * `http://localhost:4000` (which is wrong for every deployed environment).
 * Deliberately NOT cached and NOT parsed at module load — a route that only
 * needs this must not pay for (or crash on) an unrelated eager parse, and
 * caching would let a first-call result mask a later misconfiguration.
 */
export function getServerEnv(): Readonly<ServerEnv> {
  return parseServerEnv();
}
