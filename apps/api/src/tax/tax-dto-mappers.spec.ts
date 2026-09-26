import {
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { computePphOp } from "../tax-engine/pph-op.engine";
import { TerNotApplicableError } from "../tax-engine/ter.engine";

import { mapEngineError, toPphOpResultDto } from "./tax-dto-mappers";

describe("toPphOpResultDto", () => {
  it("K/1 120jt gross, pension 3,6jt, zakat 2,5jt → tax 2.245.000, bracket[0].upTo 60.000.000", () => {
    const r = computePphOp({
      taxYear: 2026,
      status: { maritalStatus: "K", dependents: 1 },
      employmentGross: 120_000_000n,
      pensionContribution: 3_600_000n,
      freelance: null,
      otherNetIncome: 0n,
      zakat: 2_500_000n,
      withheldPph21: 2_000_000n,
    });
    const dto = toPphOpResultDto(r);
    expect(dto.tax).toBe("2245000");
    expect(dto.brackets[0]?.upTo).toBe("60000000");
  });
});

describe("mapEngineError", () => {
  it("maps RangeError to BadRequestException", () => {
    expect(() => mapEngineError(new RangeError("x"))).toThrow(
      BadRequestException,
    );
  });
  it("maps TerNotApplicableError to UnprocessableEntityException", () => {
    expect(() => mapEngineError(new TerNotApplicableError(2023))).toThrow(
      UnprocessableEntityException,
    );
  });
  it("rethrows anything else", () => {
    const e = new Error("boom");
    expect(() => mapEngineError(e)).toThrow(e);
  });
});
