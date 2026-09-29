import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ExportJobRequestDto } from "./export-job-request.dto";

/**
 * Hardening audit (validation, HIGH) — before this class existed, the
 * controller `@Body()`'d the `@wealthme/contracts` interface directly
 * (`import type`), so `ValidationPipe` validated nothing: a non-numeric
 * `months` became `NaN` deep in the service, and bad `type`/`format`/date
 * values passed straight through.
 */
describe("ExportJobRequestDto", () => {
  const VALID = { type: "summary", format: "pdf" };

  it("passes with only the required fields", async () => {
    const dto = plainToInstance(ExportJobRequestDto, VALID);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("passes with every optional field populated", async () => {
    const dto = plainToInstance(ExportJobRequestDto, {
      ...VALID,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      months: 6,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects an unknown report type", async () => {
    const dto = plainToInstance(ExportJobRequestDto, {
      ...VALID,
      type: "not-a-real-type",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "type")).toBe(true);
  });

  it("rejects an unknown format", async () => {
    const dto = plainToInstance(ExportJobRequestDto, {
      ...VALID,
      format: "csv",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "format")).toBe(true);
  });

  it("rejects a non-ISO8601 startDate", async () => {
    const dto = plainToInstance(ExportJobRequestDto, {
      ...VALID,
      startDate: "01/01/2025",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "startDate")).toBe(true);
  });

  // The exact bug the audit named: a non-numeric months used to become NaN
  // deep in exports.service.ts instead of failing validation up front.
  it("rejects a non-numeric months instead of letting it become NaN downstream", async () => {
    const dto = plainToInstance(ExportJobRequestDto, {
      ...VALID,
      months: "x",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "months")).toBe(true);
  });

  it("rejects months <= 0", async () => {
    const dto = plainToInstance(ExportJobRequestDto, { ...VALID, months: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "months")).toBe(true);
  });

  it("rejects months > 24", async () => {
    const dto = plainToInstance(ExportJobRequestDto, { ...VALID, months: 25 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "months")).toBe(true);
  });
});
