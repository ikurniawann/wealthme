// Authenticated fetch wrapper — attaches the Bearer token from the session and,
// on a 401, ends the dead session and sends the user to /login.
//
// That last part used to be a LIE: this header claimed the wrapper "retries
// once after a 401 by signing out", but no 401 handling existed anywhere in
// the app. The result was a silent dead end — once a session was revoked
// (expired, password changed elsewhere, or the demo DB re-seeded, which wipes
// `baSession` rows) the shell kept rendering from cache and looked signed in,
// while every write failed with a bare "Gagal menyimpan: Unauthorized" toast
// and no way forward. Handling it here, at the single choke point every
// authenticated call already goes through, is what the comment always
// promised.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiError = {
  status: number;
  message: string;
  // Revisi K bug 2 — a machine-readable code (e.g. "FX_RATE_UNAVAILABLE")
  // for callers that need to branch on a SPECIFIC error, not just the HTTP
  // status (several distinct failures can share one status, like 503).
  code?: string;
};

/** Guards against N concurrent 401s (a dashboard fires many queries at once)
 *  each kicking off their own sign-out + navigation. */
let sessionEndedHandled = false;

async function handleSessionExpired(): Promise<void> {
  if (typeof window === "undefined" || sessionEndedHandled) return;
  sessionEndedHandled = true;
  // Imported DYNAMICALLY, and deliberately not from `auth-compat`:
  //  - auth-compat imports THIS module, so a static import would close a cycle;
  //  - `auth-client` pulls in `better-auth/react`, which ships ESM only. A
  //    static import evaluates it whenever anything imports `apiFetch`, which
  //    breaks Jest ("Cannot use import statement outside a module") for every
  //    suite that transitively touches this file. Loading it here keeps it a
  //    browser-runtime-only dependency.
  // Best-effort: the session is already invalid server-side, so a failing
  // sign-out call must not stop the redirect that gets the user unstuck.
  const { authClient } = await import("./auth-client");
  await authClient.signOut().catch(() => undefined);
  // No `?next=` — the login page does not read one, and a parameter that
  // silently does nothing is worse than none. Add it here only alongside a
  // real return-to-destination in `app/login/page.tsx`.
  window.location.href = "/login";
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const { token, ...rest } = options ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    if (res.status === 401) {
      // Fire-and-forget: the throw below still propagates so the caller's own
      // error handling runs, while the redirect proceeds in parallel.
      void handleSessionExpired();
    }
    throw {
      status: res.status,
      message: body.message ?? res.statusText,
      code: body.code,
    } satisfies ApiError;
  }

  // 204 No Content (every DELETE endpoint in this API) has no body — calling
  // res.json() on it throws a SyntaxError, which callers then swallow as a
  // generic "gagal menghapus" error even though the delete already succeeded,
  // and skip the invalidateQueries call that would refresh the UI.
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
