/**
 * EPIC-023 Task D3 — behavioral coverage for `AllowanceRequestsPanel`: a
 * `held_expense` request approves directly (no source-account dialog); a
 * `funding` request must go through `ApproveRequestDialog` to pick a
 * `fromAccountId` first.
 *
 * EPIC-024 A5 — relocated here (unchanged in behavior) from
 * `apps/web/src/app/(app)/akun/family-allowance-threshold.test.tsx`
 * alongside the component itself moving to the new /persetujuan page.
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
import type { AllowanceRequestDto } from "@wealthme/contracts";

import { id as mockAkunDictionary } from "../../../i18n/id";

// Mock sonner toast library (same style as keamanan-body.test.tsx).
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

// Mock use-locale with the real Indonesian dictionary — assertions below use
// the real copy so a wording regression would also be caught.
jest.mock("../../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: mockAkunDictionary,
  })),
}));

// Mock auth-client — page.tsx imports it (via lib/auth-compat) at module
// scope; better-auth's React client ships ESM that Jest can't parse
// unmocked, so it must be stubbed even though AllowanceRequestsPanel itself
// never calls it directly.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(),
    signOut: jest.fn(),
    changePassword: jest.fn(),
    listSessions: jest.fn(),
    revokeSession: jest.fn(),
  },
}));

// Mock api-client — every request/approve/reject/PATCH call in these tests
// goes through this single mock so we can assert exactly which endpoint and
// body each interaction sends.
const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { AllowanceRequestsPanel } from "./page";

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

const t = mockAkunDictionary.akun.family;

describe("AllowanceRequestsPanel — held-expense vs funding approval branching (EPIC-023 D3)", () => {
  const FUNDING_REQUEST: AllowanceRequestDto = {
    id: "req-funding-1",
    kind: "funding",
    familyGroupId: FAMILY_GROUP_ID,
    requesterUserId: "user-adi",
    requesterName: "Adi",
    targetAccountId: "acc-adi",
    targetAccountName: "Tabungan Adi",
    fromAccountId: null,
    fromAccountName: null,
    amount: "500000",
    note: "Untuk sekolah",
    categoryId: null,
    categoryName: null,
    description: null,
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    decidedAt: null,
    decidedByUserId: null,
    decidedByName: null,
  };

  const HELD_REQUEST: AllowanceRequestDto = {
    id: "req-held-1",
    kind: "held_expense",
    familyGroupId: FAMILY_GROUP_ID,
    requesterUserId: "user-sinta",
    requesterName: "Sinta",
    targetAccountId: "acc-sinta",
    targetAccountName: "Dompet Sinta",
    fromAccountId: null,
    fromAccountName: null,
    amount: "750000",
    note: null,
    categoryId: "cat-belanja",
    categoryName: "Belanja",
    description: "Beli sepatu",
    status: "pending",
    createdAt: "2026-01-02T00:00:00.000Z",
    decidedAt: null,
    decidedByUserId: null,
    decidedByName: null,
  };

  const ACCOUNTS = [
    { id: "acc-main", name: "Rekening Utama", balance: "10000000" },
  ];

  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = makeQueryClient();

    mockApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = (init as { method?: string } | undefined)?.method;

      if (path === `/family-groups/${FAMILY_GROUP_ID}/allowance-requests`) {
        return Promise.resolve([FUNDING_REQUEST, HELD_REQUEST]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
        return Promise.resolve(ACCOUNTS);
      }
      if (
        typeof path === "string" &&
        path.endsWith(`/${HELD_REQUEST.id}/approve`) &&
        method === "PATCH"
      ) {
        return Promise.resolve({});
      }
      if (
        typeof path === "string" &&
        path.endsWith(`/${FUNDING_REQUEST.id}/approve`) &&
        method === "PATCH"
      ) {
        return Promise.resolve({});
      }
      if (
        typeof path === "string" &&
        path.endsWith(`/${HELD_REQUEST.id}/reject`) &&
        method === "PATCH"
      ) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });
  });

  function findRow(requesterName: string) {
    return screen
      .getByText(new RegExp(requesterName))
      .closest(".border-b") as HTMLElement;
  }

  it("renders the held row with the danger/held badge and the funding row with the pending badge", async () => {
    renderWithClient(
      <AllowanceRequestsPanel familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(`Adi → Tabungan Adi`);
    expect(screen.getByText(`Sinta · Dompet Sinta`)).toBeInTheDocument();

    expect(screen.getByText(t.allowanceRequestHeldBadge)).toBeInTheDocument();
    expect(
      screen.getByText(t.allowanceRequestPendingBadge),
    ).toBeInTheDocument();
  });

  it("clicking approve on the held row calls the approve endpoint directly and never opens the source-account dialog", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <AllowanceRequestsPanel familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(`Sinta · Dompet Sinta`);
    const heldRow = findRow("Sinta");
    const approveButton = within(heldRow).getByLabelText(
      t.allowanceRequestApproveButton,
    );

    await user.click(approveButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/allowance-requests/${HELD_REQUEST.id}/approve`,
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({}) }),
      );
    });

    // The dialog that asks for a source account must never appear for a
    // held-expense approval — it already carries its own account.
    expect(
      screen.queryByText(t.allowanceRequestApproveDialogTitle),
    ).not.toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      t.allowanceRequestHeldApproved,
    );
  });

  it("clicking approve on the funding row opens the source-account dialog and does NOT call approve immediately", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <AllowanceRequestsPanel familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(`Adi → Tabungan Adi`);
    const fundingRow = findRow("Adi");
    const approveButton = within(fundingRow).getByLabelText(
      t.allowanceRequestApproveButton,
    );

    await user.click(approveButton);

    expect(
      await screen.findByText(t.allowanceRequestApproveDialogTitle),
    ).toBeInTheDocument();

    // Merely opening the dialog must not have approved anything yet.
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining(`/${FUNDING_REQUEST.id}/approve`),
      expect.anything(),
    );
  });

  it("choosing a source account and confirming approves the funding request with that fromAccountId", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <AllowanceRequestsPanel familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(`Adi → Tabungan Adi`);
    const fundingRow = findRow("Adi");
    await user.click(
      within(fundingRow).getByLabelText(t.allowanceRequestApproveButton),
    );

    await screen.findByText(t.allowanceRequestApproveDialogTitle);
    const select = await screen.findByDisplayValue("—");
    await user.selectOptions(select, "acc-main");
    await user.click(
      screen.getByRole("button", { name: t.allowanceRequestApproveButton }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/allowance-requests/${FUNDING_REQUEST.id}/approve`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ fromAccountId: "acc-main" }),
        }),
      );
    });
  });

  it("clicking reject on the held row calls the reject endpoint and never posts a transaction", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <AllowanceRequestsPanel familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(`Sinta · Dompet Sinta`);
    const heldRow = findRow("Sinta");
    await user.click(
      within(heldRow).getByLabelText(t.allowanceRequestRejectButton),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/allowance-requests/${HELD_REQUEST.id}/reject`,
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({}) }),
      );
    });

    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/transactions"),
      expect.anything(),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(t.allowanceRequestRejected);
  });

  // EPIC-024 A5 (US-AUTH-11) — the anti-overdraft guard's real 400 message
  // must reach the user via `extractApiErrorMessage`, never a generic
  // toast. Proves the fix: a distinctive server message survives to the
  // toast verbatim.
  it("surfaces the server's real error message when approving a funding request fails (e.g. anti-overdraft 400)", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = (init as { method?: string } | undefined)?.method;
      if (path === `/family-groups/${FAMILY_GROUP_ID}/allowance-requests`) {
        return Promise.resolve([FUNDING_REQUEST]);
      }
      if (path === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
        return Promise.resolve(ACCOUNTS);
      }
      if (
        typeof path === "string" &&
        path.endsWith(`/${FUNDING_REQUEST.id}/approve`) &&
        method === "PATCH"
      ) {
        return Promise.reject({
          status: 400,
          message:
            'Saldo rekening bank "Akun Utama" tidak mencukupi untuk transaksi ini. Rekening bank tidak boleh memiliki saldo minus.',
        });
      }
      return Promise.resolve({});
    });

    renderWithClient(
      <AllowanceRequestsPanel familyGroupId={FAMILY_GROUP_ID} token={TOKEN} />,
      queryClient,
    );

    await screen.findByText(`Adi → Tabungan Adi`);
    await user.click(
      within(findRow("Adi")).getByLabelText(t.allowanceRequestApproveButton),
    );
    await screen.findByText(t.allowanceRequestApproveDialogTitle);
    const select = await screen.findByDisplayValue("—");
    await user.selectOptions(select, "acc-main");
    await user.click(
      screen.getByRole("button", { name: t.allowanceRequestApproveButton }),
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("tidak mencukupi"),
      );
    });
    // Never the generic fallback — the real server message reached the user.
    expect(mockToastError).not.toHaveBeenCalledWith(
      t.allowanceRequestApproveFailed,
    );
  });
});
