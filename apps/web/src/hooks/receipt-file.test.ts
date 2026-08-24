/**
 * EPIC-027 B9 — the upload pipeline, tested where it can be tested: jsdom
 * decodes no images and has no 2D canvas context, so `encodeReceiptFileWithinCap`
 * takes both the decoder and the encoder injected (same posture as
 * `encodeWithinCap` in receipt-image.test.ts).
 *
 * What matters here is that each refusal keeps its OWN reason: the user of a
 * HEIC from an iPhone, a PDF, a 40 MB video and a truncated PNG each need a
 * different instruction, and collapsing them into "file rusak" is precisely
 * the failure this group exists to avoid.
 */

import { id as dictionary } from "../i18n/id";
import {
  RECEIPT_UPLOAD_MAX_FILE_BYTES,
  RECEIPT_UPLOAD_MAX_PIXELS,
  bitmapResizeOptions,
  ReceiptFileError,
  classifyReceiptFile,
  encodeReceiptFileWithinCap,
  isHeicFile,
  receiptFileErrorMessage,
  type DecodedImage,
} from "./receipt-file";
import { ReceiptCaptureError, SCAN_MAX_BASE64_LENGTH } from "./receipt-image";

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const file = new File(["receipt"], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

function fakeDecoded(
  width: number,
  height: number,
  release = jest.fn(),
): DecodedImage {
  return {
    source: {} as CanvasImageSource,
    width,
    height,
    release,
  };
}

/** Grows with pixel count and quality, exactly like a real JPEG encoder. */
function fakeEncoderFor(bytesPerPixelUnit: number) {
  return () =>
    ({
      width,
      height,
      quality,
    }: {
      width: number;
      height: number;
      quality: number;
    }) =>
      `data:image/jpeg;base64,${"A".repeat(
        Math.max(1, Math.round(width * height * quality * bytesPerPixelUnit)),
      )}`;
}

describe("isHeicFile", () => {
  it.each([
    ["IMG_0042.HEIC", ""],
    ["IMG_0042.heic", ""],
    ["struk.heif", ""],
    ["struk", "image/heic"],
    ["struk", "image/heif"],
  ])("recognises %s (%s) as HEIC", (name, type) => {
    expect(isHeicFile(makeFile(name, type))).toBe(true);
  });

  it("does not mistake a JPEG for HEIC", () => {
    expect(isHeicFile(makeFile("struk.jpg", "image/jpeg"))).toBe(false);
  });
});

describe("classifyReceiptFile", () => {
  it("accepts an ordinary receipt photo", () => {
    expect(classifyReceiptFile(makeFile("struk.jpg", "image/jpeg"))).toBeNull();
  });

  it("accepts a PNG screenshot of a receipt", () => {
    expect(classifyReceiptFile(makeFile("shot.png", "image/png"))).toBeNull();
  });

  it("accepts a HEIC through to the decoder — Safari can read it", () => {
    expect(classifyReceiptFile(makeFile("IMG_1.heic", ""))).toBeNull();
  });

  it("refuses a zero-byte file", () => {
    expect(classifyReceiptFile(makeFile("struk.jpg", "image/jpeg", 0))).toBe(
      "empty-file",
    );
  });

  it("refuses a file over the pre-decode ceiling, so a 50 MB pick never locks the tab", () => {
    const huge = makeFile("video.jpg", "image/jpeg", 50 * 1024 * 1024);
    expect(RECEIPT_UPLOAD_MAX_FILE_BYTES).toBeLessThan(50 * 1024 * 1024);
    expect(classifyReceiptFile(huge)).toBe("file-too-large");
  });

  it("refuses a PDF explicitly instead of silently accepting it", () => {
    expect(classifyReceiptFile(makeFile("struk.pdf", "application/pdf"))).toBe(
      "pdf-unsupported",
    );
    expect(classifyReceiptFile(makeFile("struk.pdf", ""))).toBe(
      "pdf-unsupported",
    );
  });

  it("refuses a non-image", () => {
    expect(
      classifyReceiptFile(makeFile("laporan.docx", "application/msword")),
    ).toBe("not-an-image");
  });
});

describe("encodeReceiptFileWithinCap", () => {
  it("re-encodes a PNG to a raw JPEG base64 payload with no data-URL prefix", async () => {
    const payload = await encodeReceiptFileWithinCap(
      makeFile("shot.png", "image/png"),
      {
        decode: async () => fakeDecoded(1000, 800),
        encoderFor: fakeEncoderFor(0.05),
      },
    );
    expect(payload.startsWith("data:")).toBe(false);
    expect(payload.length).toBeLessThanOrEqual(SCAN_MAX_BASE64_LENGTH);
    expect(payload.length).toBeGreaterThanOrEqual(32);
  });

  it("shrinks an 8 MP phone photo until it fits the 2 MB cap instead of rejecting it", async () => {
    const payload = await encodeReceiptFileWithinCap(
      makeFile("IMG_2201.jpg", "image/jpeg"),
      {
        decode: async () => fakeDecoded(4032, 3024),
        encoderFor: fakeEncoderFor(1.2),
      },
    );
    expect(payload.length).toBeLessThanOrEqual(SCAN_MAX_BASE64_LENGTH);
  });

  it("reports a HEIC the browser cannot decode as HEIC, not as a corrupt file", async () => {
    await expect(
      encodeReceiptFileWithinCap(makeFile("IMG_0042.HEIC", ""), {
        decode: async () => {
          throw new Error("The source image could not be decoded");
        },
      }),
    ).rejects.toMatchObject({ reason: "heic-unsupported" });
  });

  it("reports a corrupt JPEG as a decode failure, not as HEIC", async () => {
    await expect(
      encodeReceiptFileWithinCap(makeFile("rusak.jpg", "image/jpeg"), {
        decode: async () => {
          throw new Error("decode failed");
        },
      }),
    ).rejects.toMatchObject({ reason: "decode-failed" });
  });

  it("rejects a decode that yields no pixels", async () => {
    await expect(
      encodeReceiptFileWithinCap(makeFile("kosong.png", "image/png"), {
        decode: async () => fakeDecoded(0, 0),
      }),
    ).rejects.toMatchObject({ reason: "decode-failed" });
  });

  it("rejects an image too small to satisfy the DTO's 32-char minimum", async () => {
    await expect(
      encodeReceiptFileWithinCap(makeFile("titik.png", "image/png"), {
        decode: async () => fakeDecoded(1, 1),
        encoderFor: () => () => "data:image/jpeg;base64,AAAA",
      }),
    ).rejects.toMatchObject({ reason: "too-small" });
  });

  it("rejects an image that cannot be shrunk under the cap", async () => {
    await expect(
      encodeReceiptFileWithinCap(makeFile("besar.png", "image/png"), {
        decode: async () => fakeDecoded(1600, 1200),
        encoderFor: fakeEncoderFor(1),
        // A deliberately tiny cap: no candidate can fit, which is the
        // condition under test. Building a real 2 MB-plus string 20 times
        // would only make the test slow.
        maxBase64Length: 16,
      }),
    ).rejects.toMatchObject({ reason: "too-large" });
  });

  it("never decodes a file the metadata checks already refused", async () => {
    const decode = jest.fn();
    await expect(
      encodeReceiptFileWithinCap(makeFile("struk.pdf", "application/pdf"), {
        decode,
      }),
    ).rejects.toBeInstanceOf(ReceiptFileError);
    expect(decode).not.toHaveBeenCalled();
  });

  /**
   * EPIC-027 group 8 review (MEDIUM) — the `finally { decoded.release() }`
   * contract. An `ImageBitmap` that is never `close()`d (or an object URL
   * never revoked) holds its full decoded surface — width x height x 4 bytes,
   * ~48 MB for one 8 MP photo — for the lifetime of the document. That
   * accumulates PER UPLOAD, so a user retrying a few receipts on a phone
   * would push the tab towards an out-of-memory kill. Exactly once, on every
   * exit path.
   */
  describe("releases the decoded image exactly once", () => {
    it("on the happy path", async () => {
      const release = jest.fn();
      await encodeReceiptFileWithinCap(makeFile("a.png", "image/png"), {
        decode: async () => fakeDecoded(800, 600, release),
        encoderFor: fakeEncoderFor(0.05),
      });
      expect(release).toHaveBeenCalledTimes(1);
    });

    it("when the encoder itself throws (no 2D canvas context)", async () => {
      const release = jest.fn();
      await expect(
        encodeReceiptFileWithinCap(makeFile("b.png", "image/png"), {
          decode: async () => fakeDecoded(800, 600, release),
          encoderFor: () => () => {
            throw new ReceiptCaptureError("no-canvas");
          },
        }),
      ).rejects.toMatchObject({ reason: "no-canvas" });
      expect(release).toHaveBeenCalledTimes(1);
    });

    it("when the image cannot be shrunk under the cap", async () => {
      const release = jest.fn();
      await expect(
        encodeReceiptFileWithinCap(makeFile("c.png", "image/png"), {
          decode: async () => fakeDecoded(1600, 1200, release),
          encoderFor: fakeEncoderFor(1),
          maxBase64Length: 16,
        }),
      ).rejects.toBeInstanceOf(ReceiptFileError);
      expect(release).toHaveBeenCalledTimes(1);
    });

    it("when the encoded payload is under the DTO minimum", async () => {
      const release = jest.fn();
      await expect(
        encodeReceiptFileWithinCap(makeFile("d.png", "image/png"), {
          decode: async () => fakeDecoded(1, 1, release),
          encoderFor: () => () => "data:image/jpeg;base64,AAAA",
        }),
      ).rejects.toMatchObject({ reason: "too-small" });
      expect(release).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * EPIC-027 group 8 security review (MEDIUM) — the decompression-bomb guard.
 * `RECEIPT_UPLOAD_MAX_FILE_BYTES` bounds the COMPRESSED file and says
 * nothing about pixel count: a few-hundred-KB PNG can declare 30000 x 30000
 * and ask the browser for ~3.6 GB of RGBA. Only the uploading user's own tab
 * is at risk (no server resource, no request ever sent), but that is still
 * the app killing the app.
 */
describe("decompression-bomb guard", () => {
  it("rejects an image declaring more pixels than the budget, and never encodes or returns a payload", async () => {
    const encoderFor = jest.fn();
    await expect(
      encodeReceiptFileWithinCap(makeFile("bom.png", "image/png", 300 * 1024), {
        // A small FILE — it passes the byte ceiling — declaring a huge image.
        decode: async () => fakeDecoded(30_000, 30_000),
        encoderFor,
      }),
    ).rejects.toMatchObject({ reason: "image-dimensions-too-large" });
    // The encoder is where `drawImage` would have demanded the pixels.
    expect(encoderFor).not.toHaveBeenCalled();
  });

  it("releases the decoded image even when the budget rejects it", async () => {
    const release = jest.fn();
    await expect(
      encodeReceiptFileWithinCap(makeFile("bom.png", "image/png"), {
        decode: async () => fakeDecoded(30_000, 30_000, release),
      }),
    ).rejects.toBeInstanceOf(ReceiptFileError);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("still accepts a full-resolution 8 MP phone photo", async () => {
    expect(4032 * 3024).toBeLessThan(RECEIPT_UPLOAD_MAX_PIXELS);
    const payload = await encodeReceiptFileWithinCap(
      makeFile("IMG_2201.jpg", "image/jpeg", 4 * 1024 * 1024),
      {
        decode: async () => fakeDecoded(4032, 3024),
        encoderFor: fakeEncoderFor(0.05),
      },
    );
    expect(payload.length).toBeGreaterThanOrEqual(32);
  });

  it("accepts an image sitting just under the budget and rejects one just over", async () => {
    const under = Math.floor(Math.sqrt(RECEIPT_UPLOAD_MAX_PIXELS)) - 1;
    await expect(
      encodeReceiptFileWithinCap(makeFile("a.png", "image/png"), {
        decode: async () => fakeDecoded(under, under),
        encoderFor: fakeEncoderFor(0.05),
      }),
    ).resolves.toEqual(expect.any(String));

    const over = Math.ceil(Math.sqrt(RECEIPT_UPLOAD_MAX_PIXELS)) + 1;
    await expect(
      encodeReceiptFileWithinCap(makeFile("b.png", "image/png"), {
        decode: async () => fakeDecoded(over, over),
        encoderFor: fakeEncoderFor(0.05),
      }),
    ).rejects.toMatchObject({ reason: "image-dimensions-too-large" });
  });
});

/**
 * The other half of the fix: what the real decoder ASKS the browser for.
 * `createImageBitmap` is given resize options so the full-resolution surface
 * is never materialised in the first place — the budget check above is the
 * backstop, not the only line.
 */
describe("bitmapResizeOptions", () => {
  it("bounds a large photo to the same max edge the encoder targets", () => {
    expect(bitmapResizeOptions(4032, 3024)).toEqual({
      resizeWidth: 1600,
      resizeHeight: 1200,
      resizeQuality: "low",
    });
  });

  it("bounds a pathologically tall image on its LONGEST edge", () => {
    const options = bitmapResizeOptions(1000, 100_000);
    expect(options.resizeHeight).toBe(1600);
    expect(options.resizeWidth).toBe(16);
  });

  it("never upscales a small receipt screenshot", () => {
    // Asking for 1600px here would produce a bigger, blurrier JPEG carrying
    // no extra detail for the model.
    expect(bitmapResizeOptions(800, 600)).toEqual({ resizeQuality: "low" });
  });
});

describe("receiptFileErrorMessage", () => {
  const dict = dictionary.shell.transactionDialog;

  it.each([
    ["empty-file", dict.uploadErrorEmpty],
    ["file-too-large", dict.uploadErrorFileTooLarge],
    ["pdf-unsupported", dict.uploadErrorPdf],
    ["not-an-image", dict.uploadErrorNotImage],
    ["heic-unsupported", dict.uploadErrorHeic],
    ["image-dimensions-too-large", dict.uploadErrorDimensions],
    ["no-canvas", dict.uploadErrorNoCanvas],
    ["too-small", dict.uploadErrorTooSmall],
    ["too-large", dict.uploadErrorTooLarge],
    ["decode-failed", dict.uploadErrorDecodeFailed],
  ] as const)("maps %s to its own message", (reason, expected) => {
    expect(
      receiptFileErrorMessage(new ReceiptFileError(reason), dictionary),
    ).toBe(expected);
  });

  it("gives every reason a DISTINCT message — no two collapse into one", () => {
    const reasons = [
      "empty-file",
      "file-too-large",
      "pdf-unsupported",
      "not-an-image",
      "heic-unsupported",
      "image-dimensions-too-large",
      "no-canvas",
      "too-small",
      "too-large",
      "decode-failed",
    ] as const;
    const messages = reasons.map((reason) =>
      receiptFileErrorMessage(new ReceiptFileError(reason), dictionary),
    );
    expect(new Set(messages).size).toBe(reasons.length);
  });

  it("falls back to the decode message for an unknown throwable", () => {
    expect(receiptFileErrorMessage(new Error("boom"), dictionary)).toBe(
      dict.uploadErrorDecodeFailed,
    );
  });
});
