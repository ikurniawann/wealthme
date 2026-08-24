/**
 * EPIC-027 B2 — the error-code → message table and the ISO → date-input
 * conversion, both pure. The rendered behaviour is covered end-to-end in
 * `components/shell/transaction-dialog.test.tsx`; these lock the mapping
 * itself so a renamed code fails loudly instead of silently falling into
 * the generic branch.
 */

import { id as dictionary } from "../i18n/id";
import { isoToDateInputValue, scanErrorMessage } from "./receipt-scan";
import { mapCameraError } from "./use-receipt-camera";

const dict = dictionary.shell.transactionDialog;

describe("scanErrorMessage", () => {
  it.each([
    ["OCR_NOT_CONFIGURED", dict.scanErrorNotConfigured],
    ["AI_KEY_CORRUPTED", dict.scanErrorKeyCorrupted],
    ["OCR_AUTH", dict.scanErrorAuth],
    ["OCR_TIMEOUT", dict.scanErrorTimeout],
    ["OCR_PARSE_FAILED", dict.scanErrorParseFailed],
    ["OCR_UPSTREAM_FAILED", dict.scanErrorUpstream],
    ["PAYLOAD_TOO_LARGE", dict.scanErrorPayloadTooLarge],
  ])("maps %s to its own message", (code, expected) => {
    expect(
      scanErrorMessage({ status: 502, message: "x", code }, dictionary),
    ).toBe(expected);
  });

  /**
   * The API's body-parser limit rejects an oversize scan body with a real
   * 413 + `PAYLOAD_TOO_LARGE` (all-exceptions.filter.ts). It used to arrive
   * as an unmapped 500, so the user was told "scan gagal" and sent back to
   * retry the identical too-big image. Assert the actionable message AND
   * that it is nothing like the generic failure.
   */
  it("tells the user the image is too big rather than that the scan failed", () => {
    const message = scanErrorMessage(
      {
        status: 413,
        message: "Data yang dikirim terlalu besar",
        code: "PAYLOAD_TOO_LARGE",
      },
      dictionary,
    );

    expect(message).toBe(dict.scanErrorPayloadTooLarge);
    expect(message).not.toBe(dict.scanErrorUpstream);
    expect(message).toMatch(/besar/i);
  });

  it("gives every scan code a DISTINCT message — no two collapse into one", () => {
    const codes = [
      "OCR_NOT_CONFIGURED",
      "AI_KEY_CORRUPTED",
      "OCR_AUTH",
      "OCR_TIMEOUT",
      "OCR_PARSE_FAILED",
      "OCR_UPSTREAM_FAILED",
      "PAYLOAD_TOO_LARGE",
    ] as const;
    const messages = codes.map((code) =>
      scanErrorMessage({ status: 502, message: "x", code }, dictionary),
    );
    // The two rate-limit variants share `OCR_RATE_LIMITED` and are covered
    // separately below; every other code must stand on its own.
    expect(new Set(messages).size).toBe(codes.length);
  });

  it("distinguishes a daily quota from a short-term throttle", () => {
    const daily = scanErrorMessage(
      { status: 429, message: "x", code: "OCR_RATE_LIMITED", scope: "daily" },
      dictionary,
    );
    const burst = scanErrorMessage(
      { status: 429, message: "x", code: "OCR_RATE_LIMITED" },
      dictionary,
    );

    expect(daily).toBe(dict.scanErrorRateLimitedDaily);
    expect(daily).not.toMatch(/sebentar lagi/i);
    expect(burst).toBe(dict.scanErrorRateLimited);
  });

  it("uses the provider's retry hint when the server sent one", () => {
    expect(
      scanErrorMessage(
        {
          status: 429,
          message: "x",
          code: "OCR_RATE_LIMITED",
          retryAfterSeconds: 30,
        },
        dictionary,
      ),
    ).toContain("30");
  });

  it("falls back to the server's own message rather than inventing a cause", () => {
    expect(
      scanErrorMessage({ status: 401, message: "Unauthorized" }, dictionary),
    ).toBe("Unauthorized");
  });
});

describe("isoToDateInputValue", () => {
  // Fixed literals, deliberately NOT recomputed with the same accessors the
  // implementation uses — an expectation derived from `getFullYear`/
  // `getMonth`/`getDate` would restate a local-time bug instead of catching
  // it (EPIC-027 group 7 review, MEDIUM).
  it("reads the server's UTC instant as the calendar day the receipt carries", () => {
    expect(isoToDateInputValue("2025-05-18T07:32:15.000Z", "2000-01-01")).toBe(
      "2025-05-18",
    );
  });

  it("keeps the UTC day for an instant just after midnight UTC, whatever the viewer's offset", () => {
    // 00:30 UTC is the previous calendar day for every timezone west of UTC;
    // the date on the receipt is still the 18th.
    expect(isoToDateInputValue("2025-05-18T00:30:00.000Z", "2000-01-01")).toBe(
      "2025-05-18",
    );
  });

  it("keeps the UTC day for an instant just before midnight UTC", () => {
    // 23:45 UTC is already the next calendar day in Jakarta (UTC+7).
    expect(isoToDateInputValue("2025-05-18T23:45:00.000Z", "2000-01-01")).toBe(
      "2025-05-18",
    );
  });

  it("keeps the form's existing date when the scan returned garbage", () => {
    expect(isoToDateInputValue("not-a-date", "2024-02-29")).toBe("2024-02-29");
  });
});

describe("mapCameraError", () => {
  it.each([
    ["NotAllowedError", "permission-denied"],
    ["SecurityError", "permission-denied"],
    ["NotFoundError", "not-found"],
    ["OverconstrainedError", "not-found"],
    ["NotReadableError", "in-use"],
    ["AbortError", "in-use"],
    ["SomethingElse", "unknown"],
  ])("maps a %s DOMException to %s", (name, expected) => {
    expect(mapCameraError(Object.assign(new Error("x"), { name }))).toBe(
      expected,
    );
  });
});
