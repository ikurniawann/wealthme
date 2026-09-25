import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReferenceItemDto } from "@wealthme/contracts";

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

import {
  referenceItemsQueryKey,
  useReferenceItems,
} from "./use-reference-items";

const FG = "fg-1";

function item(
  id: string,
  group: ReferenceItemDto["group"],
  label: string,
): ReferenceItemDto {
  return {
    id,
    familyGroupId: FG,
    group,
    label,
    sortOrder: 0,
    isSystem: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

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

describe("useReferenceItems", () => {
  it("fetches the family's items once and narrows to the requested group", async () => {
    mockApiFetch.mockResolvedValue([
      item("b1", "bank", "BCA"),
      item("e1", "ewallet", "GoPay"),
      item("b2", "bank", "Bank Tes MD"),
    ]);

    const { result } = renderHook(() => useReferenceItems("bank"), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.items.map((i) => i.label)).toEqual([
        "BCA",
        "Bank Tes MD",
      ]),
    );
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FG}/reference-items`,
      expect.objectContaining({ token: "test-token" }),
    );
  });

  it("returns every group when no group is given", async () => {
    mockApiFetch.mockResolvedValue([
      item("b1", "bank", "BCA"),
      item("l1", "lembaga", "BAZNAS"),
    ]);

    const { result } = renderHook(() => useReferenceItems(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(
      () => useReferenceItems("bank", { enabled: false }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("treats a non-array response as no items instead of crashing", async () => {
    mockApiFetch.mockResolvedValue({});

    const { result } = renderHook(() => useReferenceItems("bank"), {
      wrapper,
    });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("refetches when the shared key is invalidated (Master Data add reaches every form)", async () => {
    mockApiFetch
      .mockResolvedValueOnce([item("b1", "bank", "BCA")])
      .mockResolvedValueOnce([
        item("b1", "bank", "BCA"),
        item("b2", "bank", "Bank Tes MD"),
      ]);

    const { result } = renderHook(() => useReferenceItems("bank"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: referenceItemsQueryKey(FG),
      });
    });

    await waitFor(() =>
      expect(result.current.items.map((i) => i.label)).toEqual([
        "BCA",
        "Bank Tes MD",
      ]),
    );
  });

  it("keys the cache per family group", () => {
    expect(referenceItemsQueryKey(FG)).toEqual(["reference-items", FG]);
  });
});
