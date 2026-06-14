import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { AccountsModule } from "./accounts/accounts.module";
import { AssetsModule } from "./assets/assets.module";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { BudgetsModule } from "./budgets/budgets.module";
import { CalculatorsModule } from "./calculators/calculators.module";
import { CaslModule } from "./casl/casl.module";
import { CategoriesModule } from "./categories/categories.module";
import { CommonModule } from "./common/common.module";
import { AbilitiesGuard } from "./common/guards/abilities.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { validateEnv } from "./config/env";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ExportsModule } from "./exports/exports.module";
import { FamilyGroupsModule } from "./family-groups/family-groups.module";
import { GoalsModule } from "./goals/goals.module";
import { HealthModule } from "./health/health.module";
import { InheritanceModule } from "./inheritance/inheritance.module";
import { InsurancesModule } from "./insurances/insurances.module";
import { InvestmentsModule } from "./investments/investments.module";
import { LiabilitiesModule } from "./liabilities/liabilities.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { ReportsModule } from "./reports/reports.module";
import { SearchModule } from "./search/search.module";
import { SplitBillsModule } from "./split-bills/split-bills.module";
import { TransactionsModule } from "./transactions/transactions.module";

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
    CategoriesModule,
    CommonModule,
    AuditModule,
    SearchModule,
    SplitBillsModule,
    TransactionsModule,
    DashboardModule,
    BudgetsModule,
    CalculatorsModule,
    GoalsModule,
    AssetsModule,
    ExportsModule,
    FamilyGroupsModule,
    InheritanceModule,
    InvestmentsModule,
    InsurancesModule,
    LiabilitiesModule,
    NotificationsModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: AbilitiesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
