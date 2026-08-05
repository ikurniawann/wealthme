/**
 * EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — ForcePasswordChangeGuard wiring
 * tests. Verifies the frontend UX half of the forced-first-login-password-
 * change flow: it reads GET /auth/password-status and redirects into
 * /ubah-password-wajib when mustChangePassword is true, and is a genuine
 * no-op otherwise (mirrors the backend guard's adversarial coverage in
 * apps/api/src/common/guards/force-password-change.guard.spec.ts).
 *
 * review-qa FIX 1 (HIGH) — the original 3 tests only asserted that
 * `router.replace` was eventually called, which passes even if `children`
 * (the (app) shell/chrome) painted for a frame first. The two tests below
 * assert `children` are NEVER present in the DOM during (a) the initial
 * pending check and (b) after the query resolves `true`, closing that gap.
 */

import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const mockUseSession = jest.fn();
jest.mock("../../lib/auth-compat", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockApiFetch = jest.fn();
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { ForcePasswordChangeGuard } from "./force-password-change-guard";

function renderGuard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ForcePasswordChangeGuard>
        <div>protected content</div>
      </ForcePasswordChangeGuard>
    </QueryClientProvider>,
  );
}

describe("ForcePasswordChangeGuard", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockApiFetch.mockClear();
  });

  it("does not query or redirect while unauthenticated", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    renderGuard();

    await new Promise((r) => setTimeout(r, 0));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("is a genuine no-op for a normal account (mustChangePassword: false) — renders children, never redirects", async () => {
    mockUseSession.mockReturnValue({
      data: { accessToken: "tok-1", userId: "u-1" },
      status: "authenticated",
    });
    mockApiFetch.mockResolvedValue({ mustChangePassword: false });

    const { findByText } = renderGuard();

    await findByText("protected content");
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/auth/password-status",
      expect.objectContaining({ token: "tok-1" }),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /ubah-password-wajib when mustChangePassword is true", async () => {
    mockUseSession.mockReturnValue({
      data: { accessToken: "tok-2", userId: "u-2" },
      status: "authenticated",
    });
    mockApiFetch.mockResolvedValue({ mustChangePassword: true });

    renderGuard();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/ubah-password-wajib"),
    );
  });

  it("never renders children during the initial pending check (before the query resolves)", async () => {
    mockUseSession.mockReturnValue({
      data: { accessToken: "tok-3", userId: "u-3" },
      status: "authenticated",
    });
    // Never resolves within this test — simulates the in-flight window.
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    const { queryByText } = renderGuard();

    // Give React Query a tick to enter the pending/fetching state without
    // ever resolving — this is the exact window a pre-fix render would leak
    // `children` into the DOM for.
    await new Promise((r) => setTimeout(r, 0));
    expect(queryByText("protected content")).not.toBeInTheDocument();
  });

  it("never renders children once mustChangePassword resolves true, even before the redirect completes", async () => {
    mockUseSession.mockReturnValue({
      data: { accessToken: "tok-4", userId: "u-4" },
      status: "authenticated",
    });
    mockApiFetch.mockResolvedValue({ mustChangePassword: true });

    const { queryByText } = renderGuard();

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));
    // Assert absence immediately after the query resolves, independent of
    // whether/when router.replace has been actioned by the (mocked) router.
    expect(queryByText("protected content")).not.toBeInTheDocument();
  });
});
