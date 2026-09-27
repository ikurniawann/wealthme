import { extractApiErrorMessage } from "./fx-inputs";

const T = {
  money: {
    fxIndicativeRefused:
      "Kurs tidak tersedia saat ini — coba lagi atau gunakan IDR",
  },
};

describe("extractApiErrorMessage — revisi I (I2), revisi K (bug 2)", () => {
  it("maps the FX_RATE_UNAVAILABLE code to the friendly, localized refusal message", () => {
    expect(
      extractApiErrorMessage(
        {
          status: 503,
          code: "FX_RATE_UNAVAILABLE",
          message: "fxInputs: FX rate is indicative only",
        },
        T,
      ),
    ).toBe(T.money.fxIndicativeRefused);
  });

  // Revisi K bug 2 — every 503 used to be mapped to the FX refusal message.
  // A 503 from an unrelated cause (no code, or a different code) must NOT
  // be swallowed into "Kurs tidak tersedia".
  it("passes a 503 without the FX_RATE_UNAVAILABLE code through untouched (returns null)", () => {
    expect(
      extractApiErrorMessage({ status: 503, message: "db unavailable" }, T),
    ).toBeNull();
    expect(
      extractApiErrorMessage(
        { status: 503, code: "SOME_OTHER_CODE", message: "x" },
        T,
      ),
    ).toBeNull();
  });

  it("passes every other status through untouched (returns null)", () => {
    expect(
      extractApiErrorMessage({ status: 400, message: "bad" }, T),
    ).toBeNull();
    expect(extractApiErrorMessage({ status: 401 }, T)).toBeNull();
    expect(extractApiErrorMessage(new Error("network"), T)).toBeNull();
    expect(extractApiErrorMessage(undefined, T)).toBeNull();
  });
});
