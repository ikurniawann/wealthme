/**
 * EPIC-016 Task D — "Ekspor Data Saya" wiring.
 *
 * Previously toast-only (`toast("📤 Mengekspor data...")` with no real
 * request). Now calls the real GET /users/me/gdpr/export endpoint
 * (apps/api/src/gdpr/gdpr.service.ts, pre-existing but never wired to any
 * frontend control) and triggers a real JSON file download.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom has no URL.createObjectURL/revokeObjectURL implementation.
const mockCreateObjectURL = jest.fn(() => "blob:mock-url");
const mockRevokeObjectURL = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).createObjectURL = mockCreateObjectURL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).revokeObjectURL = mockRevokeObjectURL;

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { PrivasiBody } from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

describe("PrivasiBody — Ekspor Data Saya (EPIC-016 Task D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches the real GDPR export endpoint and triggers a real download, not a fake toast", async () => {
    const { toast } = jest.requireMock<{
      toast: { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    mockApiFetch.mockResolvedValue({
      exportedAt: "2026-07-24T00:00:00.000Z",
      user: { id: "u1", email: "a@b.com", name: "A" },
      accounts: [],
      transactions: [],
    });
    const user = userEvent.setup();

    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<PrivasiBody token="tok-1" />);

    await user.click(screen.getByText("Ekspor Data Saya"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/users/me/gdpr/export", {
        token: "tok-1",
      });
    });

    // Assert — a real Blob-backed download was triggered (not a toast-only
    // "Mengekspor data..." message with no request behind it).
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Data berhasil diunduh.");

    clickSpy.mockRestore();
  });

  it("shows an error toast (not a false success) when the export request fails", async () => {
    const { toast } = jest.requireMock<{
      toast: { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    mockApiFetch.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();

    render(<PrivasiBody token="tok-1" />);

    await user.click(screen.getByText("Ekspor Data Saya"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Gagal mengekspor data. Coba lagi.",
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });
});
