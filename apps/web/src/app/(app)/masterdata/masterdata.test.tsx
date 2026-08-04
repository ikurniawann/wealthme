/**
 * EPIC-022 A5 — "deleting a category silently destroys budgets and
 * allow-lists". The API now rejects with a 409 naming exactly which
 * budgets/allowances are attached (categories.service.spec.ts); this locks
 * in the UI half: /masterdata must surface that real message instead of a
 * generic "gagal menghapus kategori" toast.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CategoryDto } from "@wealthme/contracts";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

// MasterDataPage calls useRouter() (next/navigation) — not present without a
// real Next.js App Router, so it must be mocked in a component test.
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// jsdom has no PointerEvent — Base UI's Dialog primitives read pointer-event
// fields internally, so the ConfirmDeleteDialog needs this polyfilled (same
// fix as dana/dana.test.tsx).
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

import MasterDataPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function buildCategory(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return {
    id: "cat-1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Belanja",
    kind: "expense",
    color: null,
    icon: "🛒",
    isPrivate: false,
    coaAccountId: "coa-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MasterDataPage — category delete surfaces the real server message (EPIC-022 A5)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("surfaces the API's 409 message instead of the generic delete-failed toast", async () => {
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/coa-accounts")) return Promise.resolve([]);
      if (options?.method === "DELETE") {
        return Promise.reject({
          status: 409,
          message:
            "Kategori ini dipakai 2 anggaran. Hapus atau ubah dulu sebelum menghapus kategori ini.",
        });
      }
      return Promise.resolve([buildCategory()]);
    });
    const user = userEvent.setup();
    render(<MasterDataPage />);

    // The category row is "🛒 Belanja" as one text run (icon + space + name
    // in the same <span>) — match by substring, not an exact string.
    await screen.findByText(/Belanja/);
    await user.click(screen.getByRole("button", { name: /Hapus Belanja/i }));
    await user.click(await screen.findByRole("button", { name: "Ya, Hapus" }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Kategori ini dipakai 2 anggaran. Hapus atau ubah dulu sebelum menghapus kategori ini.",
    );
  });
});
