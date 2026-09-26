// Mirrors the local `extractApiErrorMessage` helper already used on
// /rekening, /dana, /tax, /mastercoa, /akun, /masterdata — the server's real
// message must reach the user instead of a generic fallback. Used by the
// pay/delete mutations' `onError`, where the API *does* compose a real
// Indonesian message worth showing verbatim (e.g. the "already paid this
// period" ConflictException in liabilities.service.ts names the liability
// and gives guidance) — see liabilitas.test.tsx's "surfaces the real 409
// 'already paid' server message" regression guard.
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  // Only trust the message when the object also carries the ApiError shape's
  // `status`, otherwise a raw network/abort error would leak verbatim.
  return err && typeof err === "object" && "status" in err && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// Batch 4 item 2 — unlike the conflict message above, the payment-preview
// endpoint's 400s (guardPaymentAmount / splitLiabilityPayment in
// liabilities.service.ts) are plain BadRequestException(string) with an
// untranslated English message and no stable machine-readable `code` to key
// a lookup off. There is nothing safe to surface, so the preview always
// shows the localized fallback and the raw message goes to the console for
// debugging instead of rendering as UI copy.
export function extractPreviewErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (err && typeof err === "object" && "status" in err && "message" in err) {
    console.error(
      `[liabilitas] payment-preview error suppressed from UI: ${String((err as { message: unknown }).message)}`,
    );
  }
  return fallback;
}
