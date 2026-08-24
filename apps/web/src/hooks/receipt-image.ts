/**
 * EPIC-027 B2 — capture a video frame, shrink it until the base64 payload
 * fits the scan endpoint's cap, and hand it back WITHOUT the data-URL
 * prefix.
 *
 * Lives outside `components/shell/` on purpose: `transaction-dialog.tsx` is
 * a protected foundation file, so the substantial logic it orchestrates
 * belongs in its own module (same shape as `hooks/gold-price-math.ts`,
 * which is a plain helper module sitting next to `use-gold-price.ts`).
 *
 * The size cap is not advisory: `ScanReceiptDto` on the API rejects a
 * payload over 2 MB, shorter than 32 chars, or carrying the
 * `data:image/jpeg;base64,` prefix (`@MaxLength` / `@MinLength` /
 * `@Matches`). A modern phone frame blows past 2 MB easily, so the encoder
 * steps quality down and then dimensions down until it fits — never posts
 * once and hopes.
 */

/** Mirrors `MAX_BASE64_LENGTH` in apps/api/src/transactions/dto/scan-receipt.dto.ts. */
export const SCAN_MAX_BASE64_LENGTH = 2_097_152;
/** Mirrors `MIN_BASE64_LENGTH` in the same DTO. */
export const SCAN_MIN_BASE64_LENGTH = 32;
/** Plenty for OCR legibility; a 4000px-wide frame reads no better. */
export const SCAN_MAX_EDGE_PX = 1600;

const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4] as const;
const SCALE_STEPS = [1, 0.75, 0.5, 0.35] as const;

export type ReceiptCaptureFailure =
  | "empty-frame"
  | "no-canvas"
  | "too-large"
  | "too-small";

export class ReceiptCaptureError extends Error {
  constructor(readonly reason: ReceiptCaptureFailure) {
    super(`receipt capture failed: ${reason}`);
    this.name = "ReceiptCaptureError";
  }
}

/**
 * `canvas.toDataURL()` returns `data:image/jpeg;base64,<payload>`. The API
 * rejects the prefix by design, so it is stripped here rather than trusted
 * to be absent.
 */
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

/** Scales `width`/`height` down so the longest edge is at most `maxEdge`. */
export function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge: number = SCAN_MAX_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Renders one candidate encoding; returns a data URL. */
export type FrameEncoder = (options: {
  width: number;
  height: number;
  quality: number;
}) => string;

/**
 * Walks quality first, then dimensions, and returns the first raw base64
 * payload that fits the cap. Throws `ReceiptCaptureError("too-large")` when
 * even the smallest/lowest-quality candidate is still over — better an
 * honest failure than a request the API will 400.
 */
export function encodeWithinCap(
  encode: FrameEncoder,
  sourceWidth: number,
  sourceHeight: number,
  maxBase64Length: number = SCAN_MAX_BASE64_LENGTH,
): string {
  if (!sourceWidth || !sourceHeight) {
    throw new ReceiptCaptureError("empty-frame");
  }
  const base = fitWithinMaxEdge(sourceWidth, sourceHeight);
  for (const scale of SCALE_STEPS) {
    const width = Math.max(1, Math.round(base.width * scale));
    const height = Math.max(1, Math.round(base.height * scale));
    for (const quality of QUALITY_STEPS) {
      const payload = stripDataUrlPrefix(encode({ width, height, quality }));
      if (payload.length <= maxBase64Length) {
        if (payload.length < SCAN_MIN_BASE64_LENGTH) {
          throw new ReceiptCaptureError("too-small");
        }
        return payload;
      }
    }
  }
  throw new ReceiptCaptureError("too-large");
}

/**
 * Draws the live `<video>` frame onto a canvas and encodes it. Not unit
 * tested — jsdom implements no 2D canvas context; `encodeWithinCap` above
 * holds the logic that is worth testing and takes the encoder injected.
 */
export function captureVideoFrameBase64(video: HTMLVideoElement): string {
  return encodeWithinCap(
    ({ width, height, quality }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ReceiptCaptureError("no-canvas");
      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", quality);
    },
    video.videoWidth,
    video.videoHeight,
  );
}

/**
 * EPIC-027 B4 (D10) — the same captured bytes are auto-attached to the
 * transaction the user confirms, through the dialog's EXISTING post-create
 * attachment flow (`attachmentFile` state → `uploadAttachment`). That flow
 * takes a `File`, so the base64 already posted for OCR is decoded back
 * rather than captured a second time.
 */
export function base64ToJpegFile(base64: string, fileName: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: "image/jpeg" });
}
