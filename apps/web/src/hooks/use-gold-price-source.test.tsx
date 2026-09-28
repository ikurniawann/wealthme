/**
 * B9 (client revision round 2) — useGoldPrice's source-selection logic: the
 * live Antam feed (GET /gold-price/antam) wins whenever it has a price, the
 * family's manually-entered price is the fallback (before the feed's first
 * successful fetch, or a deliberate owner override), and neither number is
 * ever blended. Separate file from use-gold-price.test.ts (which only tests
 * the pure `toGoldGrams` math) because this one needs the full
 * useSession/apiFetch mock chain.
 */
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseSessionAuth = jest.fn();
jest.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { useGoldPrice } from "./use-gold-price";

const FG = "fg-1";

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: "test-token", familyGroupId: FG },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
});

function mockRoutes(routes: {
  antam?: unknown;
  manual?: unknown;
  mine?: unknown;
}) {
  mockApiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/gold-price/antam")) {
      return Promise.resolve(
        routes.antam ?? {
          pricePerKgIdr: null,
          source: null,
          fetchedAt: null,
          stale: false,
        },
      );
    }
    if (path.endsWith("/gold-price")) {
      return Promise.resolve(
        routes.manual ?? { pricePerGram: null, updatedAt: null },
      );
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve(routes.mine ?? [{ id: FG, myRole: "owner" }]);
    }
    return Promise.resolve(null);
  });
}

describe("useGoldPrice — B9 source selection", () => {
  it("prefers the live Antam feed over the manual entry when both are set", async () => {
    mockRoutes({
      antam: {
        pricePerKgIdr: "2537600000",
        source: "emasantam",
        fetchedAt: "2026-09-28T08:00:00.000Z",
        stale: false,
      },
      manual: {
        pricePerGram: "2000000",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const { result } = renderHook(() => useGoldPrice(), { wrapper });

    await waitFor(() => expect(result.current.hasPrice).toBe(true));
    expect(result.current.isAntamPrice).toBe(true);
    expect(result.current.pricePerGram).toBe(2_537_600_000 / 1000);
    expect(result.current.updatedAt).toBe("2026-09-28T08:00:00.000Z");
  });

  it("falls back to the manual price when the Antam feed has nothing cached yet", async () => {
    mockRoutes({
      antam: {
        pricePerKgIdr: null,
        source: null,
        fetchedAt: null,
        stale: false,
      },
      manual: {
        pricePerGram: "2000000",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const { result } = renderHook(() => useGoldPrice(), { wrapper });

    await waitFor(() => expect(result.current.hasPrice).toBe(true));
    expect(result.current.isAntamPrice).toBe(false);
    expect(result.current.pricePerGram).toBe(2_000_000);
    expect(result.current.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("has no price (asks for manual entry) when neither source has one", async () => {
    mockRoutes({});

    const { result } = renderHook(() => useGoldPrice(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasPrice).toBe(false);
    expect(result.current.pricePerGram).toBeNull();
  });

  it("surfaces the feed's stale flag when it fell back to a retained value", async () => {
    mockRoutes({
      antam: {
        pricePerKgIdr: "2500000000",
        source: "emasantam",
        fetchedAt: "2026-09-20T08:00:00.000Z",
        stale: true,
      },
    });

    const { result } = renderHook(() => useGoldPrice(), { wrapper });

    await waitFor(() => expect(result.current.hasPrice).toBe(true));
    expect(result.current.antamStale).toBe(true);
  });
});
