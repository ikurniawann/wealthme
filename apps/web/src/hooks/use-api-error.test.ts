import { renderHook } from "@testing-library/react";
import { toast } from "sonner";

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// `@/components/money`'s barrel re-exports `MoneyInput`, which transitively
// imports `auth-client` (ESM-only, breaks Jest outside a browser-runtime
// context — see api-client.ts's comment on the same issue). This hook only
// needs `extractApiErrorMessage`, so mock the barrel down to the real
// implementation of just that function.
jest.mock("../components/money", () => ({
  extractApiErrorMessage: (
    jest.requireActual("../components/money/fx-inputs") as {
      extractApiErrorMessage: typeof import("../components/money/fx-inputs").extractApiErrorMessage;
    }
  ).extractApiErrorMessage,
}));

import { friendlyServerMessage, useApiError } from "./use-api-error";

// Revisi K bug 2 — every HTTP 503 used to be mapped to the FX refusal
// message ("Kurs tidak tersedia"). Only a 503 carrying
// `code: "FX_RATE_UNAVAILABLE"` should show that message; any other 503
// (or any other status) must keep its own/generic handling.
describe("useApiError — revisi K bug 2", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows the FX refusal toast only for a 503 with code FX_RATE_UNAVAILABLE", () => {
    const { result } = renderHook(() => useApiError());
    result.current.handleError({
      status: 503,
      code: "FX_RATE_UNAVAILABLE",
      message: "fxInputs: FX rate is indicative only",
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Kurs tidak tersedia"),
    );
  });

  // A2 (revisi-2) — an unrecognised error no longer shows the raw server
  // `.message` (which can be a Prisma/class-validator/English technical
  // string); it falls back to localized generic copy instead.
  it("does NOT show the FX refusal toast for an unrelated 503, and never the raw message", () => {
    const { result } = renderHook(() => useApiError());
    result.current.handleError({
      status: 503,
      message: "Service temporarily unavailable",
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Terjadi kesalahan, silakan coba lagi",
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Kurs tidak tersedia"),
    );
  });

  it("never shows a raw non-ApiError message (plain JS/network error)", () => {
    const { result } = renderHook(() => useApiError());
    result.current.handleError(new Error("TypeError: fetch failed"));
    expect(toast.error).toHaveBeenCalledWith(
      "Terjadi kesalahan, silakan coba lagi",
    );
  });

  it("still handles 401/403 specially regardless of the FX mapping", () => {
    const { result } = renderHook(() => useApiError());
    result.current.handleError({ status: 401 });
    expect(toast.error).toHaveBeenCalledWith(
      "Sesi habis, silakan login kembali",
    );
  });
});

describe("friendlyServerMessage", () => {
  it("keeps plain Indonesian business copy from a 4xx", () => {
    expect(
      friendlyServerMessage({
        status: 400,
        message: 'Saldo rekening bank "BCA" tidak mencukupi untuk Rp 500.000',
      }),
    ).toBe('Saldo rekening bank "BCA" tidak mencukupi untuk Rp 500.000');
  });

  it("drops technical or validator text and every 5xx", () => {
    expect(
      friendlyServerMessage({ status: 400, message: "name must be a string" }),
    ).toBeNull();
    expect(
      friendlyServerMessage({ status: 400, message: "HTTP 504 Gateway" }),
    ).toBeNull();
    expect(
      friendlyServerMessage({
        status: 409,
        message: "PrismaClientKnownRequestError",
      }),
    ).toBeNull();
    expect(
      friendlyServerMessage({ status: 500, message: "Saldo tidak cukup" }),
    ).toBeNull();
  });
});
