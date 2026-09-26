import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "../../../i18n/id";

import { KprFloatingRatesPanel } from "./kpr-floating-rates-panel";

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
// DateField's calendar popover is covered by its own tests; a plain input keeps this spec about the panel.
jest.mock("../../../components/wm", () => ({
  DateField: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const k = idDict.liabilitas.kpr;
const PATH = "/family-groups/fg-1/liabilities/liab-1/floating-rates";
const RATE = {
  id: "fr-1",
  effectiveDate: "2031-01-15",
  ratePercent: "9.75",
  effectivePeriod: 61,
  note: null,
  createdAt: "2031-01-10T00:00:00.000Z",
};

function renderPanel() {
  const onChanged = jest.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <KprFloatingRatesPanel
        familyGroupId="fg-1"
        liabilityId="liab-1"
        token="t"
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  );
  return onChanged;
}

describe("KprFloatingRatesPanel (revisi K)", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("lists recorded changes with the installment each one starts at", async () => {
    mockApiFetch.mockResolvedValue([RATE]);
    renderPanel();

    expect(await screen.findByText("9.75%")).toBeInTheDocument();
    expect(screen.getByText(/berlaku dari cicilan ke-61/)).toBeInTheDocument();
  });

  it("records a change: POSTs the date and a dot-decimal rate, then refreshes", async () => {
    mockApiFetch.mockImplementation(
      (_url: string, opts?: { method?: string }) =>
        Promise.resolve(opts?.method === "POST" ? RATE : []),
    );
    const onChanged = renderPanel();
    const user = userEvent.setup();

    expect(await screen.findByText(k.historyEmpty)).toBeInTheDocument();
    await user.type(screen.getByLabelText(k.historyDateLabel), "2031-01-15");
    await user.type(screen.getByLabelText(k.historyRateLabel), "9,75");
    await user.click(screen.getByRole("button", { name: k.historyAddButton }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      PATH,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          effectiveDate: "2031-01-15",
          ratePercent: "9.75",
        }),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith(k.historySaved);
  });

  it("shows the server's 409 message instead of a generic error", async () => {
    const message =
      "Sudah ada perubahan bunga pada tanggal ini — hapus dulu yang lama";
    mockApiFetch.mockImplementation(
      (_url: string, opts?: { method?: string }) =>
        opts?.method === "POST"
          ? Promise.reject({ status: 409, message })
          : Promise.resolve([]),
    );
    renderPanel();
    const user = userEvent.setup();

    await screen.findByText(k.historyEmpty);
    await user.type(screen.getByLabelText(k.historyDateLabel), "2031-01-15");
    await user.type(screen.getByLabelText(k.historyRateLabel), "9.75");
    await user.click(screen.getByRole("button", { name: k.historyAddButton }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
  });

  it("deletes a change by id", async () => {
    mockApiFetch.mockImplementation(
      (_url: string, opts?: { method?: string }) =>
        Promise.resolve(opts?.method === "DELETE" ? undefined : [RATE]),
    );
    const onChanged = renderPanel();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: `${k.historyDeleteButton} 2031-01-15`,
      }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      `${PATH}/fr-1`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
