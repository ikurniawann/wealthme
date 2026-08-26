import {
  type HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { AiKeyCorruptedError } from "../../ai-advisor/ai-key-corrupted.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { toStatementReaderHttpException } from "./statement-reader-http-error.util";
import { StatementReaderNotConfiguredError } from "./statement-reader-not-configured.error";
import { StatementReaderParseError } from "./statement-reader-parse.error";

function bodyOf(err: HttpException): Record<string, unknown> {
  return err.getResponse() as Record<string, unknown>;
}

/**
 * EPIC-029 E2d — every failure gets a DISTINCT, actionable code. The point is
 * not tidiness: "add an AI key", "re-enter your key", "wait for the quota"
 * and "this file is a scan" are four completely different things for the user
 * to do, and one generic 502 tells them none of them.
 */
describe("toStatementReaderHttpException", () => {
  it("maps a missing family key to 412 STATEMENT_AI_NOT_CONFIGURED", () => {
    const ex = toStatementReaderHttpException(
      new StatementReaderNotConfiguredError(),
    );
    expect(ex.getStatus()).toBe(HttpStatus.PRECONDITION_FAILED);
    expect(bodyOf(ex).code).toBe("STATEMENT_AI_NOT_CONFIGURED");
  });

  it("maps an undecryptable stored key to 409 AI_KEY_CORRUPTED", () => {
    const ex = toStatementReaderHttpException(new AiKeyCorruptedError());
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(bodyOf(ex).code).toBe("AI_KEY_CORRUPTED");
  });

  it("maps a rejected key to 502 STATEMENT_AI_AUTH", () => {
    const ex = toStatementReaderHttpException(new AiAdvisorAuthError("Claude"));
    expect(ex.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(bodyOf(ex).code).toBe("STATEMENT_AI_AUTH");
  });

  it("maps a rate limit to 429 and carries the quota scope", () => {
    const ex = toStatementReaderHttpException(
      new AiAdvisorRateLimitError("Gemini", "daily"),
    );
    expect(ex.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(bodyOf(ex).code).toBe("STATEMENT_AI_RATE_LIMITED");
    expect(bodyOf(ex).scope).toBe("daily");
  });

  it("maps a timeout to 504 STATEMENT_AI_TIMEOUT", () => {
    const ex = toStatementReaderHttpException(
      new ExternalRequestTimeoutError("Claude statement request"),
    );
    expect(ex.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
    expect(bodyOf(ex).code).toBe("STATEMENT_AI_TIMEOUT");
  });

  it("maps a bad model answer to 502 STATEMENT_AI_PARSE_FAILED", () => {
    const ex = toStatementReaderHttpException(
      new StatementReaderParseError("invalid fields: rows.0.amount"),
    );
    expect(ex.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(bodyOf(ex).code).toBe("STATEMENT_AI_PARSE_FAILED");
  });

  it("falls back to 502 STATEMENT_AI_UPSTREAM_FAILED for anything unrecognised", () => {
    const ex = toStatementReaderHttpException(new Error("socket hang up"));
    expect(ex.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(bodyOf(ex).code).toBe("STATEMENT_AI_UPSTREAM_FAILED");
  });

  it("passes an HttpException the service already built straight through", () => {
    // The page-cap / no-text-layer / zero-rows refusals are decided BEFORE any
    // provider is contacted. Re-wrapping them as "upstream failed" would tell
    // the user to retry a call that never happened.
    const original = new UnprocessableEntityException({
      message: "scan",
      code: "STATEMENT_NO_TEXT_LAYER",
    });
    const ex = toStatementReaderHttpException(original);
    expect(ex).toBe(original);
    expect(bodyOf(ex).code).toBe("STATEMENT_NO_TEXT_LAYER");
  });

  it("never leaks the provider's own text into a client-facing message", () => {
    const ex = toStatementReaderHttpException(
      new Error("401 {'error': 'invalid api key sk-abc123'}"),
    );
    expect(String(bodyOf(ex).message)).not.toContain("sk-abc123");
  });

  it("gives every code its own message", () => {
    const messages = [
      new StatementReaderNotConfiguredError(),
      new AiKeyCorruptedError(),
      new AiAdvisorAuthError("Claude"),
      new AiAdvisorRateLimitError("Claude"),
      new ExternalRequestTimeoutError("x"),
      new StatementReaderParseError(),
      new Error("other"),
    ].map((err) => String(bodyOf(toStatementReaderHttpException(err)).message));
    expect(new Set(messages).size).toBe(messages.length);
  });
});
