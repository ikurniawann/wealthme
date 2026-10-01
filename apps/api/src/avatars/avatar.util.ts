import { detectAllowedMime } from "../attachments/file-signature.util";

/** Profile pictures are small — 2 MB is plenty for a 256px avatar. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarMime = "image/jpeg" | "image/png" | "image/webp";

export const AVATAR_MIMES: readonly AvatarMime[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const EXTENSION_BY_MIME: Record<AvatarMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Storage keys we own live under this prefix; anything else in
 * `User.image` (e.g. an OAuth provider's https URL) is passed through. */
export const AVATAR_KEY_PREFIX = "avatars/";

export function isAvatarMime(value: string | undefined): value is AvatarMime {
  return AVATAR_MIMES.includes(value as AvatarMime);
}

/** Sniffs the real type from magic bytes; `null` unless it is a JPEG, PNG
 * or WEBP (a PDF passes the attachment check but is not an avatar). */
export function detectAvatarMime(buffer: Buffer): AvatarMime | null {
  const detected = detectAllowedMime(buffer);
  return detected && isAvatarMime(detected) ? detected : null;
}

export function extensionForAvatar(mime: AvatarMime): string {
  return EXTENSION_BY_MIME[mime];
}

export function isAvatarKey(image: string | null | undefined): image is string {
  return !!image && image.startsWith(AVATAR_KEY_PREFIX);
}

/**
 * What the web renders for `User.image`. Our own uploads are stored as a
 * storage key and served by the authenticated `GET /users/:id/avatar`
 * stream (disk storage has no signed public URL); the key's random
 * filename is appended as `?v=` so a new upload busts any cache. External
 * https URLs pass through; anything else is dropped.
 */
export function avatarUrlFor(
  userId: string,
  image: string | null | undefined,
): string | null {
  if (!image) return null;
  if (image.startsWith(AVATAR_KEY_PREFIX)) {
    const version = image.slice(image.lastIndexOf("/") + 1);
    return `/users/${userId}/avatar?v=${encodeURIComponent(version)}`;
  }
  return image.startsWith("https://") ? image : null;
}
