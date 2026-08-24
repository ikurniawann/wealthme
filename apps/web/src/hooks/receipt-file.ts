/**
 * EPIC-027 B9/B10 — the UPLOAD half of the receipt scanner: take a file the
 * user picked, decode it, and hand back exactly the same payload shape the
 * camera path produces (`hooks/receipt-image.ts`), so both sources converge
 * on one request, one review screen and one confirm-before-save flow (D9).
 *
 * Lives outside `components/shell/` for the same reason as its camera
 * siblings: `transaction-dialog.tsx` is a protected foundation file and only
 * mounts/orchestrates.
 *
 * Two things this module deliberately does NOT do:
 *
 *  - It never posts the original bytes. Even a JPEG is re-encoded, because
 *    (a) an 8 MP phone photo blows straight past `ScanReceiptDto`'s 2 MB
 *    base64 cap and (b) all three vision adapters declare the image as
 *    `image/jpeg` — a PNG/WebP screenshot of a receipt must therefore be
 *    converted, not relabelled.
 *  - It never collapses the failure modes into one "file rusak". A HEIC from
 *    an iPhone, a PDF, a 50 MB video and a 3-byte truncated PNG each need a
 *    different action from the user, so each gets its own reason code.
 */

import {
  ReceiptCaptureError,
  encodeWithinCap,
  fitWithinMaxEdge,
  type FrameEncoder,
} from "./receipt-image";
import type { I18nDictionary } from "@/i18n/types";

/**
 * A ceiling on the COMPRESSED file, checked from `File.size` before the file
 * is read at all. What it actually buys: a 50 MB pick is never slurped into
 * memory, never decoded, and never base64'd into a request body.
 *
 * EPIC-027 group 8 security review (MEDIUM) — this comment used to claim it
 * also bounded the decode allocation. It does not, and the two are
 * independent: bytes on disk say nothing about pixel count. A 300 KB PNG can
 * declare 30000 × 30000, which is ~3.6 GB of RGBA once rasterised. The
 * allocation risk is bounded by `RECEIPT_UPLOAD_MAX_PIXELS` below, not by
 * this constant.
 */
export const RECEIPT_UPLOAD_MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * A ceiling on the DECODED image, in pixels — this is the one that bounds
 * memory. At 4 bytes per pixel, 40 MP is ~160 MB of RGBA, which comfortably
 * clears every phone camera in circulation (a 108 MP sensor still shoots
 * 12 MP by default, and a full-resolution 8 MP photo is 12.2 MP) while
 * refusing a decompression-bomb declaration long before the browser tries
 * to satisfy it.
 *
 * Only the uploading user's own tab is ever at risk here — no server
 * resource is involved and `postScanReceipt` is never reached — but a tab
 * the app itself killed is still the app's fault.
 */
export const RECEIPT_UPLOAD_MAX_PIXELS = 40_000_000;

/**
 * `file.type` is empty for a `.heic` on several Android/desktop pickers, so
 * the extension is part of the test rather than a nicety.
 */
const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
  "heic",
  "heif",
] as const;
const HEIC_EXTENSIONS = ["heic", "heif"] as const;
const HEIC_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

export type ReceiptFileFailure =
  /** Zero bytes — a failed share, or a file still syncing from cloud storage. */
  | "empty-file"
  /** Over `RECEIPT_UPLOAD_MAX_FILE_BYTES`; never decoded. */
  | "file-too-large"
  /** A PDF: readable by a human, not by a canvas. Refused with the reason. */
  | "pdf-unsupported"
  /** Not an image at all (a .docx, a video, an .exe). */
  | "not-an-image"
  /** A HEIC/HEIF this browser cannot decode — the iPhone default. */
  | "heic-unsupported"
  /** An image the browser refused to decode: truncated or corrupt. */
  | "decode-failed"
  /** Declares more pixels than `RECEIPT_UPLOAD_MAX_PIXELS` — a decompression bomb. */
  | "image-dimensions-too-large"
  /** No 2D canvas context (a hardened/exotic browser). */
  | "no-canvas"
  /** Encoded smaller than the DTO's `@MinLength(32)` — a 1×1 pixel, not a receipt. */
  | "too-small"
  /** Still over the 2 MB cap at the smallest/lowest-quality step. */
  | "too-large";

