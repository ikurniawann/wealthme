/**
 * @jest-environment node
 *
 * EPIC-024 hotfix — signCookieValue must produce a value shaped exactly like
 * better-auth's (hono's) own signed-cookie format, since it stands in for
 * better-auth's cookie-setting step for the PIN-unlock flow (see
 * apps/web/src/app/api/device-unlock/route.ts). The dedicated cross-check
 * against a manually-computed HMAC-SHA256 signature lives in
 * route.test.ts; this file covers the helper's own contract in isolation.
 */
import { signCookieValue } from "./signed-cookie";

describe("signCookieValue", () => {
  it("returns a value shaped `${value}.${base64Signature}`", async () => {
    const signed = await signCookieValue("token-123", "secret-abc");

    expect(signed.startsWith("token-123.")).toBe(true);
    const signature = signed.slice("token-123.".length);
    expect(signature.length).toBeGreaterThan(0);
    expect(() => atob(signature)).not.toThrow();
  });

  it("is deterministic for the same value + secret", async () => {
    const a = await signCookieValue("same-token", "same-secret");
    const b = await signCookieValue("same-token", "same-secret");
    expect(a).toBe(b);
  });

  it("produces a different signature for a different secret", async () => {
    const a = await signCookieValue("same-token", "secret-one");
    const b = await signCookieValue("same-token", "secret-two");
    expect(a).not.toBe(b);
  });

  it("produces a different signature for a different value", async () => {
    const a = await signCookieValue("token-one", "same-secret");
    const b = await signCookieValue("token-two", "same-secret");
    expect(a).not.toBe(b);
  });

  it("produces a 32-byte (44-char base64, one '=' pad) HMAC-SHA256 signature", async () => {
    const signed = await signCookieValue("x", "y");
    const signature = signed.slice(signed.lastIndexOf(".") + 1);
    // 32 raw bytes -> 44 base64 chars incl one trailing '=' pad — matches
    // hono's own signature-length check in parseSigned (`length === 44 &&
    // endsWith("=")`), confirming this stays interoperable with the reader.
    expect(signature).toHaveLength(44);
    expect(signature.endsWith("=")).toBe(true);
  });
});
