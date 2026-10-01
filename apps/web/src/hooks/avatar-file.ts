// Pure avatar upload rules (no session/query imports — safe in any test).
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** Client-side pre-check; the API re-validates mime and magic bytes. */
export function avatarFileError(file: File): "type" | "size" | null {
  if (!AVATAR_ACCEPT.includes(file.type)) return "type";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}