export class ReceiptFileError extends Error {
  constructor(readonly reason: ReceiptFileFailure) {
    super(`receipt file rejected: ${reason}`);
    this.name = "ReceiptFileError";
  }
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** True for the iPhone's default photo format, by MIME **or** extension. */
export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  return (
    HEIC_MIME_TYPES.includes(type as (typeof HEIC_MIME_TYPES)[number]) ||
    HEIC_EXTENSIONS.includes(
      extensionOf(file.name) as (typeof HEIC_EXTENSIONS)[number],
    )
  );
}

/**
 * The cheap checks that can be made from the file's own metadata, before a
 * single byte is decoded. Returns the reason to refuse, or `null` to proceed.
 *
 * HEIC is intentionally NOT refused here: Safari can decode it, so blocking
 * it up front would break the one platform where it works. It is allowed
 * through and, if the decode then fails, reported as `heic-unsupported`
 * rather than the generic `decode-failed`.
 */
export function classifyReceiptFile(file: File): ReceiptFileFailure | null {
  if (file.size === 0) return "empty-file";
  if (file.size > RECEIPT_UPLOAD_MAX_FILE_BYTES) return "file-too-large";
  const type = file.type.toLowerCase();
  const extension = extensionOf(file.name);
  if (type === "application/pdf" || extension === "pdf") {
    return "pdf-unsupported";
  }
  const looksLikeImage =
    type.startsWith("image/") ||
    IMAGE_EXTENSIONS.includes(extension as (typeof IMAGE_EXTENSIONS)[number]);
  if (!looksLikeImage) return "not-an-image";
  return null;
}

export type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Releases the bitmap/object URL. Always called, including on failure. */
  release: () => void;
};

/**
 * Decodes a picked file into something drawable. `createImageBitmap` is
 * preferred (it decodes off the main thread and reports failure as a
 * rejection); the `HTMLImageElement` + object-URL path is the fallback for
 * browsers without it.
 *
 * Not unit tested directly — jsdom decodes no images; `encodeReceiptFile`
 * below takes the decoder injected so the pipeline around it is testable.
 */
/**
 * The `createImageBitmap` options for a source of the given intrinsic size:
 * ask the browser to produce a bitmap ALREADY bounded to the max edge the
 * encoder targets, so the full-resolution surface is never materialised.
 *
 * Resizing is requested only when it would actually shrink. Passing
 * `resizeWidth`/`resizeHeight` unconditionally would UPSCALE a small
 * receipt screenshot to 1600px — a bigger, blurrier JPEG carrying no extra
 * detail for the model to read.
 */
export function bitmapResizeOptions(
  width: number,
  height: number,
): ImageBitmapOptions {
  const fitted = fitWithinMaxEdge(width, height);
  if (fitted.width >= width && fitted.height >= height) {
    return { resizeQuality: "low" };
  }
  return {
    resizeWidth: fitted.width,
    resizeHeight: fitted.height,
    resizeQuality: "low",
  };
}

/** Reads the intrinsic size of an image file without drawing it. */
async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image decode failed"));
    el.src = url;
  });
}

/**
 * Decodes a picked file into something drawable, bounded.
 *
 * EPIC-027 group 8 security review (MEDIUM) — the order here is the point.
 * The intrinsic size is read FIRST, from an `<img>` `load`, which reports
 * the header's declared dimensions; the expensive rasterisation happens
 * only when the pixels are actually demanded (a `drawImage`, or an
 * `ImageBitmap`), which is after the budget check below. A 30000 × 30000
 * declaration is therefore refused with its own reason instead of being
 * handed to the browser as a ~3.6 GB request.
 *
 * `createImageBitmap` is then preferred, WITH resize options, so what gets
 * materialised is already at encode size rather than native resolution. The
 * `<img>` we already hold is the fallback where it is unsupported.
 *
 * Not unit tested directly — jsdom decodes no images; `encodeReceiptFileWithinCap`
 * takes the decoder injected so the pipeline around it stays testable, and
 * it re-checks the same budget for any decoder that ignored it.
 */
export async function decodeImageFile(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = await loadImageElement(url);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width * height > RECEIPT_UPLOAD_MAX_PIXELS) {
    URL.revokeObjectURL(url);
    throw new ReceiptFileError("image-dimensions-too-large");
  }

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(
        file,
        bitmapResizeOptions(width, height),
      );
      URL.revokeObjectURL(url);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch {
      // A browser that rejects the resize options (or the format) still has
      // a perfectly good decoded `<img>` sitting here; fall through rather
      // than failing an upload that can succeed.
    }
  }
  return {
    source: image,
    width,
    height,
    release: () => URL.revokeObjectURL(url),
  };
}

