import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UploadSyncDto } from "./upload-sync.dto";

/**
 * Hardening audit (validation, MEDIUM) — the legacy `/reconciliation/upload`
 * endpoint had an unbounded `rows` array, an unbounded float `amount`, and
 * an unchecked `currency`.
 */
function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    date: "2026-01-01",
    description: "Test row",
    amount: 100_000,
    ...overrides,
  };
}

describe("UploadSyncDto", () => {
  it("passes with a normal row set", async () => {
    const dto = plainToInstance(UploadSyncDto, {
      fileName: "statement.csv",
      rows: [row()],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects an empty rows array", async () => {
    const dto = plainToInstance(UploadSyncDto, {
      fileName: "statement.csv",
      rows: [],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "rows")).toBe(true);
  });

  it("rejects more than MAX_STATEMENT_ROWS rows", async () => {
    const dto = plainToInstance(UploadSyncDto, {
      fileName: "statement.csv",
      rows: Array.from({ length: 2001 }, () => row()),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "rows")).toBe(true);
  });

  it("rejects a fileName over 255 chars", async () => {
    const dto = plainToInstance(UploadSyncDto, {
      fileName: "a".repeat(256),
      rows: [row()],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "fileName")).toBe(true);
  });

  it("rejects an out-of-range amount", async () => {
    const dto = plainToInstance(UploadSyncDto, {
      fileName: "statement.csv",
      rows: [row({ amount: 1e15 })],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a currency outside the supported list", async () => {
    const dto = plainToInstance(UploadSyncDto, {
      fileName: "statement.csv",
      rows: [row({ currency: "XYZ" })],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts a supported currency", async () => {
    const dto = plainToInstance(UploadSyncDto, {
      fileName: "statement.csv",
      rows: [row({ currency: "USD" })],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
