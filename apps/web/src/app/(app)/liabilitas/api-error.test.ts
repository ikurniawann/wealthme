// Batch 4 item 2 — the Bayar preview modal used to call
// `extractApiErrorMessage`, which returns err.message verbatim for any
// ApiError-shaped error, letting the API's raw English message (e.g.
// "amount must be greater than zero", "Payment amount exceeds the
// remaining balance plus interest due") leak straight into the UI. The
// payment-preview endpoint's 400s have no stable machine-readable `code`
// (plain BadRequestException(string) in liabilities.service.ts), so per the
// batch brief option (b), the new `extractPreviewErrorMessage` always falls
// back to the localized string and logs the raw message for debugging
// instead of rendering it.
//
// `extractApiErrorMessage` itself is UNCHANGED and still used by the pay/
// delete mutations' `onError` — those genuinely need the server's message
// verbatim, since e.g. the "already paid this period" conflict IS composed
// server-side in real Indonesian (liabilities.service.ts:1329). See
// liabilitas.test.tsx's "surfaces the real 409 'already paid'" regression
// guard, which this change must not break.
import {
  extractApiErrorMessage,
  extractPreviewErrorMessage,
} from "./api-error";

describe("extractPreviewErrorMessage", () => {
  const fallback = "Rincian pokok dan bunga gagal dihitung.";

  it("returns the localized fallback for an ApiError-shaped error, never the raw English message", () => {
    const apiError = {
      status: 400,
      message: "amount must be greater than zero",
    };

    expect(extractPreviewErrorMessage(apiError, fallback)).toBe(fallback);
  });

  it("returns the localized fallback for an ApiError with a code too", () => {
    const apiError = {
      status: 400,
      message: "amount must be greater than zero",
      code: "50001",
    };

    expect(extractPreviewErrorMessage(apiError, fallback)).toBe(fallback);
  });

  it("returns the localized fallback for a non-ApiError error (e.g. a network/abort error)", () => {
    expect(
      extractPreviewErrorMessage(new Error("Failed to fetch"), fallback),
    ).toBe(fallback);
  });

  it("returns the localized fallback for a nullish/unknown error value", () => {
    expect(extractPreviewErrorMessage(null, fallback)).toBe(fallback);
    expect(extractPreviewErrorMessage(undefined, fallback)).toBe(fallback);
  });

  it("logs the raw ApiError message to the console for debugging instead of rendering it", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const apiError = {
      status: 400,
      message: "amount must be greater than zero",
    };

    extractPreviewErrorMessage(apiError, fallback);

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("amount must be greater than zero"),
    );
    consoleError.mockRestore();
  });
});

describe("extractApiErrorMessage (unchanged — regression guard)", () => {
  const fallback = "Gagal mencatat pembayaran. Silakan coba lagi.";

  it("still surfaces the server's real message for a genuine ApiError (e.g. a named conflict)", () => {
    const apiError = {
      status: 409,
      message: "Liabilitas ini sudah dibayar untuk periode ini",
    };

    expect(extractApiErrorMessage(apiError, fallback)).toBe(
      "Liabilitas ini sudah dibayar untuk periode ini",
    );
  });

  it("falls back for a non-ApiError error", () => {
    expect(extractApiErrorMessage(new Error("boom"), fallback)).toBe(fallback);
  });
});
