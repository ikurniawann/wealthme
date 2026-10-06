import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Batch C (revisi-2) — DisplayCurrencyProvider/useMoney unit tests: IDR
// passthrough, USD conversion, and the not-ready (skeleton) state, per
// revisi-2-brief.md C4.

const mockUseSession = jest.fn();
jest.mock("../lib/auth-compat", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockApiFetch = jest.fn();
jest.mock("../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { DisplayCurrencyProvider, useMoney } from "./use-money";

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DisplayCurrencyProvider>{children}</DisplayCurrencyProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockUseSession.mockReturnValue({
    data: { accessToken: "test-token" },
  });
});

describe("useMoney", () => {
  it("passes IDR amounts through formatRupiah unconverted", async () => {
    mockApiFetch.mockResolvedValue({ currency: "IDR" });

    const { result } = renderHook(() => useMoney(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isIndicative).toBe(false);
    expect(result.current.format(1_000_000)).toBe("Rp\u00A01.000.000");
    expect(result.current.formatExact("9007199254740993")).toBe(
      "Rp\u00A09.007.199.254.740.993",
    );
    // Never fetches /fx/rates for an IDR-preference user.
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/auth/profile", {
      token: "test-token",
    });
  });

  it("converts once, at display, when the profile currency is USD", async () => {
    mockApiFetch.mockImplementation((path: string) =>
      path.startsWith("/auth/profile")
        ? Promise.resolve({ currency: "USD" })
        : Promise.resolve({ base: "IDR", rates: { USD: 0.0000615 } }),
    );

    const { result } = renderHook(() => useMoney(), { wrapper });

    await waitFor(() => expect(result.current.currency).toBe("USD"));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isIndicative).toBe(true);
    // 1,000,000 IDR * 0.0000615 = 61,50 -> "US$ 61,50" (id-ID digits), prefixed
    // "≈ " since it's an indicative conversion.
    expect(result.current.format(1_000_000)).toBe("≈ US$\u00A061,50");
    expect(result.current.formatCompact(1_000_000)).toBe("≈ US$\u00A061,50");
    expect(result.current.formatExact("1000000")).toBe("≈ US$\u00A061,50");
  });

  it("stays not-ready while the FX rate is still in flight, never a 1:1 fallback", async () => {
    mockApiFetch.mockImplementation((path: string) =>
      path.startsWith("/auth/profile")
        ? Promise.resolve({ currency: "USD" })
        : new Promise(() => {
            // never resolves — simulates an in-flight /fx/rates request
          }),
    );

    const { result } = renderHook(() => useMoney(), { wrapper });

    await waitFor(() => expect(result.current.currency).toBe("USD"));
    expect(result.current.isReady).toBe(false);
    // The honest IDR figure, never an IDR-scale number under "$".
    expect(result.current.format(10_000_000)).toBe("Rp\u00A010.000.000");
    expect(result.current.format(10_000_000)).not.toContain("$");
  });

  it("masks amounts app-wide when hideBalance is on, keeping the prefix", async () => {
    mockApiFetch.mockResolvedValue({
      currency: "IDR",
      privacyPrefs: { hideBalance: true },
    });

    const { result } = renderHook(() => useMoney(), { wrapper });

    // isReady is already true on mount for the IDR default (it doesn't gate
    // on privacyPrefs); wait for the profile fetch itself to resolve.
    await waitFor(() => expect(result.current.hideBalance).toBe(true));
    expect(result.current.format(1_000_000)).toBe("Rp\u00A0••••••");
    expect(result.current.formatCompact(1_000_000)).toBe("Rp\u00A0••••••");
    expect(result.current.formatExact("1000000")).toBe("Rp\u00A0••••••");
  });

  it("never adds decimals to IDR", async () => {
    mockApiFetch.mockResolvedValue({
      currency: "IDR",
      privacyPrefs: {},
    });

    const { result } = renderHook(() => useMoney(), { wrapper });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(result.current.format(1_000_000)).toBe("Rp\u00A01.000.000");
    expect(result.current.formatExact("1000000")).toBe("Rp\u00A01.000.000");
    expect(result.current.formatBalance("1000000")).toBe("Rp\u00A01.000.000");
  });

  it("puts the sign of a negative before the symbol", async () => {
    mockApiFetch.mockResolvedValue({ currency: "IDR", privacyPrefs: {} });

    const { result } = renderHook(() => useMoney(), { wrapper });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(result.current.format(-4_200_000)).toBe("-Rp\u00A04.200.000");
    expect(result.current.formatExact("-4200000")).toBe("-Rp\u00A04.200.000");
  });
});
