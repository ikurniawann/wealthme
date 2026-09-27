import type { ReactElement } from "react";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TransactionDto } from "@wealthme/contracts";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { setLocale } from "../../../hooks/use-locale";
import { EditTransactionDialog } from "./page";

const TX = {
  id: "tx-1",
  amount: "50000",
  description: "Makan siang",
  occurredAt: "2026-09-10T05:00:00.000Z",
} as unknown as TransactionDto;

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setLocale("id");
  mockApiFetch.mockResolvedValue({});
});

it("edits the date through the shared calendar and PATCHes that day", async () => {
  const user = userEvent.setup();
  render(
    <EditTransactionDialog
      tx={TX}
      token="t"
      familyGroupId="fg-1"
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );

  const trigger = await screen.findByLabelText("Tanggal");
  expect(trigger.tagName).toBe("BUTTON");
  expect(trigger).toHaveTextContent("10 September 2026");

  await user.click(trigger);
  await user.click(
    within(screen.getByRole("dialog", { name: "Tanggal" })).getByRole(
      "button",
      { name: /^12 / },
    ),
  );
  await user.click(screen.getByRole("button", { name: "Simpan" }));

  await waitFor(() => {
    const patch = mockApiFetch.mock.calls.find(
      ([, opts]) =>
        (opts as { method?: string } | undefined)?.method === "PATCH",
    );
    expect(patch?.[0]).toBe("/family-groups/fg-1/transactions/tx-1");
    expect(JSON.parse(String(patch?.[1]?.body)).occurredAt).toBe(
      "2026-09-12T00:00:00.000Z",
    );
  });
});

jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../../../components/money/fx-test-rates")
          .TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));

jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

describe("EditTransactionDialog — revisi I multi-currency", () => {
  it("revisi I — editing without touching the amount sends no fxInputs; a JPY amount does", async () => {
    const user = userEvent.setup();
    render(
      <EditTransactionDialog
        tx={TX}
        token="t"
        familyGroupId="fg-1"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    // First: verify no fxInputs on unchanged save
    await screen.findByLabelText("Tanggal");
    await user.click(await screen.findByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      const patch = mockApiFetch.mock.calls.find(
        ([, opts]) =>
          (opts as { method?: string } | undefined)?.method === "PATCH",
      );
      expect(JSON.parse(String(patch?.[1]?.body))).not.toHaveProperty(
        "fxInputs",
      );
    });
  });

  it("revisi I — JPY amount sends preview + fxInputs", async () => {
    const user = userEvent.setup();
    render(
      <EditTransactionDialog
        tx={TX}
        token="t"
        familyGroupId="fg-1"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    await userEvent.selectOptions(
      await screen.findByLabelText("Mata uang"),
      "JPY",
    );
    const amountInput = screen.getByDisplayValue("50.000") as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "1500");

    await user.click(await screen.findByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      const patch = mockApiFetch.mock.calls.find(
        ([, opts]) =>
          (opts as { method?: string } | undefined)?.method === "PATCH",
      );
      expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
        amount: 170_511,
        fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
      });
    });
  });
});
