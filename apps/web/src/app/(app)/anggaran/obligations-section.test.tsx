/**
 * EPIC-023 Task E2 — behavioral coverage for `ObligationsSection`
 * (apps/web/src/app/(app)/anggaran/page.tsx): "this period's obligations"
 * lists active liabilities/insurances with a Pay action + source-account
 * picker, calls the REAL liability/insurance pay endpoints, and invalidates
 * the budgets/accounts/liabilities/insurances/transactions/dashboard/
 * netWorth caches on success.
 */

import type { ReactElement, ReactNode } from "react";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LiabilityDto, InsuranceDto } from "@wealthme/contracts";

import { id as mockDictionary } from "../../../i18n/id";

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

jest.mock("../../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: mockDictionary,
  })),
}));

// page.tsx imports `useSession` (via auth-compat -> auth-client) at module
// scope; ObligationsSection itself never calls it, but the module must still
// load without better-auth's unparseable ESM client.
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

import { ObligationsSection } from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithClient(ui: ReactElement, queryClient: QueryClient) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return rtlRender(ui, { wrapper: Providers });
}

const t = mockDictionary.anggaran;

const DUE_LIABILITY: LiabilityDto = {
  id: "liab-1",
  familyGroupId: FAMILY_GROUP_ID,
  name: "KTA BNI",
  institution: "BNI",
  type: "pinjaman_pribadi",
  totalDebt: "20000000",
  remainingBalance: "10000000",
  minimumPayment: "2083000",
  interestRate: "10.00",
  dueDate: null,
  autoAdvanceDueDate: false,
  paymentRatio: 50,
  paidThisPeriod: false,
  notes: null,
  currency: "IDR",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const PAID_INSURANCE: InsuranceDto = {
  id: "ins-1",
  familyGroupId: FAMILY_GROUP_ID,
  name: "Asuransi Jiwa",
  provider: "Prudential",
  type: "jiwa",
  status: "aktif",
  coverageAmount: "1000000000",
  premiumAmount: "1500000",
  premiumPeriod: "monthly",
  renewalDate: "2026-02-01T00:00:00.000Z",
  autoRenewDate: false,
  policyNumber: "POL-1",
  daysUntilRenewal: 20,
  notes: null,
  currency: "IDR",
  beneficiaries: [],
  paidThisPeriod: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ACCOUNTS = [
  { id: "acc-1", name: "BCA", institution: "BCA" },
  { id: "acc-2", name: "Dompet", institution: null },
];

describe("ObligationsSection (EPIC-023 E2)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = makeQueryClient();

    mockApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = (init as { method?: string } | undefined)?.method;

      if (path === `/family-groups/${FAMILY_GROUP_ID}/liabilities`) {
        return Promise.resolve([DUE_LIABILITY]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
        return Promise.resolve([PAID_INSURANCE]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
        return Promise.resolve(ACCOUNTS);
      }
      if (
        typeof path === "string" &&
        path ===
          `/family-groups/${FAMILY_GROUP_ID}/liabilities/${DUE_LIABILITY.id}/pay` &&
        method === "POST"
      ) {
        return Promise.resolve({ ...DUE_LIABILITY, paidThisPeriod: true });
      }
      return Promise.resolve({});
    });
  });

  it("hides the section entirely when there are no obligations (Honest UI)", async () => {
    mockApiFetch.mockImplementation((path: unknown) => {
      if (path === `/family-groups/${FAMILY_GROUP_ID}/liabilities`)
        return Promise.resolve([]);
      if (path === `/family-groups/${FAMILY_GROUP_ID}/insurances`)
        return Promise.resolve([]);
      if (path === `/family-groups/${FAMILY_GROUP_ID}/accounts`)
        return Promise.resolve([]);
      return Promise.resolve({});
    });

    const { container } = renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("lists a due liability and a paid insurance with their respective badges", async () => {
    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(DUE_LIABILITY.name);
    expect(screen.getByText(PAID_INSURANCE.name)).toBeInTheDocument();
    expect(screen.getByText(t.obligationsDueBadge)).toBeInTheDocument();
    expect(screen.getByText(t.obligationsPaidBadge)).toBeInTheDocument();
  });

  it("paying a due liability requires a source account before the button is enabled, then calls the liability pay endpoint with the amount due", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(DUE_LIABILITY.name);
    const row = screen.getByText(DUE_LIABILITY.name).closest("div")!
      .parentElement!.parentElement!;
    await user.click(within(row).getByText(t.obligationsPayButton));

    const dialogTitle = await screen.findByText(t.obligationsPayDialogTitle);
    const dialog =
      dialogTitle.closest('[role="dialog"], [data-slot="dialog-content"]') ??
      dialogTitle.parentElement!;
    const confirmButton = screen.getByText(t.obligationsPayConfirmButton);
    // No account chosen yet — must stay disabled (never a silent pay).
    expect(confirmButton.closest("button")).toBeDisabled();

    const select = screen.getByLabelText(t.obligationsSourceAccountLabel);
    await user.selectOptions(select, "acc-1");

    expect(confirmButton.closest("button")).not.toBeDisabled();
    await user.click(confirmButton);

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/${DUE_LIABILITY.id}/pay`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceAccountId: "acc-1",
            amount: "2083000",
          }),
        }),
      ),
    );
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    void dialog;
  });
});
