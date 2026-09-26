import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TEST_FX_RATES } from "./fx-test-rates";
import { MoneyInput } from "./money-input";
import { useMoneyField, type MoneyField } from "./use-money-field";

const mockFx = jest.fn();
jest.mock("./use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => mockFx(enabled),
}));
const mockPref = jest.fn();
// Relative path (not the "@/" alias): jest.mock's own resolver does not see
// the tsconfig alias that SWC rewrites for ordinary imports (unlike the
// source file's "@/hooks/use-currency-preference" import), but both specifiers
// resolve to the same file on disk, so the mock still applies.
jest.mock("../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => mockPref(),
}));

let latest: MoneyField | null = null;
function Harness({ allowNegative }: { allowNegative?: boolean }) {
  const field = useMoneyField({ allowNegative });
  // eslint-disable-next-line react-hooks/globals -- test-only harness capturing hook state to assert on.
  latest = field;
  return <MoneyInput field={field} id="amt" ariaLabel="Jumlah" />;
}

const IDR_PREF = {
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  formatMoney: (v: number) => `Rp ${v}`,
};
const USD_PREF = {
  currency: "USD",
  isIndicative: true,
  isReady: true,
  formatMoney: (v: number) => `$ ${(v / 17913.899851).toFixed(2)}`,
};

function EditHarness() {
  const field = useMoneyField({ initialRaw: "1791390" });
  // eslint-disable-next-line react-hooks/globals -- test-only harness capturing hook state to assert on.
  latest = field;
  return <MoneyInput field={field} id="amt" ariaLabel="Jumlah" />;
}

describe("MoneyInput — revisi I", () => {
  beforeEach(() => {
    latest = null;
    // Call history persists across tests unless cleared explicitly (no
    // global clearMocks in jest.config.ts): "not.toHaveBeenCalledWith(true)"
    // below needs a clean slate, not just a fresh mockImplementation.
    jest.clearAllMocks();
    mockFx.mockImplementation((enabled: boolean) => ({
      data: enabled ? TEST_FX_RATES : undefined,
      isError: false,
    }));
    mockPref.mockReturnValue(IDR_PREF);
  });

  it("defaults a create form to the display currency (USD)", async () => {
    mockPref.mockReturnValue(USD_PREF);
    render(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "100");
    expect(latest?.resolved.fx).toEqual({ currency: "USD", amount: "100" });
  });

  it("edit prefill opens on IDR even for a USD-display user", () => {
    mockPref.mockReturnValue(USD_PREF);
    render(<EditHarness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("1.791.390");
    expect(latest?.resolved.fx).toBeNull();
  });

  it("isEdit pins IDR even when the stored value is empty", () => {
    mockPref.mockReturnValue(USD_PREF);
    function EmptyEdit() {
      const field = useMoneyField({ isEdit: true });
      return <MoneyInput field={field} id="amt" ariaLabel="Jumlah" />;
    }
    render(<EmptyEdit />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
  });

  it("a late-loading profile does not flip a field the user already typed in", async () => {
    const { rerender } = render(<Harness />);
    await userEvent.type(screen.getByLabelText("Jumlah"), "250000");
    mockPref.mockReturnValue(USD_PREF);
    rerender(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
    expect(latest?.resolved.fx).toBeNull();
  });

  it("an untouched empty field follows a late-loading profile", () => {
    const { rerender } = render(<Harness />);
    mockPref.mockReturnValue(USD_PREF);
    rerender(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("USD");
  });

  it("an unsupported profile currency falls back to IDR", () => {
    mockPref.mockReturnValue({ ...USD_PREF, currency: "GBP" });
    render(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
  });

  it("defaults to IDR for an IDR-display user, groups digits like before, and shows no rate line", async () => {
    render(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
    await userEvent.type(screen.getByLabelText("Jumlah"), "1250000");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("1.250.000");
    expect(screen.queryByText(/ECB/)).toBeNull();
    expect(latest?.resolved.fx).toBeNull();
    expect(mockFx).not.toHaveBeenCalledWith(true);
  });

  it("USD: shows the IDR preview, the ECB rate line and the server note", async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "1250,50");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("1.250,50");
    expect(screen.getByText("≈ Rp 22.401.332")).toBeInTheDocument();
    expect(
      screen.getByText("1 USD = Rp 17.913,90 · ECB 25 Sep 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nilai rupiah final dihitung server saat disimpan."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Disimpan sebagai IDR, ditampilkan dalam IDR."),
    ).toBeInTheDocument();
    expect(latest?.resolved.fx).toEqual({ currency: "USD", amount: "1250.50" });
  });

  it("labels a stale rate", async () => {
    mockFx.mockReturnValue({
      data: { ...TEST_FX_RATES, stale: true, rateDate: "2026-09-24" },
      isError: false,
    });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "SGD");
    expect(
      screen.getByText(/Kurs terakhir tersedia 24 Sep 2026/),
    ).toBeInTheDocument();
  });

  it("labels an indicative rate", async () => {
    mockFx.mockReturnValue({
      data: { ...TEST_FX_RATES, source: "indicative", stale: true },
      isError: false,
    });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "EUR");
    expect(screen.getByText(/Kurs indikatif/)).toBeInTheDocument();
  });

  it("while the rate is loading, shows it and marks the value pending", async () => {
    mockFx.mockReturnValue({ data: undefined, isError: false });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "5");
    expect(screen.getByText("Memuat kurs…")).toBeInTheDocument();
    expect(latest?.resolved.isPending).toBe(true);
  });

  it("shows an error when the rate cannot be loaded", async () => {
    mockFx.mockReturnValue({ data: undefined, isError: true });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    expect(screen.getByRole("alert")).toHaveTextContent("Kurs tidak tersedia");
  });

  it("switching to JPY reformats the typed value without decimals", async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "1500,5");
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "JPY");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("15.005");
  });

  it("allowNegative keeps a leading minus in a foreign currency", async () => {
    render(<Harness allowNegative />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "-20");
    expect(latest?.resolved.idrPreview).toBe(-BigInt(358_278));
  });

  it("an IDR amount (edit prefill) shows the display-currency hint for a USD-display user", () => {
    mockPref.mockReturnValue(USD_PREF);
    render(<EditHarness />);
    expect(
      screen.getByText("≈ $ 100.00 (mata uang tampilan)"),
    ).toBeInTheDocument();
  });
});
