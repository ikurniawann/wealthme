import { render, screen, within } from "@testing-library/react";
import type { CoaMatrixDto } from "@wealthme/contracts";

// Every COA amount must follow the viewer's display currency through
// useMoney(), never a hardcoded "Rp ... jt". The preference hook is mocked
// the way laporan-balance.test.tsx does it, with a switchable currency.
jest.mock("../../../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
  },
}));

let mockPreference = {
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  rate: 1,
  formatMoney: (v: number) => String(v),
};
jest.mock("../../../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => mockPreference,
}));
jest.mock("../../../../../hooks/use-my-access", () => ({
  useBalancesHidden: () => false,
}));

import { DisplayCurrencyProvider } from "../../../../../hooks/use-money";
import { setLocale } from "../../../../../hooks/use-locale";
import { CoaSection } from "./coa-section";

const MATRIX: CoaMatrixDto = {
  coaAccountId: "acc-1",
  year: 2026,
  total: 8_000_000,
  cells: {
    1: { 5: [{ txId: "t1", amount: 8_000_000, description: "Gaji" }] },
  },
};

function renderSection() {
  return render(
    <DisplayCurrencyProvider>
      <CoaSection
        coaAccounts={[{ id: "acc-1", code: "10001", name: "Gaji" }]}
        coaAccountId="acc-1"
        onCoaAccountIdChange={() => {}}
        year={2026}
        onYearChange={() => {}}
        matrix={MATRIX}
      />
    </DisplayCurrencyProvider>,
  );
}

function janTotalCell(): HTMLElement {
  const totalRow = screen.getByRole("rowheader", { name: "TOTAL" })
    .parentElement as HTMLElement;
  return within(totalRow).getAllByRole("cell")[0];
}

describe("CoaSection — display currency", () => {
  beforeEach(() => setLocale("id"));

  it("renders compact Rupiah for an IDR viewer", () => {
    renderSection();

    expect(janTotalCell()).toHaveTextContent(/Rp\s8 jt/);
    expect(
      screen.getByRole("link", { name: "Lihat transaksi 5 Januari 2026" }),
    ).toHaveTextContent(/Rp\s8 jt/);
  });

  it("switches cells and the TOTAL row to the converted currency", () => {
    mockPreference = {
      currency: "USD",
      isIndicative: true,
      isReady: true,
      rate: 1 / 16_000,
      formatMoney: (v: number) => `US$${(v / 16_000).toFixed(2)}`,
    };
    renderSection();

    expect(janTotalCell()).toHaveTextContent("US$500.00");
    expect(janTotalCell()).not.toHaveTextContent("jt");
    expect(
      screen.getByRole("link", { name: "Lihat transaksi 5 Januari 2026" }),
    ).toHaveTextContent("US$500.00");
  });
});
