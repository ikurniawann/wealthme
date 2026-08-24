/**
 * EPIC-027 B2/B3 — the client half of `POST /transactions/:familyGroupId/scan`.
 *
 * Why a local `fetch` instead of `apiFetch`: `lib/api-client.ts` is a
 * protected foundation file and its thrown error keeps only
 * `{ status, message }` — it drops `code`, `scope` and `retryAfterSeconds`,
 * which is exactly the information `ocr-http-error.util.ts` exists to send.
 * Collapsing seven distinct failures into one message is the thing this task
 * is required NOT to do, so the request is made here, mirroring the same
 * `{ status, message }` error shape (plus the extra fields) that
 * `uploadAttachment` in transaction-dialog.tsx already establishes as the
 * page-local precedent for "apiFetch cannot express this request".
 */

import type { I18nDictionary } from "@/i18n/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Mirrors `ScanReceiptResponseDto` on the API. */
export type ScanReceiptResult = {
  amount: number;
  description: string;
  /** ISO 8601. */
  occurredAt: string;
  /** The model's raw free-text label — shown, never used as an id. */
  categoryHint: string;
  /** A REAL family Category id matched server-side (D13), or null. */
  categoryId: string | null;
};

/** Mirrors the body built by `toScanHttpException` on the API. */
export type ScanApiError = {
  status: number;
  message: string;
  code?: string;
  scope?: string;
  retryAfterSeconds?: number;
};

export async function postScanReceipt(input: {
  familyGroupId: string;
  imageBase64: string;
  token: string | undefined;
}): Promise<ScanReceiptResult> {
  const res = await fetch(
    `${API_URL}/family-groups/${input.familyGroupId}/transactions/scan`,
    {
      method: "POST",
      body: JSON.stringify({ imageBase64: input.imageBase64 }),
      headers: {
        "Content-Type": "application/json",
        ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
      },
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ScanApiError>;
    throw {
      status: res.status,
      message: body.message ?? res.statusText,
      ...(body.code ? { code: body.code } : {}),
      ...(body.scope ? { scope: body.scope } : {}),
      ...(body.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: body.retryAfterSeconds }
        : {}),
    } satisfies ScanApiError;
  }
  return (await res.json()) as ScanReceiptResult;
}

/**
 * EPIC-027 B2 — one message per `code` from `ocr-http-error.util.ts`. The
 * daily rate-limit case is split out deliberately: telling a user to "try
 * again shortly" about a cap that does not reset for hours is actively
 * wrong, and the AI advisor page (`app/(app)/ai/page.tsx`,
 * `errorMessageForCode`) already learned that lesson — this mirrors it.
 */
export function scanErrorMessage(err: unknown, t: I18nDictionary): string {
  const dict = t.shell.transactionDialog;
  const error = (err ?? {}) as Partial<ScanApiError>;
  switch (error.code) {
    case "OCR_NOT_CONFIGURED":
      return dict.scanErrorNotConfigured;
    case "AI_KEY_CORRUPTED":
      return dict.scanErrorKeyCorrupted;
    case "OCR_AUTH":
      return dict.scanErrorAuth;
    case "OCR_RATE_LIMITED":
      if (error.scope === "daily") return dict.scanErrorRateLimitedDaily;
      if (error.retryAfterSeconds) {
        return dict.scanErrorRateLimitedRetryIn.replace(
          "{seconds}",
          String(error.retryAfterSeconds),
        );
      }
      return dict.scanErrorRateLimited;
    case "OCR_TIMEOUT":
      return dict.scanErrorTimeout;
    case "OCR_PARSE_FAILED":
      return dict.scanErrorParseFailed;
    case "OCR_UPSTREAM_FAILED":
      return dict.scanErrorUpstream;
    // Not from `ocr-http-error.util.ts` — this one comes from the API's
    // global filter when the JSON body exceeds the transport limit
    // (`PAYLOAD_TOO_LARGE_CODE` in all-exceptions.filter.ts). Defensive:
    // `encodeWithinCap` in `receipt-image.ts` already downscales below the
    // 2 MiB cap, so a well-behaved client never sends one. If it happens
    // anyway, "scan gagal" would send the user back to retry the exact
    // same too-big image forever — say what is actually wrong instead.
    case "PAYLOAD_TOO_LARGE":
      return dict.scanErrorPayloadTooLarge;
    default:
      // No recognised code (a 401, a network failure, a proxy error page):
      // show whatever the server said rather than inventing a cause.
      return error.message || dict.scanErrorUpstream;
  }
}

/**
 * The scan returns an ISO instant; the form's `<input type="date">` needs a
 * `yyyy-mm-dd`. An unparseable date falls back to what the form already had
 * instead of writing `Invalid Date` into the field.
 *
 * EPIC-027 group 7 review (MEDIUM) — read with the `getUTC*` accessors, not
 * the local ones. The server sends the receipt's date as a UTC instant, so
 * local-time getters shift a receipt timestamped near midnight UTC onto the
 * PREVIOUS calendar day for every user west of UTC — the form would silently
 * prefill the wrong date on a money record. `lib/laporan-period.ts` already
 * reads server dates through `getUTCFullYear`/`getUTCMonth`/`getUTCDate` for
 * the same reason.
 */
export function isoToDateInputValue(iso: string, fallback: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return fallback;
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${parsed.getUTCFullYear()}-${month}-${day}`;
}
