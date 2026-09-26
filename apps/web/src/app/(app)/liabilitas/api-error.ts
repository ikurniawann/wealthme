// Mirrors the local `extractApiErrorMessage` helper already used on
// /rekening, /dana, /tax, /mastercoa, /akun, /masterdata — the server's real
// message must reach the user instead of a generic fallback.
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  // Only trust the message when the object also carries the ApiError shape's
  // `status`, otherwise a raw network/abort error would leak verbatim.
  return err && typeof err === "object" && "status" in err && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}
