import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { configureHttpMiddleware } from "./common/http/http-middleware";

import type { Env } from "./config/env";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService<Env, true>);
  const port = configService.get("PORT", { infer: true });
  const webOrigin = configService.get("WEB_ORIGIN", { infer: true });
  const nodeEnv = configService.get("NODE_ENV", { infer: true });

  // helmet → cors → body parsers, in that order and BEFORE listen(); see
  // configureHttpMiddleware for why the order is load-bearing and why the
  // parser limits must be in place before Nest's init() registers its own.
  configureHttpMiddleware(app, { webOrigin });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Expose interactive API docs everywhere except production.
  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("WealthMe API")
      .setDescription("WealthMe personal finance platform API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);

    // Registered on the raw Express instance rather than through the
    // adapter: `getInstance()` is typed as `Express`, so `res` infers as
    // Express' own `Response`. Going through `getHttpAdapter().get()` now
    // that `app` is a NestExpressApplication resolves the response generic
    // to the GLOBAL fetch `Response` and would need a cast to paper over.
    app
      .getHttpAdapter()
      .getInstance()
      .get("/api/docs-json", (_req, res) => {
        res.json(document);
      });
  }

  await app.listen(port);
}

void bootstrap();
