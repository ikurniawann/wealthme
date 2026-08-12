import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/server-env";
import { signCookieValue } from "@/lib/signed-cookie";

export const runtime = "nodejs";

// EPIC-023 D2 (US-FAM-13, D7) — device-bound PIN unlock, client side.
//
// better-auth's own session cookie (`better-auth.session_token`, verified
// against the installed better-auth@1.6.25 package's cookies/index.mjs) is
// `httpOnly: true` — client-side JavaScript cannot write it via
// `document.cookie`, so a client component calling `apps/api`'s
// `POST /auth/devices/:id/unlock` directly can receive the minted session
// token but has no way to actually install it as better-auth's session
// cookie. This Route Handler is the one place in `apps/web` (Node runtime,
// can set httpOnly cookies) that bridges the two: it forwards the unlock
// call to `apps/api` server-side, then — on success — sets the SAME cookie
// name/attributes better-auth's own sign-in flow sets, so
// `authClient.useSession()` (and everything built on it, including
// `apps/web/src/middleware.ts`'s route gate) picks it up exactly as if a
// normal password login had just happened. This does not create a second
// auth pathway: it installs the identical cookie shape, using a token that
// `BetterAuthGuard`'s own `baSession.findUnique({ where: { token } })`
// lookup already validates for every other authenticated request.
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

function sessionCookieName(): string {
  // Mirrors better-auth's own cookie-name logic (createCookieGetter in
  // cookies/index.mjs): the `__Secure-` prefix is added whenever cookies are
  // marked secure, which this codebase's `auth.ts` leaves at its default
  // (secure in production, not secure otherwise — no `useSecureCookies`
  // override present).
  return process.env.NODE_ENV === "production"
    ? "__Secure-better-auth.session_token"
    : "better-auth.session_token";
}

type UnlockRequestBody = {
  deviceId?: unknown;
  deviceSecret?: unknown;
  pin?: unknown;
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: UnlockRequestBody;
  try {
    body = (await request.json()) as UnlockRequestBody;
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }

  const { deviceId, deviceSecret, pin } = body;
  if (
    typeof deviceId !== "string" ||
    typeof deviceSecret !== "string" ||
    typeof pin !== "string" ||
    !deviceId ||
    !deviceSecret ||
    !pin
  ) {
    return NextResponse.json(
      { message: "deviceId, deviceSecret, and pin are required" },
      { status: 400 },
    );
  }

  let apiUrl: string;
  try {
    apiUrl = getServerEnv().API_URL;
  } catch (error) {
    // Misconfigured deployment (API_URL missing/invalid) — surface a clear
    // "server error" the client can distinguish from an actually wrong PIN,
    // instead of crashing or silently hitting the wrong host.
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Server misconfiguration: API_URL is not set",
      },
      { status: 500 },
    );
  }

  const apiRes = await fetch(
    `${apiUrl}/auth/devices/${encodeURIComponent(deviceId)}/unlock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceSecret, pin }),
    },
  );

  if (!apiRes.ok) {
    const errorBody = (await apiRes.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      remainingMs?: number;
    };
    return NextResponse.json(
      {
        message: errorBody.message ?? "Unlock failed",
        code: errorBody.code,
        remainingMs: errorBody.remainingMs,
      },
      { status: apiRes.status },
    );
  }

  const { token } = (await apiRes.json()) as { token: string };

  // HOTFIX (found by EPIC-024's deploy-smoke e2e run through nginx — this
  // route's PIN-unlock flow was unreachable before Group B's nginx fix, so
  // this bug was never exercised until now): better-auth signs its session
  // cookie value as `${token}.${HMAC-SHA256(token)}` (verified against the
  // installed better-auth@1.6.25 → hono@4.13.0 cookie utils — better-auth's
  // `setSignedCookie` delegates straight to hono's `serializeSigned`). A
  // PLAIN unsigned `token` here used to pass the middleware's presence-only
  // check (so `/beranda` returned 200 once), but `authClient.useSession()`
  // validates the signature client-side via `GET /api/auth/get-session`,
  // fails, and `app-shell.tsx` bounces back to `/login` within ~1s.
  // `signCookieValue` replicates hono's exact algorithm (HMAC-SHA256, plain
  // base64, `${value}.${signature}`) using the same BETTER_AUTH_SECRET so
  // better-auth's own verifier accepts it.
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "Server misconfiguration: BETTER_AUTH_SECRET is not set" },
      { status: 500 },
    );
  }
  const signedToken = await signCookieValue(token, secret);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
