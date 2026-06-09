import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";

import type { Env } from "./config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService<Env, true>);
  const port = configService.get("PORT", { infer: true });
  const webOrigin = configService.get("WEB_ORIGIN", { infer: true });
  const nodeEnv = configService.get("NODE_ENV", { infer: true });

  // Security headers baseline (CSP, HSTS, X-Frame-Options, …).
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

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

    app.getHttpAdapter().get("/api/docs-json", (_req, res) => {
      res.json(document);
    });
  }

  await app.listen(port);
}

void bootstrap();
