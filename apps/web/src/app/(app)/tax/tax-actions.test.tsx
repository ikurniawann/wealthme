/**
 * EPIC-016 Task G — /tax "Lapor SPT Tahunan" and "Unduh Ringkasan" actions.
 *
 * Both buttons previously only fired a toast implying a real external
 * action ("🌐 Membuka e-Filing DJP Online...", "📊 Membuat laporan
 * pajak...") with no actual behavior behind either.
 *
 * - "Lapor SPT Tahunan" would require a real integration with the Indonesian
 *   government's DJP e-Filing system, which is out of scope for this app
 *   (no real API access/credentials). It now shows an honest "coming soon"
 *   toast, matching the page's existing Dokumen Pajak upload disclosure.
 * - "Unduh Ringkasan" now triggers a real client-side download built from
 *   the tax data already loaded on the page (calculator estimate + saved
 *   TaxRecord history from GET /family-groups/:id/tax).
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom has no URL.createObjectURL/revokeObjectURL implementation.
const mockCreateObjectURL = jest.fn<string, [Blob]>(() => "blob:mock-url");
const mockRevokeObjectURL = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).createObjectURL = mockCreateObjectURL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).revokeObjectURL = mockRevokeObjectURL;

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: "tok-1", familyGroupId: "fg-1" },
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// `toast` is used both as a plain function (coming-soon disclosures) and
// with `.success`/`.error` (real mutation/download results) on this page.
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

import TaxPage from "./page";

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

const TAX_RECORDS = [
  {
    id: "rec-1",
    familyGroupId: "fg-1",
    taxYear: 2025,
    grossIncome: "100000000",
    ptkp: "54000000",
    zakatDeduction: "0",
    netTax: "2500000",
    sptStatus: "sudah_lapor",
    documentUrl: null,
    notes: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

describe("/tax action buttons (EPIC-016 Task G)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:mock-url");
    mockApiFetch.mockResolvedValue(TAX_RECORDS);
    queryClient.clear();
  });

  it('"Lapor SPT Tahunan" shows an honest coming-soon toast instead of implying a real DJP connection', async () => {
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const user = userEvent.setup();

    render(<TaxPage />);
    await user.click(screen.getByText("Lapor SPT Tahunan"));

    expect(toast).toHaveBeenCalledWith(
      "Integrasi e-Filing DJP belum tersedia — segera hadir.",
    );
    // Never claims a fake success or implies a real portal opened.
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith(
      expect.stringContaining("Membuka e-Filing"),
    );
  });

  it('"Unduh Ringkasan" triggers a real Blob download built from the tax data already on the page', async () => {
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    render(<TaxPage />);

    // Wait for the real tax-records fetch to resolve so the summary can
    // include the saved history, not just the empty calculator state.
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/family-groups/fg-1/tax", {
        token: "tok-1",
      });
    });

    await user.click(screen.getByText("Unduh Ringkasan"));

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = mockCreateObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toContain("text/plain");
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // A real success confirmation, not the old fake "Membuat laporan
    // pajak..." toast with no work behind it.
    expect(toast.success).toHaveBeenCalledWith(
      "📊 Ringkasan pajak berhasil diunduh.",
    );
    expect(toast).not.toHaveBeenCalledWith(
      expect.stringContaining("Membuat laporan"),
    );

    clickSpy.mockRestore();
  });

  it('disables "Unduh Ringkasan" while the tax-records query is still loading, so a fast click cannot download an incomplete summary', async () => {
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    // Never resolves during this test — simulates the fetch still being
    // in flight when the user clicks.
    mockApiFetch.mockImplementation(() => new Promise(() => {}));

    render(<TaxPage />);

    const downloadButton = screen
      .getByText("Unduh Ringkasan")
      .closest("button");
    expect(downloadButton).toBeDisabled();

    // A real user cannot click a disabled button; assert no download is
    // ever produced from the stray click attempt.
    if (downloadButton) await user.click(downloadButton);

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});
