import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "../../../i18n/id";

import { KprPrepaymentSimulator } from "./kpr-prepayment-simulator";

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock("../../../hooks/use-my-access", () => ({
  useMyAccess: () => ({ data: undefined, isLoading: false }),
  useBalancesHidden: () => false,
}));

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// Batch 1 (polish-j) — the amount field grew a currency picker
// (useMoneyField/MoneyInput). These two hooks are mocked exactly like
// donation.test.tsx's precedent so the suite controls the FX snapshot
// deterministically instead of hitting the real /fx/rates + /auth/profile
// endpoints through mockApiFetch.
const mockUseFxSnapshot = jest.fn((enabled: boolean) => ({
  data: enabled
    ? jest.requireActual("../../../components/money/fx-test-rates")
        .TEST_FX_RATES
    : undefined,
  isError: false,
}));
jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => mockUseFxSnapshot(enabled),
}));
jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

const k = idDict.liabilitas.kpr;
const BASE = "/family-groups/fg-1/liabilities/liab-1";
const PREVIEW_URL = `${BASE}/prepayment-preview?`;
const ACCOUNTS = [{ id: "acc-1", name: "BCA Tabungan", institution: "BCA" }];
const PREVIEW = {
  liabilityId: "liab-1",
  mode: "reduce_installment",
  prepaidPrincipal: "100000000",
  penaltyPercent: "1.00",
  penalty: "1000000",
  cashOutNow: "101000000",
  installmentBefore: "4546388",
  installmentAfter: "3409791",
  remainingMonthsBefore: 180,
  remainingMonthsAfter: 180,
  totalInterestBefore: "418349734",
  totalInterestAfter: "313762283",
  interestSaved: "104587451",
  netSaving: "103587451",
  assumesCurrentFloatingRate: true,
};

function routeApi(opts: {
  preview?: unknown;
  previewError?: unknown;
  record?: () => Promise<unknown>;
}) {
  mockApiFetch.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/family-groups/fg-1/accounts") {
      return Promise.resolve(ACCOUNTS);
    }
    if (url.startsWith(PREVIEW_URL)) {
      return opts.previewError
        ? Promise.reject(opts.previewError)
        : Promise.resolve(opts.preview);
    }
    if (url === `${BASE}/prepay` && init?.method === "POST") {
      return opts.record ? opts.record() : Promise.resolve({ replayed: false });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

function renderSimulator() {
  const onRecorded = jest.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <KprPrepaymentSimulator
        familyGroupId="fg-1"
        liabilityId="liab-1"
        token="t"
        onRecorded={onRecorded}
        makeIdempotencyKey={() => "key-1"}
      />
    </QueryClientProvider>,
  );
  return onRecorded;
}

async function simulateReduceInstallment(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(
    screen.getByRole("radio", { name: k.prepayModes.reduce_installment }),
  );
  await user.type(screen.getByLabelText(k.prepayAmountLabel), "100000000");
  await user.click(screen.getByRole("button", { name: k.prepaySubmit }));
  await screen.findByText(/3\.409\.791/);
}

async function chooseAccount(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "BCA Tabungan · BCA" });
  await user.selectOptions(
    screen.getByLabelText(k.recordAccountLabel),
    "acc-1",
  );
}

function prepayPosts() {
  return mockApiFetch.mock.calls.filter(
    ([url, init]) => url === `${BASE}/prepay` && init?.method === "POST",
  );
}

