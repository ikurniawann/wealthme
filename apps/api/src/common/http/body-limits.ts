import { json } from "express";

import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

/**
 * The largest base64 payload `ScanReceiptDto.imageBase64` accepts (2 MiB of
 * base64 characters — roughly a 1.5 MB JPEG once decoded). Declared here,
 * next to the transport limit that has to honour it, and imported BY the DTO
 * so the two can never drift apart again.
 */
export const MAX_SCAN_IMAGE_BASE64_CHARS = 2_097_152;

/**
 * Room for the JSON envelope around that string: the `{"imageBase64":"…"}`
 * wrapper itself is 18 bytes, and any sibling field a future revision of the
 * DTO adds has to fit too. 16 KiB is generous for that and still negligible
 * next to the payload.
 */
const JSON_ENVELOPE_HEADROOM_BYTES = 16 * 1024;

/**
 * 2,113,536 bytes ≈ 2.02 MiB — the scan route ONLY.
 *
 * Express' body parser defaults to 100 kb, so before this existed every
 * receipt scan died inside the parser with `request entity too large`: the
 * request never reached `ScanReceiptDto`, whose `@MaxLength(2_097_152)`
 * advertised a limit the transport could not deliver.
 *
 * Applied per-route rather than globally (security review, MEDIUM): the scan
 * endpoint is authenticated and ability-gated, but `/auth/register`,
 * `/auth/login`, `/auth/refresh`, `/calculators/*` and the device-unlock
 * routes are `@Public()`. A global 2 MiB ceiling would let an anonymous
 * caller make the process buffer ~2 MB of heap per request, at the global
 * throttle's 100/min, before `class-validator` ever runs.
 */
export const MAX_SCAN_JSON_BODY_BYTES =
  MAX_SCAN_IMAGE_BASE64_CHARS + JSON_ENVELOPE_HEADROOM_BYTES;

/**
 * 524,288 bytes (512 KiB) — every other JSON route.
 *
 * Sized to the largest JSON contract the DTOs actually declare outside the
 * scan: `ChatRequestDto` allows `@ArrayMaxSize(100)` messages of
 * `@MaxLength(4000)` characters = 400,000 characters, plus per-message JSON
 * framing and any escaping. 512 KiB covers that with margin and nothing
 * else; every remaining DTO field is capped at 500 characters or less.
 *
 * It is deliberately ABOVE Express' 100 kb default rather than below it, so
 * this change cannot silently start rejecting a request shape that works in
 * production today.
 *
 * Note what this number actually bounds, because `ChatRequestDto` is
 * authenticated and is NOT the exposed case: several `@Public()` DTOs
 * declare string fields with no `@MaxLength` at all — `RegisterDto`
 * (email/password/name), `LoginDto`, and `UnlockDeviceDto.deviceSecret`
 * (fed to `argon2.verify`, which unlike bcrypt does not truncate its
 * input). For those routes THIS constant is the only ceiling, and raising
 * it raises them 5x over the 100 kb they see in production today. What
 * keeps that acceptable is their throttles (register 3/min, login 5/min,
 * unlock 5/min), not the DTOs. Anyone tuning this number upward must either
 * cap those fields first or accept that cost — do not read the
 * ChatRequestDto figure above as the whole story.
 */
export const DEFAULT_JSON_BODY_BYTES = 512 * 1024;

/**
 * `POST /family-groups/:familyGroupId/transactions/scan` — matched on the
 * path Express actually sees. The API sets no global prefix; nginx strips
 * the public `/api` prefix before proxying (see deploy/nginx/default.conf),
 * so the `/api` segment is deliberately not part of this pattern.
 *
 * The optional trailing slash mirrors Express' default non-strict routing,
 * which serves `/…/scan/` as the same route. The three nginx upload
 * locations allow the same variant, so a trailing-slash request gets the
 * same ceiling at both layers instead of being refused by one of them
 * (security review, LOW).
 */
const SCAN_ROUTE_PATTERN = /^\/family-groups\/[^/]+\/transactions\/scan\/?$/;

function isScanRequest(req: Request): boolean {
  return req.method === "POST" && SCAN_ROUTE_PATTERN.test(req.path);
}

/**
 * Replaces Nest's default 100 kb `json`/`urlencoded` parsers with a small
 * deliberate default, and grants the larger scan ceiling to the scan route
 * alone.
 *
 * Order matters and is load-bearing: the scan parser is registered FIRST, so
 * Express runs it first. A later parser then skips that request because
 * `body-parser` (2.3.0, lib/read.js) opens with
 * `if (onFinished.isFinished(req)) { next(); return }` — the first parser
 * has already drained the stream, so `req.complete && !req.readable` and
 * the request reads as finished. (There is no `req._body` flag in this
 * version; older body-parser used one, this one does not.) So a scan
 * request is parsed exactly once, at the large limit, and the default
 * parser behind it never re-reads it. Every other path fails
 * `isScanRequest`, falls straight through, and is parsed by the default.
 *
 * Must be called BEFORE `app.listen()`/`app.init()`: Nest registers its own
 * parsers during `init()` and skips a parser already applied, so calling
 * this first replaces the defaults instead of stacking behind them.
 *
 * Multipart uploads are untouched — `express.json()` only parses
 * `application/json` and `express.urlencoded()` only
 * `application/x-www-form-urlencoded`, so file uploads still flow to multer
 * and stay bounded by their own `limits.fileSize`
 * (`MAX_ATTACHMENT_FILE_BYTES` = 5 MiB, `MAX_STATEMENT_FILE_BYTES` = 20 MiB).
 */
export function configureBodyParsers(app: NestExpressApplication): void {
  const scanJsonParser = json({ limit: MAX_SCAN_JSON_BODY_BYTES });

  app.use((req: Request, res: Response, next: NextFunction): void => {
    if (!isScanRequest(req)) {
      next();
      return;
    }
    scanJsonParser(req, res, next);
  });

  app.useBodyParser("json", { limit: DEFAULT_JSON_BODY_BYTES });
  app.useBodyParser("urlencoded", {
    limit: DEFAULT_JSON_BODY_BYTES,
    extended: true,
  });
}
