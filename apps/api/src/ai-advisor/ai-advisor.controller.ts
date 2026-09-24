import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";
import { assertHouseholdWideReadAllowed } from "../common/utils/privacy.util";

import { AiAdvisorNotConfiguredError } from "./ai-advisor-not-configured.error";
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiAdvisorService } from "./ai-advisor.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiConversationService } from "./ai-conversation.service";
import { AiKeyCorruptedError } from "./ai-key-corrupted.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChatRequestDto } from "./dto/chat-request.dto";

import type {
  ConversationDetailDto,
  ConversationSummaryDto,
} from "./ai-conversation.service";
import type { Request, Response } from "express";

@ApiTags("ai-advisor")
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@PageAccess("ai-advisor")
@Controller("family-groups/:familyGroupId/ai-advisor")
export class AiAdvisorController {
  private readonly logger = new Logger(AiAdvisorController.name);

  constructor(
    private readonly aiAdvisorService: AiAdvisorService,
    private readonly conversations: AiConversationService,
  ) {}

  @Post("chat")
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiOperation({ summary: "Stream AI advisor chat response (SSE)" })
  async chat(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    // EPIC-023 Task C retry (CRITICAL six-reviewer finding) — CASL's
    // "read Transaction" is held by both `dependant` and `operational`
    // (D3/D5), but `buildContext()` aggregates whole-family net worth,
    // monthly income/expense, and asset/liability totals — the exact same
    // household-wide surface reports/exports/net-worth history already deny
    // outright (see reports.controller.ts). A partial "my own" advisor
    // context is not a privacy-preserving one; it is a wrong one.
    assertHouseholdWideReadAllowed(req.tenantContext?.member);

    // Saved sessions belong to the member who held them, not to the family
    // (see AiConversationService's class comment).
    const userId = req.tenantContext?.userId;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      // Accumulated so the completed exchange can be filed into the saved
      // session below. The tokens are already on the wire by then — this is
      // a copy for storage, never the source of what the user sees.
      let answer = "";
      const { truncated } = await this.aiAdvisorService.streamChat(
        familyGroupId,
        dto.messages,
        (token) => {
          answer += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        // Drives which private accounts/categories the context may include —
        // see AiAdvisorService#buildContext.
        req.tenantContext?.member ?? null,
      );

      // Persist only a completed exchange, and never let a storage failure
      // corrupt a stream the user already received: the answer is on screen
      // and paid for either way, so a failed write costs history, not the
      // reply. `conversationId` stays undefined in that case and the client
      // simply starts a new session on its next turn.
      let conversationId: string | undefined;
      const lastUserMessage = [...dto.messages]
        .reverse()
        .find((m) => m.role === "user")?.content;
      if (lastUserMessage && answer.length > 0 && userId) {
        try {
          ({ conversationId } = await this.conversations.appendExchange({
            familyGroupId,
            userId,
            conversationId: dto.conversationId ?? null,
            userMessage: lastUserMessage,
            assistantMessage: answer,
            truncated,
          }));
        } catch {
          conversationId = undefined;
        }
      }

      // EPIC-023 Task G retry (CRITICAL five-reviewer finding) — a response
      // that hit the provider's token cap must say so explicitly; `done:
      // true` alone made a cut-off answer indistinguishable from a
      // complete one.
      res.write(
        `data: ${JSON.stringify({ done: true, truncated, conversationId })}\n\n`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      // EPIC-023 G3 (D16) / Task G retry (MEDIUM finding) — a distinguishable
      // code per failure kind so the web app renders "no key configured",
      // "your stored key could not be read", "the provider rejected this
      // key", "rate limited — try again", or "timed out" instead of one
      // generic error toast for all of them.
      const code =
        err instanceof AiAdvisorNotConfiguredError
          ? "AI_NOT_CONFIGURED"
          : err instanceof AiKeyCorruptedError
            ? "AI_KEY_CORRUPTED"
            : err instanceof AiAdvisorAuthError
              ? "AI_AUTH_FAILED"
              : err instanceof AiAdvisorRateLimitError
                ? "AI_RATE_LIMITED"
                : err instanceof ExternalRequestTimeoutError
                  ? "AI_TIMEOUT"
                  : undefined;
      // A rate limit carries the only detail the user can act on: whether to
      // wait seconds or wait until tomorrow. Passing just the code made the UI
      // say "coba lagi sebentar lagi" for a per-day cap, so the user retried in
      // a loop. The provider's own English sentence stays server-side (it names
      // billing pages and quota metrics) but is logged for diagnosis.
      const rateLimit =
        err instanceof AiAdvisorRateLimitError
          ? { scope: err.scope, retryAfterSeconds: err.retryAfterSeconds }
          : undefined;
      if (err instanceof AiAdvisorRateLimitError && err.providerDetail) {
        this.logger.warn(`AI provider rate limit: ${err.providerDetail}`);
      }
      res.write(
        `data: ${JSON.stringify({ error: msg, code, ...rateLimit })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  // The three routes below carry the same `assertHouseholdWideReadAllowed`
  // gate as `chat`, for the same reason: a transcript restates whole-family
  // net worth and monthly totals, so a role that may not read the household
  // picture may not read a conversation about it either — even one it could
  // never have created, since the same gate blocks `chat`.

  @Get("conversations")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiOperation({ summary: "List my saved AI advisor sessions" })
  async listConversations(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
  ): Promise<ConversationSummaryDto[]> {
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    return this.conversations.list(familyGroupId, req.tenantContext!.userId);
  }

  @Get("conversations/:conversationId")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiOperation({ summary: "Read one saved AI advisor session" })
  async getConversation(
    @Param("familyGroupId") familyGroupId: string,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
    @Req() req: Request,
  ): Promise<ConversationDetailDto> {
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    return this.conversations.findOne(
      familyGroupId,
      req.tenantContext!.userId,
      conversationId,
    );
  }

  @Delete("conversations/:conversationId")
  @HttpCode(204)
  @CheckAbility((ab: AppAbility) => ab.can("read", "Transaction"))
  @ApiOperation({ summary: "Delete one saved AI advisor session" })
  async deleteConversation(
    @Param("familyGroupId") familyGroupId: string,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
    @Req() req: Request,
  ): Promise<void> {
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    await this.conversations.remove(
      familyGroupId,
      req.tenantContext!.userId,
      conversationId,
    );
  }
}