describe("KprPrepaymentSimulator (revisi K)", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    mockUseFxSnapshot.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? jest.requireActual("../../../components/money/fx-test-rates")
            .TEST_FX_RATES
        : undefined,
      isError: false,
    }));
  });

  it("labels the numbers a simulation, defaults the penalty to the 1% example, and fetches nothing up front", () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();

    expect(screen.getByText(k.prepaySimulationNote)).toBeInTheDocument();
    expect(screen.getByLabelText(k.prepayPenaltyLabel)).toHaveValue("1.00");
    expect(screen.getByText(k.prepayPenaltyHint)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("reduce installment: sends mode, penalty and the amount digits; shows the server's numbers", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);

    expect(mockApiFetch).toHaveBeenCalledWith(
      `${PREVIEW_URL}mode=reduce_installment&penaltyPercent=1.00&amount=100000000`,
      expect.objectContaining({ token: "t" }),
    );
    expect(screen.getByText(/104\.587\.451/)).toBeInTheDocument();
    expect(screen.getByText(k.prepayEstimateNote)).toBeInTheDocument();
  });

  it("M2: reduce-tenor shows a note that the installment still rises at the next rate period, when the plan runs into one", async () => {
    routeApi({
      preview: { ...PREVIEW, mode: "reduce_tenor", remainingMonthsAfter: 102 },
    });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("radio", { name: k.prepayModes.reduce_tenor }),
    );
    await user.type(screen.getByLabelText(k.prepayAmountLabel), "100000000");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    expect(
      await screen.findByText(k.prepayReduceTenorNextTierNote),
    ).toBeInTheDocument();
  });

  it("M2: no next-tier note for reduce-tenor when the rate plan never runs into a later period", async () => {
    routeApi({
      preview: {
        ...PREVIEW,
        mode: "reduce_tenor",
        remainingMonthsAfter: 102,
        assumesCurrentFloatingRate: false,
      },
    });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("radio", { name: k.prepayModes.reduce_tenor }),
    );
    await user.type(screen.getByLabelText(k.prepayAmountLabel), "100000000");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    await screen.findByText(/104\.587\.451/);
    expect(
      screen.queryByText(k.prepayReduceTenorNextTierNote),
    ).not.toBeInTheDocument();
  });

  it("M2: no next-tier note for reduce-installment, even when the plan runs into a later period", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);

    expect(
      screen.queryByText(k.prepayReduceTenorNextTierNote),
    ).not.toBeInTheDocument();
  });

  it("full payoff sends no amount", async () => {
    routeApi({ preview: { ...PREVIEW, mode: "full" } });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: k.prepayModes.full }));
    expect(
      screen.queryByLabelText(k.prepayAmountLabel),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${PREVIEW_URL}mode=full&penaltyPercent=1.00`,
        expect.anything(),
      ),
    );
  });

  it("shows the server's 400 message for a bad simulation", async () => {
    routeApi({
      previewError: {
        status: 400,
        message:
          "Jumlah pelunasan harus lebih dari 0 dan tidak melebihi sisa pokok",
      },
    });
    renderSimulator();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(k.prepayAmountLabel), "999999999999");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    expect(
      await screen.findByText(/tidak melebihi sisa pokok/),
    ).toBeInTheDocument();
  });

  it("Catat pelunasan needs a source account, then a confirmation stating the exact debit", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);

    expect(screen.getByRole("button", { name: k.recordButton })).toBeDisabled();
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Rp 101\.000\.000/);
    expect(prepayPosts()).toHaveLength(0);
  });

  it("records the simulated request exactly, with its idempotency key, then refreshes", async () => {
    routeApi({ preview: PREVIEW });
    const onRecorded = renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    await user.click(
      screen.getByRole("button", { name: k.recordConfirmButton }),
    );

    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    const [, init] = prepayPosts()[0] ?? [];
    expect(JSON.parse(init.body)).toEqual({
      mode: "reduce_installment",
      penaltyPercent: "1.00",
      amount: "100000000",
      sourceAccountId: "acc-1",
      idempotencyKey: "key-1",
    });
    expect(toastSuccess).toHaveBeenCalledWith(k.recordSaved);
  });

  it("a double click posts once", async () => {
    let settle: (value: unknown) => void = () => undefined;
    routeApi({
      preview: PREVIEW,
      record: () => new Promise((resolve) => (settle = resolve)),
    });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    const confirm = screen.getByRole("button", { name: k.recordConfirmButton });
    await user.dblClick(confirm);

    expect(prepayPosts()).toHaveLength(1);
    settle({ replayed: false });
  });

  it("M1: changing the amount after simulating clears the stale result so 'Catat pelunasan' can't record it", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await user.type(screen.getByLabelText(k.prepayAmountLabel), "1");

    expect(screen.queryByText(/3\.409\.791/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: k.recordButton }),
    ).not.toBeInTheDocument();
  });

  it("M1: changing the mode after simulating clears the stale result", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await user.click(
      screen.getByRole("radio", { name: k.prepayModes.reduce_tenor }),
    );

    expect(screen.queryByText(/3\.409\.791/)).not.toBeInTheDocument();
  });

  it("M1: changing the penalty after simulating clears an open confirmation, never recording the old request", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(k.prepayPenaltyLabel));
    await user.type(screen.getByLabelText(k.prepayPenaltyLabel), "2.00");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(prepayPosts()).toHaveLength(0);
  });

  it("a failed record keeps the simulation and shows the server's message", async () => {
    routeApi({
      preview: PREVIEW,
      record: () =>
        Promise.reject({
          status: 400,
          message:
            'Saldo rekening bank "BCA Tabungan" tidak mencukupi untuk transaksi ini.',
        }),
    });
    const onRecorded = renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    await user.click(
      screen.getByRole("button", { name: k.recordConfirmButton }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Saldo rekening bank "BCA Tabungan" tidak mencukupi untuk transaksi ini.',
      ),
    );
    expect(onRecorded).not.toHaveBeenCalled();
    expect(screen.getByText(/3\.409\.791/)).toBeInTheDocument();
  });

  it("batch 1 — the amount field has a currency picker; a EUR amount previews and records with the converted IDR amount + fxInputs", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("radio", { name: k.prepayModes.reduce_installment }),
    );
    await user.selectOptions(
      screen.getByLabelText(idDict.money.currencyLabel),
      "EUR",
    );
    await user.type(screen.getByLabelText(k.prepayAmountLabel), "75,50");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));
    await screen.findByText(/3\.409\.791/);

    expect(mockApiFetch).toHaveBeenCalledWith(
      `${PREVIEW_URL}mode=reduce_installment&penaltyPercent=1.00&amount=1542255`,
      expect.objectContaining({ token: "t" }),
    );

    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    await user.click(
      screen.getByRole("button", { name: k.recordConfirmButton }),
    );

    await waitFor(() => expect(prepayPosts()).toHaveLength(1));
    const [, init] = prepayPosts()[0] ?? [];
    expect(JSON.parse(init.body)).toEqual({
      mode: "reduce_installment",
      penaltyPercent: "1.00",
      amount: "1542255",
      fxInputs: [{ field: "amount", currency: "EUR", amount: "75.50" }],
      sourceAccountId: "acc-1",
      idempotencyKey: "key-1",
    });
  });

  it("batch 1 — an IDR amount posts no fxInputs key (unchanged behaviour)", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    await user.click(
      screen.getByRole("button", { name: k.recordConfirmButton }),
    );

    await waitFor(() => expect(prepayPosts()).toHaveLength(1));
    const [, init] = prepayPosts()[0] ?? [];
    expect(JSON.parse(init.body)).not.toHaveProperty("fxInputs");
  });

  it("batch 1 — the pending-request guard blocks Simulasikan while a foreign rate hasn't resolved yet", async () => {
    mockUseFxSnapshot.mockImplementation(() => ({
      data: undefined,
      isError: false,
    }));
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("radio", { name: k.prepayModes.reduce_installment }),
    );
    await user.selectOptions(
      screen.getByLabelText(idDict.money.currencyLabel),
      "USD",
    );
    await user.type(screen.getByLabelText(k.prepayAmountLabel), "10");

    const submit = screen.getByRole("button", { name: k.prepaySubmit });
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);

    expect(
      mockApiFetch.mock.calls.some(([url]) =>
        String(url).startsWith(PREVIEW_URL),
      ),
    ).toBe(false);
  });

  it("batch 1 — the prepayment radiogroup exposes aria-checked (not aria-selected), and the active item still gets the segmented active look", () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();

    const active = screen.getByRole("radio", {
      name: k.prepayModes.reduce_tenor,
    });
    expect(active).toHaveAttribute("aria-checked", "true");
    expect(active).not.toHaveAttribute("aria-selected");
    expect(active).toHaveClass("segmented__item");

    const inactive = screen.getByRole("radio", {
      name: k.prepayModes.full,
    });
    expect(inactive).toHaveAttribute("aria-checked", "false");
    expect(inactive).not.toHaveAttribute("aria-selected");
  });
});
