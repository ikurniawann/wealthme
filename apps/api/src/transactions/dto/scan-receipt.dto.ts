import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

import { MAX_SCAN_IMAGE_BASE64_CHARS } from "../../common/http/body-limits";

// A receipt photo is never a handful of bytes; this only rejects the
// obviously-empty/placeholder payload, well below any real JPEG.
const MIN_BASE64_LENGTH = 32;
// Single source of truth, shared with the Express body-parser limit that has
// to be big enough to actually deliver a payload this size — they used to be
// declared independently and the transport one (100 kb, Express' default) was
// 20x smaller, so this bound was never reachable.
const MAX_BASE64_LENGTH = MAX_SCAN_IMAGE_BASE64_CHARS;

/**
 * EPIC-027 group 6 review (MEDIUM) — an empty or non-base64 string used to
 * pass validation and be forwarded to a PAID vision call, coming back as a
 * generic 502. Validated at the boundary instead, so garbage fails fast as a
 * 400 and never costs an upstream request.
 *
 * The client posts the RAW base64 payload with the `data:image/jpeg;base64,`
 * prefix already stripped, so the prefix (and any whitespace or newline
 * wrapping) is deliberately not accepted here. URL-safe alphabet characters
 * are allowed alongside the standard one, and padding is optional, so no
 * legitimate encoder output is rejected.
 */
const BASE64_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;

export class ScanReceiptDto {
  @ApiProperty({
    type: String,
    description:
      "Base64-encoded JPEG, WITHOUT the `data:image/jpeg;base64,` prefix and without line breaks",
  })
  @IsString()
  @MinLength(MIN_BASE64_LENGTH, {
    message: "imageBase64 is too short to be a receipt image",
  })
  @MaxLength(MAX_BASE64_LENGTH)
  @Matches(BASE64_PATTERN, {
    message:
      "imageBase64 must be raw base64 without the data-URL prefix or line breaks",
  })
  imageBase64!: string;
}
