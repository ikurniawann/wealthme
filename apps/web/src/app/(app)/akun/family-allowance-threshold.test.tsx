/**
 * EPIC-023 Task D3 — behavioral coverage for `ThresholdForm`: prefills from
 * `member.largeTxnThreshold`, PATCHes a positive integer, and PATCHes
 * `null` when the field is cleared.
 *
 * EPIC-024 A5 — the `AllowanceRequestsPanel` coverage that used to live in
 * this file moved to `apps/web/src/app/(app)/persetujuan/allowance-requests-panel.test.tsx`
 * alongside the component itself (relocated to the new /persetujuan page).
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

// Mock auth-client — page.tsx imports it at module scope (used by other
// exported bodies in this file); better-auth's React client ships ESM that
// Jest can't parse unmocked, so it must be stubbed even though the
// components under test here never call it.
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

import { ThresholdForm, type FamilyMember } from "./page";

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

/* ─────────────────────── ThresholdForm ─────────────────────── */

describe("ThresholdForm — per-member large-transaction threshold (EPIC-023 D3)", () => {
  const MEMBER: FamilyMember = {
    id: "member-1",
    userId: "user-1",
    familyGroupId: FAMILY_GROUP_ID,
    role: "dependant",
    name: "Budi",
    email: "budi@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    largeTxnThreshold: "500000",
  };

  let queryClient: QueryClient;
  let onClose: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = makeQueryClient();
    onClose = jest.fn();

    mockApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = (init as { method?: string } | undefined)?.method;
      if (
        path === `/family-groups/${FAMILY_GROUP_ID}/members/${MEMBER.id}` &&
        method === "PATCH"
      ) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });
  });

  it("prefills the input from member.largeTxnThreshold formatted with id-ID grouping", () => {
    renderWithClient(
      <ThresholdForm
        member={MEMBER}
        familyGroupId={FAMILY_GROUP_ID}
        token={TOKEN}
        onClose={onClose}
      />,
      queryClient,
    );

    const input = screen.getByLabelText(t.thresholdLabel) as HTMLInputElement;
    expect(input.value).toBe("500.000");
  });

  it("submitting a positive value PATCHes largeTxnThreshold as that integer", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ThresholdForm
        member={{ ...MEMBER, largeTxnThreshold: null }}
        familyGroupId={FAMILY_GROUP_ID}
        token={TOKEN}
        onClose={onClose}
      />,
      queryClient,
    );

    const input = screen.getByLabelText(t.thresholdLabel);
    await user.type(input, "2000000");
    await user.click(
      screen.getByRole("button", { name: t.thresholdSaveButton }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/members/${MEMBER.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            role: MEMBER.role,
            largeTxnThreshold: 2000000,
          }),
        }),
      );
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(t.thresholdSaved);
    expect(onClose).toHaveBeenCalled();
  });

  it("clearing the prefilled input and submitting PATCHes largeTxnThreshold as null", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ThresholdForm
        member={MEMBER}
        familyGroupId={FAMILY_GROUP_ID}
        token={TOKEN}
        onClose={onClose}
      />,
      queryClient,
    );

    const input = screen.getByLabelText(t.thresholdLabel);
    await user.clear(input);
    await user.click(
      screen.getByRole("button", { name: t.thresholdSaveButton }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/members/${MEMBER.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            role: MEMBER.role,
            largeTxnThreshold: null,
          }),
        }),
      );
    });
  });

  it("shows the failure toast and does not close when the mutation rejects", async () => {
    mockApiFetch.mockImplementation(() => Promise.reject(new Error("boom")));
    const user = userEvent.setup();
    renderWithClient(
      <ThresholdForm
        member={MEMBER}
        familyGroupId={FAMILY_GROUP_ID}
        token={TOKEN}
        onClose={onClose}
      />,
      queryClient,
    );

    await user.click(
      screen.getByRole("button", { name: t.thresholdSaveButton }),
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(t.thresholdSaveFailed);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
