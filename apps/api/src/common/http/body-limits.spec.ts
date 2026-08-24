import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { memoryStorage } from "multer";
import request from "supertest";

import { AllExceptionsFilter } from "../filters/all-exceptions.filter";

import {
  DEFAULT_JSON_BODY_BYTES,
  MAX_SCAN_JSON_BODY_BYTES,
} from "./body-limits";
import { configureHttpMiddleware } from "./http-middleware";

import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";

/**
 * Regression coverage for the bug where every real receipt scan 500'd:
 * Express' body parser was left at its 100 kb default while
 * `ScanReceiptDto` advertised a 2 MiB base64 payload, so the request died
 * in the parser and never reached the controller or the DTO. Every existing
 * scan test mocked `fetch`, so nothing exercised the transport at all.
 *
 * …and for the security finding on the first fix: the large ceiling must
 * belong to the AUTHENTICATED scan route only. `/calculators/*` is
 * class-level `@Public()` with no per-route throttle, so it must stay on
 * the small default — otherwise an anonymous caller can make the process
 * buffer megabytes of heap per request.
 *
 * These boot a real Nest/Express app with the SAME parser configuration
 * `main.ts` applies (via `configureBodyParsers`) plus the same global
 * filter, on the REAL route paths, and drive it over HTTP — the layer the
 * bug lived in. Nothing here is reasoned about; every claim is a request.
 */

/** Mirrors `MAX_ATTACHMENT_FILE_BYTES` in attachments.controller.ts. */
const MULTIPART_FILE_LIMIT_BYTES = 5 * 1024 * 1024;

/** The real scan path: `@Controller("family-groups/:familyGroupId/transactions")` + `@Post("scan")`. */
const SCAN_PATH = "/family-groups/fg-1/transactions/scan";
/** The real public calculator path: `@Controller("calculators")` + `@Post("zakat")`. */
const PUBLIC_PATH = "/calculators/zakat";
const WEB_ORIGIN = "https://web.example";

@Controller()
class ProbeController {
  @Post("family-groups/:familyGroupId/transactions/scan")
  scan(@Body() body: { imageBase64?: string }): { length: number } {
    return { length: body.imageBase64?.length ?? 0 };
  }

  @Post("calculators/zakat")
  publicRoute(@Body() body: { blob?: string }): { length: number } {
    return { length: body.blob?.length ?? 0 };
  }

  @Post("family-groups/:familyGroupId/transactions/:txId/attachments")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MULTIPART_FILE_LIMIT_BYTES },
    }),
  )
  multipart(@UploadedFile() file: Express.Multer.File | undefined): {
    size: number;
  } {
    return { size: file?.size ?? 0 };
  }
}

