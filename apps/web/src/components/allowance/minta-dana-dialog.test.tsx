import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "@/i18n/id";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MintaDanaDialog } from "./minta-dana-dialog";
import { selectMoneyCurrency } from "@/components/money/money-input.test-utils";
import type { AccountDto } from "@wealthme/contracts";

const mockApiFetch = jest.fn();
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));
jest.mock("../money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../../components/money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
jest.mock("../../hooks/use-currency-preference", () => ({
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

const source = { id: "acc-src", name: "BCA" } as AccountDto;
const target = { id: "acc-tgt", name: "Jago Anak" } as AccountDto;

function renderDialog() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Dialog open>
        <DialogContent>
          <MintaDanaDialog
            source={source}
            targets={[target]}
            familyGroupId="fg-1"
            token="tok"
            onClose={() => {}}
          />
        </DialogContent>
      </Dialog>
    </QueryClientProvider>,
  );
}

describe("MintaDanaDialog — revisi I", () => {
  beforeEach(() =>
    mockApiFetch
      .mockReset()
      .mockResolvedValue({ allowanceRequest: { id: "ar-1" } }),
  );

  it("revisi I — JPY request sends the preview number + fxInputs", async () => {
    renderDialog();
    await selectMoneyCurrency("JPY");
    await userEvent.type(
      screen.getByLabelText(idDict.rekening.mintaDanaAmountLabel),
      "1500",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: idDict.rekening.mintaDanaSubmitButton,
      }),
    );
    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toMatchObject({
      amount: 170_511,
      fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
    });
  });

  it("revisi I — IDR request body is unchanged", async () => {
    renderDialog();
    await userEvent.type(
      screen.getByLabelText(idDict.rekening.mintaDanaAmountLabel),
      "50000",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: idDict.rekening.mintaDanaSubmitButton,
      }),
    );
    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
    expect(body.amount).toBe(50_000);
    expect(body).not.toHaveProperty("fxInputs");
  });
});
