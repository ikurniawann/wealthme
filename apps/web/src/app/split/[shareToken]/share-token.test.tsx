/**
 * EPIC-023 Group F fix round (HIGH 6) — the public `/split/[shareToken]`
 * page had NO component tests despite being a public, unauthenticated
 * money-adjacent surface (claim flow, revoked/not-found states). Also
 * covers HIGH 5 (payout "never configured" vs. "configured but currently
 * unavailable") and LOW 11 (network error vs. link-not-found).
 *
 * Tests `SplitShareView` (the plain-props view), not the default-exported
 * `SplitBillSharePage` wrapper: that wrapper's only job is unwrapping
 * Next.js's `params` Promise via React's `use()`, which this repo's
 * Jest/jsdom setup cannot resolve — a render hangs on the Suspense
 * fallback forever (verified with a minimal repro using nothing but React
 * + Suspense + `use()`, no app code involved). `SplitShareView` is exactly
 * the same UI/logic with `shareToken` as a normal prop, so it's fully
 * testable without touching that limitation.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

import { SplitShareView } from "./page";

const SHARE_TOKEN = "share-budi";

const BASE_PARTICIPANT = {
  billTitle: "Makan di Sushi Tei",
  participantName: "Budi",
  amountOwed: "100000",
  currency: "IDR",
  status: "pending" as const,
  claimedAt: null,
  paidAt: null,
  payout: {
    accountName: "BCA Utama",
    accountInstitution: "BCA",
    accountMaskedNumber: "•••• 1234",
    instructions: null,
    configured: true,
  },
};

function renderPage() {
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
  return render(<SplitShareView shareToken={SHARE_TOKEN} />);
}

describe("SplitShareView (EPIC-023 F3/Group F)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("renders the participant's own share as a heading, with the payout destination (happy path)", async () => {
    mockApiFetch.mockResolvedValue(BASE_PARTICIPANT);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Makan di Sushi Tei" }),
    ).toBeInTheDocument();
    expect(screen.getByText("BCA Utama · BCA · •••• 1234")).toBeInTheDocument();
  });

  it("filing a claim calls the claim endpoint and shows the claimed notice", async () => {
    mockApiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") {
        return Promise.resolve({ ...BASE_PARTICIPANT, status: "claimed" });
      }
      return Promise.resolve(BASE_PARTICIPANT);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /saya sudah transfer/i }),
    );

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/split-bills/participant/${SHARE_TOKEN}/claim`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(
      await screen.findByText(/klaim terkirim\. menunggu pemilik/i),
    ).toBeInTheDocument();
  });

  it("shows an honest revoked notice (410), not a bare not-found", async () => {
    mockApiFetch.mockRejectedValue({ status: 410, message: "Gone" });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /link sudah dicabut/i }),
    ).toBeInTheDocument();
  });

  it("shows a not-found notice for an unknown link (404)", async () => {
    mockApiFetch.mockRejectedValue({ status: 404, message: "Not found" });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /link tidak ditemukan/i }),
    ).toBeInTheDocument();
  });

  it("distinguishes a network failure from a not-found link", async () => {
    // apiFetch's fetch() throws a bare TypeError on a network/DNS
    // failure — no `status` field at all, unlike a real HTTP error.
    mockApiFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /gagal memuat/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /link tidak ditemukan/i }),
    ).not.toBeInTheDocument();
  });

  it("shows 'currently unavailable' (not 'never configured') when the payout account was deleted", async () => {
    mockApiFetch.mockResolvedValue({
      ...BASE_PARTICIPANT,
      payout: {
        accountName: null,
        accountInstitution: null,
        accountMaskedNumber: null,
        instructions: null,
        configured: true,
      },
    });

    renderPage();

    expect(
      await screen.findByText(/sedang tidak tersedia/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/belum diatur oleh pemilik tagihan/i),
    ).not.toBeInTheDocument();
  });

  it("shows 'never configured' when the owner has not nominated a payout account", async () => {
    mockApiFetch.mockResolvedValue({
      ...BASE_PARTICIPANT,
      payout: {
        accountName: null,
        accountInstitution: null,
        accountMaskedNumber: null,
        instructions: null,
        configured: false,
      },
    });

    renderPage();

    expect(
      await screen.findByText(/belum diatur oleh pemilik tagihan/i),
    ).toBeInTheDocument();
  });
});
