import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { AccountsModule } from "./accounts/accounts.module";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { CaslModule } from "./casl/casl.module";
import { CommonModule } from "./common/common.module";
import { AbilitiesGuard } from "./common/guards/abilities.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { validateEnv } from "./config/env";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { SearchModule } from "./search/search.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      },
    }),
    RedisModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    CaslModule,
    CommonModule,
    AuditModule,
    SearchModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: AbilitiesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
