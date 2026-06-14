import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PrismaModule } from "../prisma/prisma.module";

import { AiAdvisorController } from "./ai-advisor.controller";
import { AI_ADVISOR_PORT } from "./ai-advisor.port";
import { AiAdvisorService } from "./ai-advisor.service";
import { ClaudeAdvisorService } from "./claude-advisor.service";
import { MockAdvisorService } from "./mock-advisor.service";

import type { Env } from "../config/env";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AiAdvisorController],
  providers: [
    AiAdvisorService,
    {
      provide: AI_ADVISOR_PORT,
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get("ANTHROPIC_API_KEY", { infer: true });
        if (apiKey) return new ClaudeAdvisorService(apiKey);
        return new MockAdvisorService();
      },
      inject: [ConfigService],
    },
  ],
})
export class AiAdvisorModule {}
