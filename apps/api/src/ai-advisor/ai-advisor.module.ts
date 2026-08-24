import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { AiAdvisorFactory } from "./ai-advisor-factory.service";
import { AiAdvisorController } from "./ai-advisor.controller";
import { AiAdvisorService } from "./ai-advisor.service";
import { AiConversationService } from "./ai-conversation.service";
import { AiKeyController } from "./ai-key.controller";
import { AiKeyService } from "./ai-key.service";

/**
 * EPIC-023 G3 (D16) — no more `AI_ADVISOR_PORT` DI binding resolved once at
 * boot from `ANTHROPIC_API_KEY` (that bound a single provider for every
 * family, and fell back to MockAdvisorService when unset — exactly the
 * mock-answer-as-advice and one-family-pays-for-another's-usage failure
 * modes D16 forbids). AiAdvisorService now resolves the provider adapter
 * PER REQUEST from the caller's own family key via AiKeyService +
 * AiAdvisorFactory. `CryptoModule` is `@Global()` (see crypto.module.ts),
 * so `AiKeyService`'s `CryptoService` dependency needs no import here.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AiAdvisorController, AiKeyController],
  providers: [
    AiAdvisorService,
    AiConversationService,
    AiKeyService,
    AiAdvisorFactory,
  ],
  // EPIC-027 B5 (D11) — TransactionsModule resolves the family AI key for
  // receipt OCR through this same service. Exported (rather than
  // re-provided there) so both paths share ONE instance and one contract
  // about where the decrypted key may go.
  exports: [AiKeyService],
})
export class AiAdvisorModule {}
