import { apiErrorMessage } from "./api-error";

const FALLBACK = "Gagal menyimpan. Coba lagi.";

describe("apiErrorMessage", () => {
  it("shows a human Indonesian server message verbatim", () => {
    const err = {
      status: 409,
      message: "KPR BTN sudah dibayar untuk periode ini. Pilih periode lain.",
    };
    expect(apiErrorMessage(err, FALLBACK)).toBe(err.message);
  });

  it("never shows a 5xx message", () => {
    expect(
      apiErrorMessage(
        { status: 500, message: "Internal server error" },
        FALLBACK,
      ),
    ).toBe(FALLBACK);
  });

  it("hides class-validator and regex text", () => {
    for (const message of [
      "occurredAt must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression",
      "rateBpsOverride must not be greater than 10000",
      "amount should not be empty",
    ]) {
      expect(apiErrorMessage({ status: 400, message }, FALLBACK)).toBe(
        FALLBACK,
      );
    }
  });

  it("translates known English business messages", () => {
    expect(
      apiErrorMessage(
        { status: 409, message: "A budget already exists for this category" },
        FALLBACK,
      ),
    ).toBe("Kategori ini sudah punya anggaran. Ubah anggaran yang ada.");
    expect(
      apiErrorMessage(
        { status: 400, message: "COA code 1234 must be exactly 5 digits" },
        FALLBACK,
      ),
    ).toBe("Kode COA harus 5 digit angka.");
  });

  it("falls back for unknown English and for non-API errors", () => {
    expect(
      apiErrorMessage(
        { status: 400, message: "Something else is not allowed here" },
        FALLBACK,
      ),
    ).toBe(FALLBACK);
    expect(apiErrorMessage(new Error("Failed to fetch"), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(apiErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});
