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
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
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
});
