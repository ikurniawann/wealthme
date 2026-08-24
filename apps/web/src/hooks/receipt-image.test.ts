/**
 * EPIC-027 B2 — the downscale/encode loop is the part of the capture path
 * that can be tested without a camera or a canvas: `encodeWithinCap` takes
 * its encoder injected, so an oversized "frame" can be simulated exactly.
 */

import {
  SCAN_MAX_BASE64_LENGTH,
  base64ToJpegFile,
  encodeWithinCap,
  fitWithinMaxEdge,
  ReceiptCaptureError,
  stripDataUrlPrefix,
} from "./receipt-image";

/**
 * Stands in for `canvas.toDataURL`: payload length grows with the pixel
 * count and the quality, exactly like a real JPEG encoder, and always
 * carries the data-URL prefix the API rejects.
 */
function fakeEncoder(bytesPerPixelUnit: number) {
  return ({
    width,
    height,
    quality,
  }: {
    width: number;
    height: number;
    quality: number;
  }) => {
    const length = Math.round(width * height * quality * bytesPerPixelUnit);
    return `data:image/jpeg;base64,${"A".repeat(Math.max(1, length))}`;
  };
}

describe("stripDataUrlPrefix", () => {
  it("removes the data-URL prefix the scan DTO rejects", () => {
    expect(stripDataUrlPrefix("data:image/jpeg;base64,AAAB")).toBe("AAAB");
  });

  it("leaves an already-raw payload untouched", () => {
    expect(stripDataUrlPrefix("AAAB")).toBe("AAAB");
  });
});

describe("fitWithinMaxEdge", () => {
  it("leaves a frame already within the cap untouched", () => {
    expect(fitWithinMaxEdge(1200, 900, 1600)).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it("scales the longest edge down and preserves the aspect ratio", () => {
    expect(fitWithinMaxEdge(4000, 3000, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
  });
});

describe("encodeWithinCap", () => {
  it("returns a payload under the API cap for an oversized phone-camera frame, with no data: prefix", () => {
    // 4032x3024 at a byte rate that puts the first candidate far over 2 MB.
    const payload = encodeWithinCap(fakeEncoder(0.02), 4032, 3024);

    expect(payload.length).toBeLessThanOrEqual(SCAN_MAX_BASE64_LENGTH);
    expect(payload.startsWith("data:")).toBe(false);
    expect(payload).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
  });

  it("keeps the highest-quality candidate that fits rather than always shrinking to the floor", () => {
    const encode = jest.fn(fakeEncoder(0.0001));
    encodeWithinCap(encode, 4032, 3024);

    // First candidate already fits, so exactly one encode is attempted.
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1600, quality: 0.82 }),
    );
  });

  it("throws instead of posting a payload that can never fit", () => {
    expect(() => encodeWithinCap(fakeEncoder(100), 4032, 3024)).toThrow(
      ReceiptCaptureError,
    );
  });

  it("throws on an empty frame (the video has no dimensions yet)", () => {
    expect(() => encodeWithinCap(fakeEncoder(1), 0, 0)).toThrow(
      ReceiptCaptureError,
    );
  });
});

describe("base64ToJpegFile", () => {
  it("decodes the posted payload back into a JPEG File for the attachment flow", () => {
    const file = base64ToJpegFile(btoa("hello receipt"), "struk-1.jpg");

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("struk-1.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBe("hello receipt".length);
  });
});
