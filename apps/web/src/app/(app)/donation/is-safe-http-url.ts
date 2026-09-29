// Hardening audit (validation, HIGH) — receiptUrl is rendered as `<a href>`
// to every family member. The server now rejects a non-http(s) scheme
// (IsUrl({ protocols: ["http", "https"] })), but this is defense in depth
// on the client for data written before that check existed (a `javascript:`
// URL becoming stored XSS when clicked). Kept in its own module (rather than
// inline in page.tsx) so it can be unit-tested without pulling in
// page.tsx's ESM-only `better-auth/react` import, which Jest can't parse
// standalone.
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
