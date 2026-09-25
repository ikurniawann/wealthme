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
