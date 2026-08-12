import { detectAllowedMime, extensionForMime } from "./file-signature.util";

describe("detectAllowedMime", () => {
  it("detects a JPEG from its magic bytes", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectAllowedMime(buffer)).toBe("image/jpeg");
  });

  it("detects a PNG from its magic bytes", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(detectAllowedMime(buffer)).toBe("image/png");
  });

  it("detects a WEBP from its RIFF/WEBP header", () => {
    const buffer = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP"),
    ]);
    expect(detectAllowedMime(buffer)).toBe("image/webp");
  });

  it("detects a PDF from its %PDF- header", () => {
    const buffer = Buffer.from("%PDF-1.4\n...");
    expect(detectAllowedMime(buffer)).toBe("application/pdf");
  });

  it("returns null for plain text, regardless of claimed Content-Type", () => {
    const buffer = Buffer.from("this is not an image or a pdf");
    expect(detectAllowedMime(buffer)).toBeNull();
  });

  it("returns null for an executable's magic bytes (MZ header)", () => {
    const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(detectAllowedMime(buffer)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(detectAllowedMime(Buffer.alloc(0))).toBeNull();
  });

  it("does not false-positive a JPEG signature as a PNG (RIFF/WEBP disjoint check)", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);
    expect(detectAllowedMime(buffer)).toBe("image/jpeg");
  });
});

describe("extensionForMime", () => {
  it("maps each allowed mime type to a safe, fixed extension", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("application/pdf")).toBe("pdf");
  });
});