describe("request body limits (transport, not DTO)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    // The REAL middleware stack `main.ts` applies, through the same single
    // function — so the ordering assertions below actually guard bootstrap.
    configureHttpMiddleware(nestApp, { webOrigin: WEB_ORIGIN });
    nestApp.useGlobalFilters(new AllExceptionsFilter());
    app = await nestApp.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // The pair of assertions the security round is about: the same running
  // app must accept a big scan and refuse a big public post.
  describe("the large ceiling belongs to the scan route alone", () => {
    it("accepts a realistic ~1.5 MB base64 scan payload and delivers it to the controller", async () => {
      const imageBase64 = "A".repeat(1_500_000);

      const res = await request(app.getHttpServer())
        .post(SCAN_PATH)
        .send({ imageBase64 });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ length: 1_500_000 });
    });

    it("refuses that very same payload on the PUBLIC calculator route with 413", async () => {
      const res = await request(app.getHttpServer())
        .post(PUBLIC_PATH)
        .send({ blob: "A".repeat(1_500_000) });

      expect(res.status).toBe(413);
      expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("refuses a public body just over the small default", async () => {
      const res = await request(app.getHttpServer())
        .post(PUBLIC_PATH)
        .send({ blob: "A".repeat(DEFAULT_JSON_BODY_BYTES + 1024) });

      expect(res.status).toBe(413);
    });

    it("still serves a public body within the small default", async () => {
      const res = await request(app.getHttpServer())
        .post(PUBLIC_PATH)
        .send({ blob: "A".repeat(400_000) });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ length: 400_000 });
    });

    it("gives the trailing-slash variant of the scan route the same ceiling", async () => {
      // Matches SCAN_ROUTE_PATTERN's `/?$` and the nginx `/?$`; the two
      // layers must agree on this variant (security review, LOW).
      const res = await request(app.getHttpServer())
        .post(`${SCAN_PATH}/`)
        .send({ imageBase64: "A".repeat(1_500_000) });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ length: 1_500_000 });
    });

    it("accepts a scan body far above Express' 100 kb default — proving the raise took effect", async () => {
      const res = await request(app.getHttpServer())
        .post(SCAN_PATH)
        .send({ imageBase64: "A".repeat(200_000) });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ length: 200_000 });
    });

    it("refuses a scan body over even the scan ceiling with 413 and a stable code, not a generic 500", async () => {
      const res = await request(app.getHttpServer())
        .post(SCAN_PATH)
        .send({ imageBase64: "A".repeat(MAX_SCAN_JSON_BODY_BYTES + 1024) });

      expect(res.status).toBe(413);
      expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
      expect(res.body.statusCode).toBe(413);
    });

    it("leaks no internals on the oversize path", async () => {
      const res = await request(app.getHttpServer())
        .post(SCAN_PATH)
        .send({ imageBase64: "A".repeat(MAX_SCAN_JSON_BODY_BYTES + 1024) });

      const serialized = JSON.stringify(res.body);
      // No parser internals, no stack, no filesystem paths, and not the
      // raw English "request entity too large" the parser throws.
      expect(serialized).not.toMatch(/entity\.too\.large/i);
      expect(serialized).not.toMatch(/entity too large/i);
      expect(serialized).not.toMatch(/stack/i);
      expect(serialized).not.toMatch(/\/(src|dist|node_modules)\//);
      expect(Object.keys(res.body).sort()).toEqual([
        "code",
        "message",
        "statusCode",
      ]);
    });
  });

  /**
   * Security review (MEDIUM, regression) — configuring the parser in
   * `main.ts` put it AHEAD of helmet and cors, and body-parser reports an
   * oversize or malformed body with `next(err)`, which skips every normal
   * middleware still ahead of it. Every 413 and every 400-from-bad-JSON
   * then answered with no security headers at all. Ordering is not
   * something a comment can keep true, so it is asserted here.
   */
  describe("an error from the body parser still travels back through helmet and cors", () => {
    const helmetHeaders = [
      "content-security-policy",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
    ];

    it("serves helmet's headers on a 413", async () => {
      const res = await request(app.getHttpServer())
        .post(PUBLIC_PATH)
        .set("Origin", WEB_ORIGIN)
        .send({ blob: "A".repeat(DEFAULT_JSON_BODY_BYTES + 1024) });

      expect(res.status).toBe(413);
      for (const header of helmetHeaders) {
        expect(res.headers).toHaveProperty(header);
      }
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("serves the CORS header on a 413", async () => {
      const res = await request(app.getHttpServer())
        .post(PUBLIC_PATH)
        .set("Origin", WEB_ORIGIN)
        .send({ blob: "A".repeat(DEFAULT_JSON_BODY_BYTES + 1024) });

      expect(res.status).toBe(413);
      expect(res.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    });

    it("serves helmet's headers on a 400 from malformed JSON too", async () => {
      const res = await request(app.getHttpServer())
        .post(PUBLIC_PATH)
        .set("Content-Type", "application/json")
        .send("{ not json");

      expect(res.status).toBe(400);
      for (const header of helmetHeaders) {
        expect(res.headers).toHaveProperty(header);
      }
    });

    it("serves them on a successful response as well (the baseline)", async () => {
      const res = await request(app.getHttpServer())
        .post(PUBLIC_PATH)
        .set("Origin", WEB_ORIGIN)
        .send({ blob: "ok" });

      expect(res.status).toBe(201);
      for (const header of helmetHeaders) {
        expect(res.headers).toHaveProperty(header);
      }
    });
  });

  describe("multipart is bounded by multer, not by any JSON limit", () => {
    const multipartPath = "/family-groups/fg-1/transactions/tx-1/attachments";

    it("accepts an upload larger than the entire scan JSON ceiling", async () => {
      const size = MAX_SCAN_JSON_BODY_BYTES + 1_000_000;

      const res = await request(app.getHttpServer())
        .post(multipartPath)
        .attach("file", Buffer.alloc(size, 0x41), "statement.csv");

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ size });
    });

    it("still refuses an upload past its own limits.fileSize", async () => {
      const res = await request(app.getHttpServer())
        .post(multipartPath)
        .attach(
          "file",
          Buffer.alloc(MULTIPART_FILE_LIMIT_BYTES + 1024, 0x41),
          "statement.csv",
        );

      expect(res.status).toBe(413);
    });
  });
});
