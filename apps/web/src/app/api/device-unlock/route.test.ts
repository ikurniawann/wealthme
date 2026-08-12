/**
 * @jest-environment node
 *
 * EPIC-023 D2 (US-FAM-13, D7) — /api/device-unlock route handler. Uses the
 * Node test environment (not jsdom) — this is a Route Handler, and
 * Next.js's own `next/server` module reaches for the platform's global
 * `Request`/`Response`, which jsdom does not provide.
 *
 * Verifies that:
 * 1. It forwards deviceId/deviceSecret/pin to apps/api's unlock endpoint.
 * 2. On success it installs the better-auth session cookie (httpOnly, the
 *    SAME name a normal login sets) using the token apps/api returned.
 * 3. On failure it forwards the error status/body and sets NO cookie.
 * 4. Malformed input (missing fields) is rejected with 400 before any
 *    network call.
 */
const mockCookieSet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      set: mockCookieSet,
    }),
  ),
}));

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/device-unlock", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/device-unlock (EPIC-023 D2, EPIC-024 B2, EPIC-024 hotfix)", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalApiUrl = process.env.API_URL;
  const originalSecret = process.env.BETTER_AUTH_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      configurable: true,
    });
    // EPIC-024 B2 — getServerEnv() (apps/web/src/lib/server-env.ts) now
    // validates API_URL is a real URL before this route forwards to it, instead of
    // silently falling back to http://localhost:4000. Set it explicitly so
    // the existing "happy path" tests below keep exercising the fetch/cookie
    // logic instead of the new misconfiguration branch (covered separately).
    Object.defineProperty(process.env, "API_URL", {
      value: "http://api-test:4000",
      configurable: true,
    });
    // EPIC-024 hotfix — the cookie set on success must now be SIGNED
    // (matching better-auth's own reader); the signer needs BETTER_AUTH_SECRET.
    Object.defineProperty(process.env, "BETTER_AUTH_SECRET", {
      value: "test-secret-for-device-unlock-route-spec",
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalEnv,
      configurable: true,
    });
    Object.defineProperty(process.env, "API_URL", {
      value: originalApiUrl,
      configurable: true,
    });
    Object.defineProperty(process.env, "BETTER_AUTH_SECRET", {
      value: originalSecret,
      configurable: true,
    });
  });

  it("forwards deviceId/deviceSecret/pin to the apps/api unlock endpoint", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "abc123" }),
    });

    const res = await POST(
      makeRequest({
        deviceId: "device-1",
        deviceSecret: "the-secret",
        pin: "482913",
      }),
    );

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/devices/device-1/unlock"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ deviceSecret: "the-secret", pin: "482913" }),
      }),
    );
  });

  it("installs the better-auth session cookie (httpOnly) using a SIGNED value derived from the returned token on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "tok_minted" }),
    });

    await POST(
      makeRequest({
        deviceId: "device-1",
        deviceSecret: "the-secret",
        pin: "482913",
      }),
    );

    expect(mockCookieSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = mockCookieSet.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("better-auth.session_token");
    // HOTFIX regression guard: a plain, unsigned "tok_minted" is exactly the
    // pre-fix bug (better-auth's own reader rejects it and bounces the user
    // back to /login) — assert the cookie value is NOT the raw token, and IS
    // shaped `${token}.${base64Signature}` per better-auth/hono's
    // signed-cookie format.
    expect(value).not.toBe("tok_minted");
    expect(value.startsWith("tok_minted.")).toBe(true);
    const signature = value.slice("tok_minted.".length);
    expect(signature.length).toBeGreaterThan(0);
    // Signature must be valid base64 (hono's makeSignature output, no
    // URL-safe substitution) — the format check above already implies this,
    // but assert it explicitly so a future refactor to raw base64url (which
    // would also start with "tok_minted." for some inputs) still fails loudly.
    expect(() => atob(signature)).not.toThrow();
    expect(options).toEqual(
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("produces a signature that independently verifies against BETTER_AUTH_SECRET via the same HMAC-SHA256 algorithm hono/better-auth uses", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "tok_verify_me" }),
    });

    await POST(
      makeRequest({
        deviceId: "device-1",
        deviceSecret: "the-secret",
        pin: "482913",
      }),
    );

    const [, signedValue] = mockCookieSet.mock.calls[0] as [string, string];
    const dot = signedValue.lastIndexOf(".");
    const value = signedValue.slice(0, dot);
    const signature = signedValue.slice(dot + 1);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-secret-for-device-unlock-route-spec"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureBytes = Uint8Array.from(atob(signature), (c) =>
      c.charCodeAt(0),
    );
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(value),
    );
    expect(isValid).toBe(true);
  });

  it("returns 500 and sets no cookie when BETTER_AUTH_SECRET is not configured", async () => {
    Object.defineProperty(process.env, "BETTER_AUTH_SECRET", {
      value: "",
      configurable: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "tok_minted" }),
    });

    const res = await POST(
      makeRequest({
        deviceId: "device-1",
        deviceSecret: "the-secret",
        pin: "482913",
      }),
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/BETTER_AUTH_SECRET/);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("forwards a failure status/body and sets NO cookie", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: "Unlock failed" }),
    });

    const res = await POST(
      makeRequest({
        deviceId: "device-1",
        deviceSecret: "wrong-secret",
        pin: "000000",
      }),
    );

    expect(res.status).toBe(401);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("forwards a lockout failure's code + remainingMs", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({ code: "DEVICE_LOCKED", remainingMs: 60000 }),
    });

    const res = await POST(
      makeRequest({
        deviceId: "device-1",
        deviceSecret: "the-secret",
        pin: "482913",
      }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string; remainingMs?: number };
    expect(body.code).toBe("DEVICE_LOCKED");
    expect(body.remainingMs).toBe(60000);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("rejects a request missing deviceSecret with 400 before making any network call", async () => {
    const res = await POST(
      makeRequest({ deviceId: "device-1", pin: "482913" }),
    );

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a malformed (non-JSON) body with 400", async () => {
    const req = new Request("http://localhost/api/device-unlock", {
      method: "POST",
      body: "not json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 500 with a clear message and makes no network call when API_URL is not configured (EPIC-024 B2)", async () => {
    Object.defineProperty(process.env, "API_URL", {
      value: "",
      configurable: true,
    });

    const res = await POST(
      makeRequest({
        deviceId: "device-1",
        deviceSecret: "the-secret",
        pin: "482913",
      }),
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/API_URL/);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });
});
