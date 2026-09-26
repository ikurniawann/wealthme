import { extractApiErrorMessage } from "./fx-inputs";

const T = {
  money: {
    fxIndicativeRefused:
      "Kurs tidak tersedia saat ini — coba lagi atau gunakan IDR",
  },
};

describe("extractApiErrorMessage — revisi I (I2)", () => {
  it("maps a 503 to the friendly, localized refusal message", () => {
    expect(
      extractApiErrorMessage(
        { status: 503, message: "fxInputs: FX rate is indicative only" },
        T,
      ),
    ).toBe(T.money.fxIndicativeRefused);
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
