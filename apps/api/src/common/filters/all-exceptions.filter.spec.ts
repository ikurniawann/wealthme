import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import {
  AllExceptionsFilter,
  PAYLOAD_TOO_LARGE_CODE,
} from "./all-exceptions.filter";

import type { ArgumentsHost } from "@nestjs/common";

/**
 * EPIC-023 Task G retry (HIGH five-reviewer finding, round 2) — the prior
 * retry's "regression" coverage (reconciliation.service.spec.ts) asserted on
 * `exception.getResponse()` — the THROWN OBJECT, never the actual HTTP
 * response body the filter sends over the wire. That let a real wiring bug
 * (the filter building its response from scratch and never reading `code`
 * off the exception) pass unnoticed. Every test below calls the filter's
 * `catch()` directly and asserts on the JSON object passed to
 * `response.json(...)` — the real response body — never on the exception.
 */
function buildHost(): {
  host: ArgumentsHost;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
} {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  const response = { status: statusMock };
  const request = { headers: {}, url: "/test" };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, statusMock, jsonMock };
}

describe("AllExceptionsFilter — the real HTTP response body, not the exception object", () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it("forwards `code` from a sub-500 HttpException's body onto the actual response JSON", () => {
    const { host, statusMock, jsonMock } = buildHost();
    const exception = new BadRequestException({
      message: "Format file tidak didukung",
      code: "UNSUPPORTED_FORMAT",
    });

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Format file tidak didukung",
        code: "UNSUPPORTED_FORMAT",
      }),
    );
  });

  it("omits `code` entirely from the response body when the exception carries none", () => {
    const { host, jsonMock } = buildHost();
    const exception = new NotFoundException("BankSync not found");

    filter.catch(exception, host);

    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty("code");
    expect(body.message).toBe("BankSync not found");
  });

  // The core of the finding: a `code` that DOES exist on the exception body
  // must actually reach the serialized response, not just the exception.
  it("does not merely leave `code` reachable via getResponse() — it must appear on the JSON actually sent", () => {
    const { host, jsonMock } = buildHost();
    const exception = new BadRequestException({
      message: "irrelevant",
      code: "SOME_CODE",
    });

    // Sanity check: the exception object itself always carried `code` (this
    // is what the prior retry's test asserted, and it always passed).
    expect(exception.getResponse()).toEqual(
      expect.objectContaining({ code: "SOME_CODE" }),
    );

    filter.catch(exception, host);

    // The actual assertion this finding is about: the WIRE response.
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.code).toBe("SOME_CODE");
  });

  it("never forwards `code` for a 5xx HttpException, even if its body carries one", () => {
    const { host, statusMock, jsonMock } = buildHost();
    const exception = new HttpException(
      { message: "boom", code: "SHOULD_NOT_LEAK" },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty("code");
  });

  it("returns a generic message and no `code` for a non-HttpException error", () => {
    const { host, statusMock, jsonMock } = buildHost();

    filter.catch(new Error("some internal detail"), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty("code");
    expect(body.message).toBe("Internal server error");
  });

  /**
   * Body-parser's own error shape. Reproduced literally (a plain Error with
   * `status`/`statusCode`/`type`, NOT an HttpException) rather than mocked
   * through the filter's helper, because the shape is exactly what the
   * filter used to miss — it fell through to the generic 500 branch and the
   * client showed "something went wrong" for "your file is too big".
   */
  function payloadTooLargeError(): Error {
    return Object.assign(new Error("request entity too large"), {
      status: 413,
      statusCode: 413,
      type: "entity.too.large",
      expose: true,
      length: 3_000_000,
      limit: 2_113_536,
    });
  }

  it("maps body-parser's PayloadTooLargeError to a real 413 with a stable code", () => {
    const { host, statusMock, jsonMock } = buildHost();

    filter.catch(payloadTooLargeError(), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.statusCode).toBe(413);
    expect(body.code).toBe(PAYLOAD_TOO_LARGE_CODE);
  });

  it("maps it on `type` alone, in case a parser version omits the status fields", () => {
    const { host, statusMock } = buildHost();

    filter.catch(
      Object.assign(new Error("request entity too large"), {
        type: "entity.too.large",
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
  });

  it("never leaks the parser's internals on the 413 body", () => {
    const { host, jsonMock } = buildHost();

    filter.catch(payloadTooLargeError(), host);

    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/entity\.too\.large/i);
    expect(serialized).not.toMatch(/entity too large/i);
    // Our own configured limit is not a thing a client needs (or is told).
    expect(serialized).not.toContain("2113536");
    expect(body.message).toBe(
      "Data yang dikirim terlalu besar — kecilkan ukuran file atau foto lalu coba lagi.",
    );
  });

  it("leaves an unrelated non-HttpException error on the generic 500 path", () => {
    const { host, statusMock, jsonMock } = buildHost();

    filter.catch(
      Object.assign(new Error("boom"), { type: "entity.parse.failed" }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty("code");
    expect(body.message).toBe("Internal server error");
  });

  it("never forwards `code` for a 5xx thrown via InternalServerErrorException with a body code", () => {
    const { host, jsonMock } = buildHost();
    const exception = new InternalServerErrorException({
      message: "boom",
      code: "LEAKED_CODE",
    });

    filter.catch(exception, host);

    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty("code");
  });
});
