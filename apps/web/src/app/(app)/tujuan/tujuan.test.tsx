/**
 * EPIC-022 Group F (F1/F2/F3) — /tujuan (goals) locks in:
 *
 * - F1/F2: a failed save surfaces the server's real message (not a generic
 *   constant) AND keeps the "Tambah Tujuan" dialog open with the user's
 *   input intact — `handleSubmit`'s bare `catch { toast.error(constant) }`
 *   used to swallow the message AND let `CrudModal`'s `await onSubmit(...)`
 *   resolve normally, closing the dialog even though the save failed.
 * - F3: CASL only grants "manage Goal" to owner/spouse/member — a role with
 *   only "read Goal" (admin_staff) must not be offered the create action.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { GoalDto } from "@wealthme/contracts";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: jest.fn(),
  }),
}));

import TujuanPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function buildGoal(overrides: Partial<GoalDto> = {}): GoalDto {
  return {
    id: "goal-1",
    name: "Dana Liburan",
    icon: "✈️",
    targetAmount: 10_000_000,
    currentAmount: 1_000_000,
    targetDate: "2026-12-01",
    autoDebitAmount: null,
    status: "on_track",
    progressPercent: 10,
    remainingAmount: 9_000_000,
    ...overrides,
  };
}

function mockSession(role: string) {
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
  mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: role }]);
    }
    if (path.endsWith("/goals")) {
      if (options?.method === "POST") {
        return Promise.reject({
          status: 400,
          message: "Target tanggal tidak boleh di masa lalu",
        });
      }
      return Promise.resolve([buildGoal()]);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
});

describe("TujuanPage — failed saves surface the real message and keep the dialog open (F1/F2)", () => {
  it("does not close the add-goal dialog and shows the server's real message on a failed save", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Tujuan" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Dana Liburan"),
      "Rumah Baru",
    );
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    // F1 — the real server message reaches the user, not a generic constant.
    await screen.findByRole("dialog");
    expect(mockToastError).toHaveBeenCalledWith(
      "Target tanggal tidak boleh di masa lalu",
    );
    // F2 — the dialog is still open and the typed name survived.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByDisplayValue("Rumah Baru"),
    ).toBeInTheDocument();
  }, 10000);
});

describe("TujuanPage — role gating (F3)", () => {
  it("offers the create action to an owner (CASL: manage Goal)", async () => {
    mockSession("owner");
    render(<TujuanPage />);

    expect(
      await screen.findByRole("button", { name: "Tambah Tujuan" }),
    ).toBeInTheDocument();
  });

  it("hides the create action from admin_staff (CASL: read-only Goal)", async () => {
    mockSession("admin_staff");
    render(<TujuanPage />);

    await screen.findByText("Dana Liburan");
    expect(
      screen.queryByRole("button", { name: /Tambah Tujuan/i }),
    ).not.toBeInTheDocument();
  });
});
