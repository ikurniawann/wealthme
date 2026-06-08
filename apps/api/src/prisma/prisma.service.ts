import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Never log raw queries — they can carry PII (emails, tokens). Warn/error only.
    super({ log: ["warn", "error"] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    // A failure during teardown must not block orderly shutdown.
    await this.$disconnect().catch(() => undefined);
  }
}
