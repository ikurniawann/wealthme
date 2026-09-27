import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "@/i18n/id";

import { ContributeDialog } from "./contribute-dialog";

import type { GoalDto } from "@wealthme/contracts";

const mockApiFetch = jest.fn();
jest.mock("../../../../lib/api-client", () => ({
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));
jest.mock("../../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../../../../components/money/fx-test-rates")
          .TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
jest.mock("../../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

// jsdom has no PointerEvent — Base UI's Dialog reads pointer-event fields.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

const goal = {
  id: "g-1",
  name: "Liburan",
  sourceAccountId: null,
} as unknown as GoalDto;

function renderDialog() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ContributeDialog
        goal={goal}
        accounts={[]}
        familyGroupId="fg-1"
        token="tok"
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("ContributeDialog — revisi I", () => {
  beforeEach(() =>
    mockApiFetch
      .mockReset()
      .mockResolvedValue({ contribution: { id: "gc-1" }, goal }),
  );

  it("IDR sends the same digit string as before and no fxInputs", async () => {
    renderDialog();
    await userEvent.type(
      screen.getByLabelText(idDict.tujuan.contributeAmountLabel),
      "250000",
    );
    await userEvent.click(
      screen.getByRole("button", { name: idDict.tujuan.contributeSubmit }),
    );
    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
    expect(body.amount).toBe("250000");
    expect(body).not.toHaveProperty("fxInputs");
  });

  it("USD sends the preview + fxInputs", async () => {
    renderDialog();
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(
      screen.getByLabelText(idDict.tujuan.contributeAmountLabel),
      "10",
    );
    await userEvent.click(
      screen.getByRole("button", { name: idDict.tujuan.contributeSubmit }),
    );
    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toMatchObject({
      amount: "179139",
      fxInputs: [{ field: "amount", currency: "USD", amount: "10" }],
    });
  });
});
