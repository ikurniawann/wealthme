export type MemberField = "name" | "username" | "password" | "email";

/** Per-field error message keys, resolved to copy by the dialog. */
export type MemberFieldErrorKey =
  | "nameRequired"
  | "usernameRequired"
  | "usernameInvalid"
  | "usernameTaken"
  | "passwordRequired"
  | "passwordTooShort"
  | "emailInvalid";

export type MemberFieldErrors = Partial<
  Record<MemberField, MemberFieldErrorKey>
>;

// Mirrors CreateDependantMemberDto (apps/api): name >= 2, username 3-30 of
// [a-zA-Z0-9_.], initialPassword >= 8, optional @IsEmail.
export const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMemberForm(input: {
  name: string;
  username: string;
  password: string;
  email: string;
}): MemberFieldErrors {
  const errors: MemberFieldErrors = {};
  if (!input.name) errors.name = "nameRequired";
  if (!input.username) errors.username = "usernameRequired";
  else if (!USERNAME_PATTERN.test(input.username))
    errors.username = "usernameInvalid";
  if (!input.password) errors.password = "passwordRequired";
  else if (input.password.length < MIN_PASSWORD_LENGTH)
    errors.password = "passwordTooShort";
  if (input.email && !EMAIL_PATTERN.test(input.email))
    errors.email = "emailInvalid";
  return errors;
}

/**
 * Maps an API rejection onto the form field it belongs to, or returns null
 * when it is not field-specific (the caller then falls back to a toast).
 * Handles the USERNAME_TAKEN code and class-validator's "<field> must ..."
 * messages (a string or string[]).
 */
export function mapServerFieldErrors(err: unknown): MemberFieldErrors | null {
  if (!err || typeof err !== "object") return null;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (code === "USERNAME_TAKEN") return { username: "usernameTaken" };
  const lines = Array.isArray(message)
    ? message.map(String)
    : typeof message === "string"
      ? [message]
      : [];
  const errors: MemberFieldErrors = {};
  for (const line of lines) {
    if (line.startsWith("initialPassword"))
      errors.password = "passwordTooShort";
    else if (line.startsWith("username")) errors.username = "usernameInvalid";
    else if (line.startsWith("name")) errors.name = "nameRequired";
    else if (line.startsWith("email")) errors.email = "emailInvalid";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
