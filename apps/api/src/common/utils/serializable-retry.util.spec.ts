import { Prisma } from "@prisma/client";

import { runSerializableWithRetry } from "./serializable-retry.util";

import type { PrismaService } from "../../prisma/prisma.service";

/** Mirrors liabilities.service.spec.ts's helper for constructing Prisma errors. */
function serializationFailure() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
    { code: "P2034", clientVersion: "test" },
  );
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function otherKnownError() {
  return new Prisma.PrismaClientKnownRequestError("Record not found", {
    code: "P2025",
    clientVersion: "test",
  });
}

function makePrisma() {
  return {
    $transaction: jest.fn(),
  } as unknown as PrismaService & { $transaction: jest.Mock };
}

describe("runSerializableWithRetry", () => {
  it("runs the callback at Serializable isolation and returns its result on the first attempt", async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb({ marker: "tx" }),
    );

    const fn = jest.fn().mockResolvedValue("ok");
    const result = await runSerializableWithRetry(prisma, fn);

    expect(result).toBe("ok");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("retries once on a P2034 serialization failure and succeeds on the second attempt", async () => {
    const prisma = makePrisma();
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(serializationFailure()))
      .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) =>
        cb({ marker: "tx" }),
      );

    const fn = jest.fn().mockResolvedValue("ok-after-retry");
    const result = await runSerializableWithRetry(prisma, fn);

    expect(result).toBe("ok-after-retry");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("retries on a P2002 unique-constraint race the same as P2034", async () => {
    const prisma = makePrisma();
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(uniqueViolation()))
      .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) =>
        cb({ marker: "tx" }),
      );

    const fn = jest.fn().mockResolvedValue("ok");
    const result = await runSerializableWithRetry(prisma, fn);

    expect(result).toBe("ok");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("gives up and surfaces the error once every retry attempt loses the conflict (bounded, not infinite)", async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockImplementation(() =>
      Promise.reject(serializationFailure()),
    );

    const fn = jest.fn();
    await expect(runSerializableWithRetry(prisma, fn, 3)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("rethrows a non-retryable error immediately without retrying", async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockImplementation(() =>
      Promise.reject(otherKnownError()),
    );

    const fn = jest.fn();
    await expect(runSerializableWithRetry(prisma, fn, 3)).rejects.toMatchObject(
      { code: "P2025" },
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rethrows a plain (non-Prisma) error immediately without retrying", async () => {
    const prisma = makePrisma();
    const boom = new Error("boom");
    prisma.$transaction.mockImplementation(() => Promise.reject(boom));

    const fn = jest.fn();
    await expect(runSerializableWithRetry(prisma, fn, 3)).rejects.toBe(boom);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
