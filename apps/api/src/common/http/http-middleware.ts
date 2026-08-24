import helmet from "helmet";

import { configureBodyParsers } from "./body-limits";

import type { NestExpressApplication } from "@nestjs/platform-express";

/**
 * The HTTP middleware stack, in the ONE order it is allowed to be in.
 *
 * Security review (MEDIUM, regression) — these three used to be applied in
 * this order only by accident: Nest registered its body parsers inside
 * `app.init()`, which `listen()` triggers at the very end of bootstrap, so
 * the parser naturally sat behind helmet and cors. Configuring the parser
 * explicitly in `main.ts` put it FIRST and quietly reversed that.
 *
 * That matters because body-parser reports `entity.too.large` and malformed
 * JSON via `next(err)`, and Express error propagation skips every normal
 * middleware still ahead in the stack. With the parser first, every 413 and
 * every 400-from-bad-JSON — on public routes included — answered without
 * helmet's headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
 * Referrer-Policy) and without CORS headers.
 *
 * Kept in a single function, called from `main.ts` and exercised by
 * `body-limits.spec.ts`, so the ordering has exactly one definition and a
 * test that fails if it is ever swapped again.
 *
 * Must run BEFORE `app.listen()`/`app.init()`: Nest registers its own 100 kb
 * parsers during `init()` and skips any parser already applied, so the
 * limits configured here only win if they are in place first.
 */
export function configureHttpMiddleware(
  app: NestExpressApplication,
  options: { webOrigin: string },
): void {
  // Security headers baseline (CSP, HSTS, X-Frame-Options, …).
  app.use(helmet());

  app.enableCors({
    origin: options.webOrigin,
    credentials: true,
  });

  // Last of the three, so a parser error still travels back through helmet
  // and cors on its way out.
  configureBodyParsers(app);
}
