/**
 * Members a Master creates by username (staff, children) get a synthetic
 * placeholder mailbox from the API (`member-<uuid>@members.internal.
 * wealthme.invalid`). It is an implementation detail — never show it.
 */
export const INTERNAL_EMAIL_SUFFIX = "@members.internal.wealthme.invalid";

export function isInternalEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(INTERNAL_EMAIL_SUFFIX);
}

/** The email to show, or `null` when there is no real one to show. */
export function displayEmail(email: string | null | undefined): string | null {
  return email && !isInternalEmail(email) ? email : null;
}
