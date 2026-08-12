/**
 * Signs a cookie value the same way better-auth (via hono's cookie utils)
 * does, so a cookie set outside better-auth's own sign-in flow still passes
 * its signature verification.
 *
 * EPIC-024 hotfix. `apps/web/src/app/api/device-unlock/route.ts` installs
 * better-auth's session cookie manually (no other code path in this app can
 * set an httpOnly cookie for a session minted server-side by `apps/api`).
 * The original implementation (EPIC-023 D2) set the RAW unlock token as the
 * cookie value; better-auth's own cookie reader
 * (`authClient.useSession()` → `GET /api/auth/get-session`) requires a
 * SIGNED value and silently rejects an unsigned one, so the unlock appeared
 * to succeed (a `200` on `/beranda`) but bounced back to `/login` within
 * about a second once the client re-validated the session.
 *
 * Algorithm verified against the installed `hono@4.13.0` package
 * (`node_modules/hono/dist/utils/cookie.js`, `makeSignature`/
 * `serializeSigned` — better-auth's `setSignedCookie` delegates directly to
 * these): HMAC-SHA256 over the raw value, plain (non-URL-safe) base64
 * encoding of the signature, joined as `${value}.${signature}`. Uses the
 * standard WebCrypto `crypto.subtle` API (available in both the Node.js and
 * Edge runtimes) rather than importing hono's internal, non-exported
 * `./utils/cookie` subpath (not present in hono's package.json `exports`
 * map, so importing it directly is not guaranteed to resolve).
 *
 * Deliberately NOT url-encoding the returned value here: `next/headers`'s
 * `cookies().set()` serializes the cookie via the standard `cookie` npm
 * package, which applies `encodeURIComponent` to the value by default — the
 * same step hono's `serializeSigned` performs explicitly. Better-auth's
 * cookie parser (`hono`'s `parse()`) calls `decodeURIComponent` on read, so
 * the two sides match without this module doing its own encoding.
 */

const SIGNING_ALGORITHM: HmacImportParams = { name: "HMAC", hash: "SHA-256" };

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    SIGNING_ALGORITHM,
    false,
    ["sign"],
  );
}

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/**
 * Returns `${value}.${signature}`, where `signature` is the base64-encoded
 * HMAC-SHA256 of `value` under `secret` — the exact shape better-auth's own
 * signed-cookie reader expects.
 */
export async function signCookieValue(
  value: string,
  secret: string,
): Promise<string> {
  const key = await importSigningKey(secret);
  const signatureBytes = await crypto.subtle.sign(
    SIGNING_ALGORITHM.name,
    key,
    new TextEncoder().encode(value),
  );
  return `${value}.${toBase64(signatureBytes)}`;
}
