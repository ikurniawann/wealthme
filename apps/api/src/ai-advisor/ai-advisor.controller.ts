import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";
import { assertHouseholdWideReadAllowed } from "../common/utils/privacy.util";

import { AiAdvisorNotConfiguredError } from "./ai-advisor-not-configured.error";
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiAdvisorService } from "./ai-advisor.service";
import { AiKeyCorruptedError } from "./ai-key-corrupted.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChatRequestDto } from "./dto/chat-request.dto";

import type { Request, Response } from "express";

@ApiTags("ai-advisor")
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Controller("family-groups/:familyGroupId/ai-advisor")
export class AiAdvisorController {
  constructor(private readonly aiAdvisorService: AiAdvisorService) {}

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
    assertHouseholdWideReadAllowed(req.tenantContext?.member?.role);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const { truncated } = await this.aiAdvisorService.streamChat(
        familyGroupId,
        dto.messages,
        (token) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
      );
      // EPIC-023 Task G retry (CRITICAL five-reviewer finding) — a response
      // that hit the provider's token cap must say so explicitly; `done:
      // true` alone made a cut-off answer indistinguishable from a
      // complete one.
      res.write(`data: ${JSON.stringify({ done: true, truncated })}\n\n`);
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
      res.write(`data: ${JSON.stringify({ error: msg, code })}\n\n`);
    } finally {
      res.end();
    }
  }
}
