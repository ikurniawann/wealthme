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
  nextDueDate: null,
  autoAdvanceDueDate: false,
  paymentRatio: 50,
  paidThisPeriod: false,
  notes: null,
  currency: "IDR",
  interestMethod: "efektif",
  tenorMonths: null,
  startDate: null,
  installmentAmount: null,
  currentInstallmentAmount: "2083000",
  fixedRateMonths: null,
  floatingRate: null,
  kprScheme: null,
  ratePeriods: [],
  currentRatePercent: "2.25",
  currentInstallmentLate: false,
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

// EPIC-023 Task E retry (LOW 8) — an UNPAID insurance, so its own Pay flow
// (previously untested entirely) can be exercised end to end.
const DUE_INSURANCE: InsuranceDto = {
  ...PAID_INSURANCE,
  id: "ins-2",
  name: "Asuransi Kesehatan",
  paidThisPeriod: false,
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

    // LOW 8 fix — the original `toHaveBeenCalled()` (at least once) was
    // satisfiable by the FIRST of the three queries firing, while the
    // section is ALSO empty before any of them resolve (obligations
    // defaults to `[]` while pending). That made the assertion below pass
    // regardless of whether the fetched data actually arrived. Wait for
    // all three endpoints (liabilities/insurances/accounts) to have
    // resolved before asserting on the settled result.
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities`,
        expect.anything(),
      );
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/insurances`,
        expect.anything(),
      );
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/accounts`,
        expect.anything(),
      );
    });
    await waitFor(() =>
      expect(
        queryClient.getQueryState(["liabilities", FAMILY_GROUP_ID])?.status,
      ).toBe("success"),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists a due liability and a paid insurance with their respective badges", async () => {
    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(DUE_LIABILITY.name);
    expect(screen.getByText(PAID_INSURANCE.name)).toBeInTheDocument();
    // EPIC-032 de-slop: the section title already says "Belum Dibayar", so
    // the unpaid pill is no longer repeated per row; only paid rows carry one.
    expect(screen.queryByText(t.obligationsDueBadge)).not.toBeInTheDocument();
    expect(screen.getByText(t.obligationsPaidBadge)).toBeInTheDocument();
  });

  // fix-round1 (Minor) — the obligations Pay list mapped the legacy
  // `dueDate` (never set for a KPR), unlike /liabilitas which already
  // switched to `nextDueDate`. Round out the same switch here.
  it("shows the API's nextDueDate for a liability whose legacy dueDate is null", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith("/liabilities")) {
        return Promise.resolve([
          {
            ...DUE_LIABILITY,
            dueDate: null,
            nextDueDate: "2026-09-27T00:00:00.000Z",
          },
        ]);
      }
      if (url.endsWith("/insurances")) {
        return Promise.resolve([PAID_INSURANCE]);
      }
      return Promise.resolve([]);
    });
    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(DUE_LIABILITY.name);
    const row = screen
      .getByText(DUE_LIABILITY.name)
      .closest("div")!.parentElement!;
    // Proto port — the row's due date is compact, no year ("27 Sep"), not
    // the full "27 Sep 2026" the pay dialog still shows.
    expect(row.textContent).toContain(
      new Date("2026-09-27T00:00:00.000Z").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      }),
    );
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

  it("MEDIUM 7 — a fractional minimumPayment displays and posts the SAME truncated amount (formatRupiah rounds, the old code posted a separately-truncated value, so a .5+ fraction used to post 1 rupiah more than it displayed)", async () => {
    const FRACTIONAL_LIABILITY: LiabilityDto = {
      ...DUE_LIABILITY,
      id: "liab-frac-1",
      name: "Cicilan Motor",
      minimumPayment: "2083000.75",
      currentInstallmentAmount: null,
    };
    mockApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = (init as { method?: string } | undefined)?.method;
      if (path === `/family-groups/${FAMILY_GROUP_ID}/liabilities`) {
        return Promise.resolve([FRACTIONAL_LIABILITY]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
        return Promise.resolve([]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
        return Promise.resolve(ACCOUNTS);
      }
      if (
        path ===
          `/family-groups/${FAMILY_GROUP_ID}/liabilities/${FRACTIONAL_LIABILITY.id}/pay` &&
        method === "POST"
      ) {
        return Promise.resolve({
          ...FRACTIONAL_LIABILITY,
          paidThisPeriod: true,
        });
      }
      return Promise.resolve({});
    });

    const user = userEvent.setup();
    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(FRACTIONAL_LIABILITY.name);
    // The row displays Rp 2.083.000 (truncated), never Rp 2.083.001
    // (Math.round of the raw fractional value).
    expect(screen.getByText("Rp 2.083.000")).toBeInTheDocument();

    const row = screen.getByText(FRACTIONAL_LIABILITY.name).closest("div")!
      .parentElement!.parentElement!;
    await user.click(within(row).getByText(t.obligationsPayButton));

    await screen.findByText(t.obligationsPayDialogTitle);
    // The dialog's own amount readout uses the same truncated value (row +
    // dialog both show it now, so two matches, not one).
    expect(screen.getAllByText("Rp 2.083.000")).toHaveLength(2);

    const select = screen.getByLabelText(t.obligationsSourceAccountLabel);
    await user.selectOptions(select, "acc-1");
    await user.click(screen.getByText(t.obligationsPayConfirmButton));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/${FRACTIONAL_LIABILITY.id}/pay`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceAccountId: "acc-1",
            amount: "2083000",
          }),
        }),
      ),
    );
  });

  it("a KPR past its fixed period is due its re-amortised current installment, not the stale minimumPayment (revisi G final fix 2)", async () => {
    const KPR: LiabilityDto = {
      ...DUE_LIABILITY,
      id: "liab-kpr",
      name: "KPR BTN",
      type: "kpr",
      minimumPayment: "3299779",
      currentInstallmentAmount: "4744030",
    };
    mockApiFetch.mockImplementation((path: unknown) => {
      if (path === `/family-groups/${FAMILY_GROUP_ID}/liabilities`) {
        return Promise.resolve([KPR]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(KPR.name);
    expect(screen.getByText("Rp 4.744.030")).toBeInTheDocument();
    expect(screen.queryByText("Rp 3.299.779")).not.toBeInTheDocument();
  });

  it("LOW 8 — paying a due insurance calls the insurance pay endpoint with just the source account (amount defaults server-side to premiumAmount)", async () => {
    mockApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = (init as { method?: string } | undefined)?.method;

      if (path === `/family-groups/${FAMILY_GROUP_ID}/liabilities`) {
        return Promise.resolve([]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
        return Promise.resolve([DUE_INSURANCE]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
        return Promise.resolve(ACCOUNTS);
      }
      if (
        path ===
          `/family-groups/${FAMILY_GROUP_ID}/insurances/${DUE_INSURANCE.id}/pay` &&
        method === "POST"
      ) {
        return Promise.resolve({ ...DUE_INSURANCE, paidThisPeriod: true });
      }
      return Promise.resolve({});
    });

    const user = userEvent.setup();
    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(DUE_INSURANCE.name);
    const row = screen.getByText(DUE_INSURANCE.name).closest("div")!
      .parentElement!.parentElement!;
    await user.click(within(row).getByText(t.obligationsPayButton));

    await screen.findByText(t.obligationsPayDialogTitle);
    const select = screen.getByLabelText(t.obligationsSourceAccountLabel);
    await user.selectOptions(select, "acc-2");
    await user.click(screen.getByText(t.obligationsPayConfirmButton));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/insurances/${DUE_INSURANCE.id}/pay`,
        expect.objectContaining({
          method: "POST",
          // No `amount` key — the insurance side defaults to premiumAmount
          // server-side when it's omitted (unlike the liability path, which
          // must send an explicit amount for its variable balance).
          body: JSON.stringify({ sourceAccountId: "acc-2" }),
        }),
      ),
    );
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
  });

  it("CRITICAL 1 — an already-paid obligation's Pay button is disabled and never opens the pay dialog or posts a second payment", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ObligationsSection familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(PAID_INSURANCE.name);
    const row = screen.getByText(PAID_INSURANCE.name).closest("div")!
      .parentElement!.parentElement!;
    const payButton = within(row).getByRole("button", {
      name: t.obligationsAlreadyPaidButton,
    });

    expect(payButton).toBeDisabled();
    await user.click(payButton);

    expect(
      screen.queryByText(t.obligationsPayDialogTitle),
    ).not.toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/pay"),
      expect.anything(),
    );
  });
});
