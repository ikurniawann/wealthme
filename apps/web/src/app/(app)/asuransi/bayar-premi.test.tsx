/**
 * EPIC-016 Task H — /asuransi "Bayar" (pay premium) button.
 *
 * The button previously only toasted "💳 Bayar premi" and never recorded a
 * payment or updated any renewal/due-date state. It now calls
 * `POST /family-groups/:familyGroupId/insurances/:id/pay-premium`, which
 * advances the policy's renewalDate server-side by one billing period
 * (reusing the same auto-renew month-advance logic as the billing-cycle
 * cron). Success only toasts after that write resolves, and the action is
 * hidden entirely for a policy with no renewalDate to advance.
 */

import type { ReactElement, ReactNode } from "react";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { InsuranceDto } from "@wealthme/contracts";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: "tok-1", familyGroupId: "fg-1" },
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

import AsuransiPage from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function makePolicy(overrides: Partial<InsuranceDto>): InsuranceDto {
  return {
    id: "ins-1",
    familyGroupId: "fg-1",
    name: "Asuransi Jiwa Keluarga",
    provider: "Prudential",
    type: "jiwa",
    status: "aktif",
    coverageAmount: "1000000000",
    premiumAmount: "1500000",
    premiumPeriod: "monthly",
    renewalDate: "2026-08-01T00:00:00.000Z",
    autoRenewDate: false,
    policyNumber: "POL-001",
    daysUntilRenewal: 10,
    notes: null,
    currency: "IDR",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const SUMMARY = {
  activePolicies: 1,
  totalMonthlyPremium: "1500000",
  currency: "IDR",
};

describe("/asuransi Bayar premium button (EPIC-016 Task H)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('clicking "Bayar" records a real payment and only toasts success after the write resolves', async () => {
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const policy = makePolicy({ renewalDate: "2026-08-01T00:00:00.000Z" });
    const paidPolicy = {
      ...policy,
      renewalDate: "2026-09-01T00:00:00.000Z",
      daysUntilRenewal: 41,
    };

    mockApiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/family-groups/fg-1/insurances") {
          return Promise.resolve([policy]);
        }
        if (path === "/family-groups/fg-1/insurances/summary") {
          return Promise.resolve(SUMMARY);
        }
        if (
          path === "/family-groups/fg-1/insurances/ins-1/pay-premium" &&
          options?.method === "POST"
        ) {
          return Promise.resolve(paidPolicy);
        }
        return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
      },
    );

    const user = userEvent.setup();
    render(<AsuransiPage />);

    await waitFor(() => {
      expect(screen.getByText("Asuransi Jiwa Keluarga")).toBeInTheDocument();
    });

    // No fake success before the click.
    expect(toast.success).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Bayar"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/family-groups/fg-1/insurances/ins-1/pay-premium",
        expect.objectContaining({ method: "POST", token: "tok-1" }),
      );
    });

    // Success only fires after the real write resolves.
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Pembayaran premi dicatat, jatuh tempo diperbarui",
      );
    });
  });

  it("does not toast success when the payment write fails", async () => {
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const policy = makePolicy({ renewalDate: "2026-08-01T00:00:00.000Z" });

    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/family-groups/fg-1/insurances") {
        return Promise.resolve([policy]);
      }
      if (path === "/family-groups/fg-1/insurances/summary") {
        return Promise.resolve(SUMMARY);
      }
      if (path === "/family-groups/fg-1/insurances/ins-1/pay-premium") {
        return Promise.reject({
          status: 400,
          message: "Insurance has no renewal date to advance",
        });
      }
      return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
    });

    const user = userEvent.setup();
    render(<AsuransiPage />);

    await waitFor(() => {
      expect(screen.getByText("Asuransi Jiwa Keluarga")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Bayar"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Insurance has no renewal date to advance",
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('hides the "Bayar" action for a policy with no renewal date to advance', async () => {
    const policy = makePolicy({ renewalDate: null, daysUntilRenewal: null });

    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/family-groups/fg-1/insurances") {
        return Promise.resolve([policy]);
      }
      if (path === "/family-groups/fg-1/insurances/summary") {
        return Promise.resolve(SUMMARY);
      }
      return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
    });

    render(<AsuransiPage />);

    await waitFor(() => {
      expect(screen.getByText("Asuransi Jiwa Keluarga")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Bayar")).not.toBeInTheDocument();
  });

  it('same-tick double-click on "Bayar" (fireEvent, no await/act() between clicks) sends exactly ONE pay-premium request', async () => {
    // This is the test that actually proves the race is closed. Two
    // `fireEvent.click()` calls back-to-back with NO await/act() flush in
    // between reproduce the exact scenario that disproved the previous
    // "fix": `payPremiumMutation.isPending` only flips after react-query's
    // notification pipe runs a `setTimeout(0)` macrotask, so it has NOT
    // updated yet when the second synchronous click fires — the button is
    // not yet `disabled`, and a `disabled={payPending}` check alone lets
    // both clicks reach the handler. Only a ref mutated synchronously
    // inside the handler itself (before `.mutate()`) can observe the first
    // click from within the second, same-tick call.
    const policy = makePolicy({ renewalDate: "2026-08-01T00:00:00.000Z" });
    const paidPolicy = {
      ...policy,
      renewalDate: "2026-09-01T00:00:00.000Z",
      daysUntilRenewal: 41,
    };

    // Deferred promise: the pay-premium request stays in flight until we
    // explicitly resolve it, so both clicks land while it is still pending.
    let resolvePay: (value: typeof paidPolicy) => void = () => {};
    const payPromise = new Promise<typeof paidPolicy>((resolve) => {
      resolvePay = resolve;
    });

    mockApiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/family-groups/fg-1/insurances") {
          return Promise.resolve([policy]);
        }
        if (path === "/family-groups/fg-1/insurances/summary") {
          return Promise.resolve(SUMMARY);
        }
        if (
          path === "/family-groups/fg-1/insurances/ins-1/pay-premium" &&
          options?.method === "POST"
        ) {
          return payPromise;
        }
        return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
      },
    );

    render(<AsuransiPage />);

    await waitFor(() => {
      expect(screen.getByText("Asuransi Jiwa Keluarga")).toBeInTheDocument();
    });

    const bayarButton = screen.getByLabelText("Bayar");
    const filterPayCalls = () =>
      mockApiFetch.mock.calls.filter(([path, options]) => {
        const opts = options as { method?: string } | undefined;
        return (
          path === "/family-groups/fg-1/insurances/ins-1/pay-premium" &&
          opts?.method === "POST"
        );
      });

    // Two SYNCHRONOUS clicks, no await / no act() flush between them. This
    // is the exact reproduction: the second click's onClick handler runs
    // before react-query's `isPending` has updated (that update is queued
    // via a `setTimeout(0)` macrotask), so only a ref checked-and-set
    // synchronously inside the handler — before either `.mutate()` call —
    // can stop the second request from ever being dispatched.
    fireEvent.click(bayarButton);
    fireEvent.click(bayarButton);

    // mutationFn itself is invoked via react-query's internal scheduling
    // (a microtask), so wait for the first (and only) call to register
    // before asserting the count — this wait happens AFTER both clicks,
    // not between them, so it does not mask the race.
    await waitFor(() => {
      expect(filterPayCalls().length).toBeGreaterThan(0);
    });

    expect(filterPayCalls()).toHaveLength(1);

    resolvePay(paidPolicy);

    // The lock releases once the mutation settles, so a later click can
    // retry (this is not testing the race — just that we don't deadlock).
    await waitFor(() => {
      expect(bayarButton).not.toBeDisabled();
    });
  });

  it('rapid but sequential (awaited) double-click on "Bayar" sends exactly ONE pay-premium request and disables the button while pending', async () => {
    // Complementary UX-level test: with real awaited userEvent clicks,
    // enough real time elapses between the two clicks for react-query's
    // `isPending` state to propagate, so the button is visibly disabled
    // (and aria-busy) by the time of/after the second click. This does NOT
    // exercise the same-tick race above — that is the previous test's job.
    const policy = makePolicy({ renewalDate: "2026-08-01T00:00:00.000Z" });
    const paidPolicy = {
      ...policy,
      renewalDate: "2026-09-01T00:00:00.000Z",
      daysUntilRenewal: 41,
    };

    // Deferred promise: the pay-premium request stays in flight until we
    // explicitly resolve it, so both clicks land while it is still pending.
    let resolvePay: (value: typeof paidPolicy) => void = () => {};
    const payPromise = new Promise<typeof paidPolicy>((resolve) => {
      resolvePay = resolve;
    });

    mockApiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/family-groups/fg-1/insurances") {
          return Promise.resolve([policy]);
        }
        if (path === "/family-groups/fg-1/insurances/summary") {
          return Promise.resolve(SUMMARY);
        }
        if (
          path === "/family-groups/fg-1/insurances/ins-1/pay-premium" &&
          options?.method === "POST"
        ) {
          return payPromise;
        }
        return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
      },
    );

    const user = userEvent.setup();
    render(<AsuransiPage />);

    await waitFor(() => {
      expect(screen.getByText("Asuransi Jiwa Keluarga")).toBeInTheDocument();
    });

    const bayarButton = screen.getByLabelText("Bayar");

    // Two clicks back-to-back before the in-flight request resolves —
    // simulates a slow network / impatient double-click.
    await user.click(bayarButton);
    await user.click(bayarButton);

    const payCalls = mockApiFetch.mock.calls.filter(([path, options]) => {
      const opts = options as { method?: string } | undefined;
      return (
        path === "/family-groups/fg-1/insurances/ins-1/pay-premium" &&
        opts?.method === "POST"
      );
    });
    expect(payCalls).toHaveLength(1);

    // The button reports its busy/disabled state instead of silently
    // no-opping the second click.
    expect(bayarButton).toBeDisabled();
    expect(bayarButton).toHaveAttribute("aria-busy", "true");

    resolvePay(paidPolicy);

    await waitFor(() => {
      expect(bayarButton).not.toBeDisabled();
    });
  });
});