/** Draws the decoded image onto a canvas at the requested size/quality. */
function canvasEncoderFor(image: DecodedImage): FrameEncoder {
  return ({ width, height, quality }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ReceiptCaptureError("no-canvas");
    ctx.drawImage(image.source, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  };
}

/** `ReceiptCaptureError` reasons that map one-to-one onto a file failure. */
const CAPTURE_REASON_TO_FILE_FAILURE: Record<string, ReceiptFileFailure> = {
  "empty-frame": "decode-failed",
  "no-canvas": "no-canvas",
  "too-large": "too-large",
  "too-small": "too-small",
};

/**
 * The whole upload pipeline: metadata checks → decode → the SAME
 * `encodeWithinCap` loop the camera uses → raw base64, no `data:` prefix.
 *
 * `decode` is injectable purely for tests (jsdom has neither an image
 * decoder nor a 2D canvas context).
 */
export async function encodeReceiptFileWithinCap(
  file: File,
  options: {
    decode?: (file: File) => Promise<DecodedImage>;
    encoderFor?: (image: DecodedImage) => FrameEncoder;
    maxBase64Length?: number;
  } = {},
): Promise<string> {
  const refusal = classifyReceiptFile(file);
  if (refusal) throw new ReceiptFileError(refusal);

  const decode = options.decode ?? decodeImageFile;
  let decoded: DecodedImage;
  try {
    decoded = await decode(file);
  } catch {
    // A HEIC that this browser cannot decode is by far the most likely
    // cause here (the iPhone default), and "share it as JPEG" is a very
    // different instruction from "the file is corrupt".
    throw new ReceiptFileError(
      isHeicFile(file) ? "heic-unsupported" : "decode-failed",
    );
  }

  try {
    if (!decoded.width || !decoded.height) {
      throw new ReceiptFileError("decode-failed");
    }
    // The same budget as `decodeImageFile`, re-asserted at the pipeline
    // level: a decoder that ignored the resize options (or any future
    // decoder swapped in here) must not get to hand `drawImage` a surface
    // this size.
    if (decoded.width * decoded.height > RECEIPT_UPLOAD_MAX_PIXELS) {
      throw new ReceiptFileError("image-dimensions-too-large");
    }
    const encoderFor = options.encoderFor ?? canvasEncoderFor;
    return encodeWithinCap(
      encoderFor(decoded),
      decoded.width,
      decoded.height,
      options.maxBase64Length,
    );
  } catch (err) {
    if (err instanceof ReceiptFileError) throw err;
    if (err instanceof ReceiptCaptureError) {
      throw new ReceiptFileError(
        CAPTURE_REASON_TO_FILE_FAILURE[err.reason] ?? "decode-failed",
      );
    }
    throw new ReceiptFileError("decode-failed");
  } finally {
    decoded.release();
  }
}

/**
 * One message per reason — the same posture as `scanErrorMessage` in
 * `hooks/receipt-scan.ts` and `CAMERA_ERROR_MESSAGES` in the dialog: a
 * control that fails must say what the user can do about it.
 */
export function receiptFileErrorMessage(
  err: unknown,
  t: I18nDictionary,
): string {
  const dict = t.shell.transactionDialog;
  const reason: ReceiptFileFailure =
    err instanceof ReceiptFileError ? err.reason : "decode-failed";
  switch (reason) {
    case "empty-file":
      return dict.uploadErrorEmpty;
    case "file-too-large":
      return dict.uploadErrorFileTooLarge;
    case "pdf-unsupported":
      return dict.uploadErrorPdf;
    case "not-an-image":
      return dict.uploadErrorNotImage;
    case "heic-unsupported":
      return dict.uploadErrorHeic;
    case "no-canvas":
      return dict.uploadErrorNoCanvas;
    case "too-small":
      return dict.uploadErrorTooSmall;
    case "too-large":
      return dict.uploadErrorTooLarge;
    case "image-dimensions-too-large":
      return dict.uploadErrorDimensions;
    case "decode-failed":
      return dict.uploadErrorDecodeFailed;
    default: {
      // EPIC-027 group 8 review (HIGH) — compile-time exhaustiveness. The
      // `default` branch used to swallow any reason added later, so a 10th
      // `ReceiptFileFailure` would have silently shown the decode-failed
      // message: the build stayed green while the UI told the user the
      // wrong thing to do. `never` makes that a type error instead. The
      // runtime fallback is kept for a value that came from outside the
      // type system (an old cached bundle, a thrown non-Error).
      const _exhaustive: never = reason;
      void _exhaustive;
      return dict.uploadErrorDecodeFailed;
    }
  }
}
