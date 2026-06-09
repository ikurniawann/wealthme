import { type ExecutionContext } from "@nestjs/common";
import { of, throwError } from "rxjs";

import { AuditInterceptor } from "./audit.interceptor";

const mockAuditService = {
  log: jest.fn(),
};

function makeContext(
  method: string,
  path: string,
  tenantContext?: { userId: string; familyGroupId: string | null },
  params: Record<string, string> = {},
  body: unknown = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path,
        params,
        body,
        ip: "127.0.0.1",
        headers: { "user-agent": "jest" },
        tenantContext,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("AuditInterceptor", () => {
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
    interceptor = new AuditInterceptor(mockAuditService as never);
  });

  it("skips logging for GET requests and returns observable unchanged", (done) => {
    // Arrange
    const ctx = makeContext("GET", "/accounts", {
      userId: "user-1",
      familyGroupId: null,
    });
    const next = { handle: () => of({ data: "some data" }) };

    // Act
    interceptor.intercept(ctx, next).subscribe({
      next: (value) => {
        // Assert
        expect(value).toEqual({ data: "some data" });
        expect(mockAuditService.log).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it("logs with action 'create' for POST requests", (done) => {
    // Arrange
    const ctx = makeContext(
      "POST",
      "/transactions",
      { userId: "user-1", familyGroupId: "fg-1" },
      {},
      { amount: 500 },
    );
    const next = { handle: () => of({ id: "txn-1" }) };

    // Act
    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        // Assert — give microtask queue a tick so the void promise resolves
        setImmediate(() => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              action: "create",
              entity: "Transaction",
            }),
          );
          done();
        });
      },
    });
  });

  it("logs with action 'update' for PATCH requests", (done) => {
    // Arrange
    const ctx = makeContext(
      "PATCH",
      "/accounts/123",
      { userId: "user-2", familyGroupId: "fg-2" },
      { id: "123" },
      { name: "Savings" },
    );
    const next = { handle: () => of({ id: "123", name: "Savings" }) };

    // Act
    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        setImmediate(() => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: "update", entity: "Account" }),
          );
          done();
        });
      },
    });
  });

  it("reads tenantContext.userId correctly", (done) => {
    // Arrange
    const ctx = makeContext("POST", "/members", {
      userId: "user-42",
      familyGroupId: "fg-99",
    });
    const next = { handle: () => of({ id: "m-1" }) };

    // Act
    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        setImmediate(() => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              userId: "user-42",
              familyGroupId: "fg-99",
            }),
          );
          done();
        });
      },
    });
  });

  it("does not propagate errors from auditService.log", (done) => {
    // Arrange — auditService.log throws
    mockAuditService.log.mockRejectedValue(new Error("audit DB down"));
    const ctx = makeContext("POST", "/accounts", {
      userId: "user-1",
      familyGroupId: null,
    });
    const next = { handle: () => of({ id: "acc-1" }) };

    // Act — the observable should still complete without error
    interceptor.intercept(ctx, next).subscribe({
      next: (value) => {
        expect(value).toEqual({ id: "acc-1" });
      },
      error: () => done.fail("should not propagate audit errors"),
      complete: () => done(),
    });
  });

  it("logs action '<method>:error' when the handler throws", (done) => {
    // Arrange
    const ctx = makeContext(
      "DELETE",
      "/accounts/99",
      { userId: "user-1", familyGroupId: "fg-1" },
      { id: "99" },
    );
    const next = { handle: () => throwError(() => new Error("not found")) };

    // Act
    interceptor.intercept(ctx, next).subscribe({
      error: () => {
        setImmediate(() => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: "delete:error" }),
          );
          done();
        });
      },
    });
  });
});
