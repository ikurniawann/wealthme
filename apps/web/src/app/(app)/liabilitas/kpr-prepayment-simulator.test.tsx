import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "../../../i18n/id";

import { KprPrepaymentSimulator } from "./kpr-prepayment-simulator";

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const k = idDict.liabilitas.kpr;
const BASE_URL = "/family-groups/fg-1/liabilities/liab-1/prepayment-preview?";
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

function renderSimulator() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <KprPrepaymentSimulator
        familyGroupId="fg-1"
        liabilityId="liab-1"
        token="t"
      />
    </QueryClientProvider>,
  );
}

describe("KprPrepaymentSimulator (revisi K)", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("says it records nothing, defaults the penalty to the labelled 1% example, and fetches only on submit", () => {
    renderSimulator();

    expect(screen.getByText(k.prepaySimulationNote)).toBeInTheDocument();
    expect(screen.getByLabelText(k.prepayPenaltyLabel)).toHaveValue("1.00");
    expect(screen.getByText(k.prepayPenaltyHint)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("reduce installment: sends mode, penalty and the digits of the amount; shows the server's numbers", async () => {
    mockApiFetch.mockResolvedValue(PREVIEW);
    renderSimulator();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("radio", { name: k.prepayModes.reduce_installment }),
    );
    await user.type(screen.getByLabelText(k.prepayAmountLabel), "100000000");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_URL}mode=reduce_installment&penaltyPercent=1.00&amount=100000000`,
        expect.objectContaining({ token: "t" }),
      ),
    );
    expect(await screen.findByText(/3\.409\.791/)).toBeInTheDocument();
    expect(screen.getByText(/104\.587\.451/)).toBeInTheDocument();
    expect(screen.getByText(k.prepayEstimateNote)).toBeInTheDocument();
  });

  it("full payoff sends no amount", async () => {
    mockApiFetch.mockResolvedValue({ ...PREVIEW, mode: "full" });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: k.prepayModes.full }));
    expect(
      screen.queryByLabelText(k.prepayAmountLabel),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_URL}mode=full&penaltyPercent=1.00`,
        expect.anything(),
      ),
    );
  });

  it("shows the server's 400 message", async () => {
    mockApiFetch.mockRejectedValue({
      status: 400,
      message:
        "Jumlah pelunasan harus lebih dari 0 dan tidak melebihi sisa pokok",
    });
    renderSimulator();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(k.prepayAmountLabel), "999999999999");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    expect(
      await screen.findByText(/tidak melebihi sisa pokok/),
    ).toBeInTheDocument();
  });
});
