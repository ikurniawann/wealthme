import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { CATEGORIZATION_PORT } from "./categorization.port";
import { ClaudeCategorizationAdapter } from "./claude-categorization.adapter";
import { MockCategorizationService } from "./mock-categorization.service";

import type { Env } from "../config/env";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CATEGORIZATION_PORT,
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get("ANTHROPIC_API_KEY", { infer: true });
        if (apiKey) return new ClaudeCategorizationAdapter(apiKey);
        return new MockCategorizationService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [CATEGORIZATION_PORT],
})
export class CategorizationModule {}
