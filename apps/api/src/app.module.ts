import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { AccountsModule } from "./accounts/accounts.module";
import { AiAdvisorModule } from "./ai-advisor/ai-advisor.module";
import { AssetsModule } from "./assets/assets.module";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BetterAuthGuard } from "./auth/guards/better-auth.guard";
import { BillingCycleModule } from "./billing-cycle/billing-cycle.module";
import { BudgetsModule } from "./budgets/budgets.module";
import { CalculatorsModule } from "./calculators/calculators.module";
import { CaslModule } from "./casl/casl.module";
import { CategoriesModule } from "./categories/categories.module";
import { CoaAccountsModule } from "./coa-accounts/coa-accounts.module";
import { CommonModule } from "./common/common.module";
import { AbilitiesGuard } from "./common/guards/abilities.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { validateEnv } from "./config/env";
import { CryptoModule } from "./crypto/crypto.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DonationsModule } from "./donations/donations.module";
import { ExportsModule } from "./exports/exports.module";
import { FamilyGroupsModule } from "./family-groups/family-groups.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { FxModule } from "./fx/fx.module";
import { GdprModule } from "./gdpr/gdpr.module";
import { GoalsModule } from "./goals/goals.module";
import { HealthModule } from "./health/health.module";
import { InheritanceModule } from "./inheritance/inheritance.module";
import { InsurancesModule } from "./insurances/insurances.module";
import { InvestmentsModule } from "./investments/investments.module";
import { LiabilitiesModule } from "./liabilities/liabilities.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OpenBankingModule } from "./open-banking/open-banking.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { RedisModule } from "./redis/redis.module";
import { ReportsModule } from "./reports/reports.module";
import { SearchModule } from "./search/search.module";
import { SplitBillsModule } from "./split-bills/split-bills.module";
import { StorageModule } from "./storage/storage.module";
import { TaxModule } from "./tax/tax.module";
import { TransactionsModule } from "./transactions/transactions.module";

import type { IncomingMessage } from "node:http";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Root .env is the single source of truth; fall back to a local .env for
      // standalone api runs. Real process.env (e.g. injected by Docker / CI)
      // always takes precedence over these files — NestJS ConfigModule default.
      envFilePath: ["../../.env", ".env"],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env["LOG_LEVEL"] ??
          (process.env["NODE_ENV"] === "production" ? "info" : "debug"),
        customProps: (req: IncomingMessage) => ({
          requestId: (req.headers as Record<string, string | string[]>)[
            "x-request-id"
          ],
        }),
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),
    RedisModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    AiAdvisorModule,
    CaslModule,
    CategoriesModule,
    CoaAccountsModule,
    CommonModule,
    CryptoModule,
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
    FeedbackModule,
    DonationsModule,
    InheritanceModule,
    InvestmentsModule,
    InsurancesModule,
    LiabilitiesModule,
    BillingCycleModule,
    NotificationsModule,
    ReportsModule,
    StorageModule,
    TaxModule,
    FxModule,
    GdprModule,
    ReconciliationModule,
    OpenBankingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: BetterAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: AbilitiesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
