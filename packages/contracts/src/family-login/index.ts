/**
 * EPIC-031 — family-scoped login IDs.
 *
 * A member the Master creates signs in as `<username>@<familyHandle>`
 * (e.g. `budi@arsandi`). The username only has to be unique inside one
 * family; the family handle ("kode keluarga") is unique app-wide. The full
 * login ID is what is stored in `User.username`, so better-auth's own
 * `/sign-in/username` finds it without any custom lookup.
 *
 * The handle never contains a dot, so a login ID can never be mistaken for
 * an email address (every real email domain has one).
 */

/** Username part: 3–30 of a–z 0–9 _ . (better-auth's own username charset). */
export const MEMBER_USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

/** Family handle: 3–24 of a–z 0–9 -, starting/ending alphanumeric, no dot. */
export const FAMILY_HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$/;

/**
 * Everything `User.username` may hold: a legacy plain username (created
 * before EPIC-031, still valid) or a family login ID.
 */
export const LOGIN_USERNAME_PATTERN = /^[a-z0-9_.]{3,30}(?:@[a-z0-9-]{3,24})?$/;

export const MAX_LOGIN_USERNAME_LENGTH = 30 + 1 + 24;

export function buildFamilyLoginId(username: string, handle: string): string {
  return `${username.trim().toLowerCase()}@${handle.trim().toLowerCase()}`;
}

/** `budi@arsandi` → true; `budi@gmail.com` / `budi` → false. */
export function isFamilyLoginId(input: string): boolean {
  const value = input.trim().toLowerCase();
  return value.includes("@") && LOGIN_USERNAME_PATTERN.test(value);
}

/** Suggested handle from a family / person name: "Irfan Arsandi's Family" → "irfan". */
export function slugifyHandleBase(name: string): string {
  const word = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)[0];
  const base = (word ?? "").replace(/[^a-z0-9]/g, "").slice(0, 16);
  return base.length >= 3 ? base : "keluarga";
}
