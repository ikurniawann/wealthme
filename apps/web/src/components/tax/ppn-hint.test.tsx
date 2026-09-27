import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import type { PpnPreviewResultDto } from "@wealthme/contracts";

jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: undefined, isPending: false }),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { PpnHint } from "./ppn-hint";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderUi(ui: ReactElement) {
  return render(ui, { wrapper: Providers });
}

function buildResult(
  overrides: Partial<PpnPreviewResultDto> = {},
): PpnPreviewResultDto {
  return {
    priceExcludingPpn: "1000000",
    dpp: "1017857",
    ppn: "110000",
    totalWithPpn: "1110000",
    nominalBps: 1200,
    effectiveBps: 1100,
    rules: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
});

it("posts the PPN preview when opened and renders the PPN amount", async () => {
  mockApiFetch.mockResolvedValueOnce(buildResult());
  renderUi(<PpnHint amount="1110000" occurredAt="2026-09-26T03:00:00.000Z" />);
  const summary = screen.getByText("Info PPN");
  fireEvent.click(summary);
  expect(await screen.findByText("Rp 110.000")).toBeInTheDocument();
  expect(mockApiFetch).toHaveBeenCalledWith(
    "/calculators/ppn",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        date: "2026-09-26",
        amount: "1110000",
        luxury: false,
        priceIncludesPpn: true,
      }),
    }),
  );
});

it("re-posts with luxury: true when the toggle is ticked", async () => {
  mockApiFetch.mockResolvedValue(buildResult());
  renderUi(<PpnHint amount="1110000" occurredAt="2026-09-26T03:00:00.000Z" />);
  fireEvent.click(screen.getByText("Info PPN"));
  await screen.findByText("Rp 110.000");
  await userEvent.click(screen.getByLabelText("Barang mewah (PPnBM)"));
  expect(mockApiFetch).toHaveBeenCalledWith(
    "/calculators/ppn",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        date: "2026-09-26",
        amount: "1110000",
        luxury: true,
        priceIncludesPpn: true,
      }),
    }),
  );
});

it("strips a decimal amount to its digit string before sending", async () => {
  mockApiFetch.mockResolvedValueOnce(buildResult());
  renderUi(
    <PpnHint amount="150000.00" occurredAt="2026-09-26T03:00:00.000Z" />,
  );
  fireEvent.click(screen.getByText("Info PPN"));
  await screen.findByText("Rp 110.000");
  expect(mockApiFetch).toHaveBeenCalledWith(
    "/calculators/ppn",
    expect.objectContaining({
      body: JSON.stringify({
        date: "2026-09-26",
        amount: "150000",
        luxury: false,
        priceIncludesPpn: true,
      }),
    }),
  );
});

it("converts occurredAt to its WIB (UTC+7) calendar date", async () => {
  mockApiFetch.mockResolvedValueOnce(buildResult());
  renderUi(<PpnHint amount="100000" occurredAt="2025-07-31T17:30:00Z" />);
  fireEvent.click(screen.getByText("Info PPN"));
  await screen.findByText("Rp 110.000");
  expect(mockApiFetch).toHaveBeenCalledWith(
    "/calculators/ppn",
    expect.objectContaining({
      body: JSON.stringify({
        date: "2025-08-01",
        amount: "100000",
        luxury: false,
        priceIncludesPpn: true,
      }),
    }),
  );
});
