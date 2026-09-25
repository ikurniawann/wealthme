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
import {
  resolveEffectiveAccess,
  type MemberRoleKey,
} from "@wealthme/contracts";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
    autoDebitDay: null,
    sourceAccountId: null,
    status: "on_track",
    progressPercent: 10,
    remainingAmount: 9_000_000,
    ...overrides,
  };
}

const ACCOUNT = { id: "acc-1", name: "BCA Tahapan", institution: "BCA" };
const CONTRIBUTION = {
  id: "contrib-1",
  goalId: "goal-1",
  amount: "250000",
  accountId: ACCOUNT.id,
  accountName: ACCOUNT.name,
  transactionId: "txn-1",
  occurredAt: "2026-09-20T00:00:00.000Z",
  source: "manual",
  createdAt: "2026-09-20T01:00:00.000Z",
};

type MockOptions = { contributionError?: string };

function mockSession(role: string, opts: MockOptions = {}) {
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
  mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
    // EPIC-030 — menu/permission gating reads the resolved IAM access.
    if (path.endsWith("/access/me")) {
      return Promise.resolve(
        resolveEffectiveAccess({ role: role as MemberRoleKey }),
      );
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: role }]);
    }
    if (path.endsWith("/accounts")) {
      return Promise.resolve([ACCOUNT]);
    }
    if (path.endsWith("/goals/goal-1/contributions")) {
      if (options?.method === "POST") {
        return opts.contributionError
          ? Promise.reject({ status: 400, message: opts.contributionError })
          : Promise.resolve({
              contribution: CONTRIBUTION,
              goal: buildGoal({ currentAmount: 1_250_000 }),
            });
      }
      return Promise.resolve([CONTRIBUTION]);
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

describe("TujuanPage — Setor into a goal (Revisi F item 5)", () => {
  it("posts the amount as a digit string with the source account and a local-midnight date, then closes", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    const amount = within(dialog).getByLabelText("Jumlah Setoran (Rp)");
    await user.type(amount, "250000");
    expect(amount).toHaveValue("250.000");
    await user.selectOptions(
      await within(dialog).findByLabelText("Rekening Sumber"),
      ACCOUNT.id,
    );
    fireEvent.change(within(dialog).getByLabelText("Tanggal Setoran"), {
      target: { value: "2026-09-20" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Setoran" }),
    );

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Setoran tercatat!"),
    );
    const post = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path ===
          `/family-groups/${FAMILY_GROUP_ID}/goals/goal-1/contributions` &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({
      amount: "250000",
      accountId: ACCOUNT.id,
      occurredAt: new Date("2026-09-20T00:00:00").toISOString(),
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  }, 10000);

  it("omits accountId when 'no account' is kept, and disables save for an empty or zero amount", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    const save = within(dialog).getByRole("button", { name: "Simpan Setoran" });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Jumlah Setoran (Rp)"), "0");
    expect(save).toBeDisabled();
    await user.clear(within(dialog).getByLabelText("Jumlah Setoran (Rp)"));
    await user.type(
      within(dialog).getByLabelText("Jumlah Setoran (Rp)"),
      "5000",
    );
    await user.click(save);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const post = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith("/contributions") &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    const body = JSON.parse((post?.[1] as RequestInit).body as string);
    expect(body.amount).toBe("5000");
    expect(body).not.toHaveProperty("accountId");
  }, 10000);

  it("a rejected contribution shows the server's message and keeps the dialog open", async () => {
    mockSession("owner", {
      contributionError: 'Saldo rekening bank "BCA Tahapan" tidak mencukupi',
    });
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    await user.type(
      within(dialog).getByLabelText("Jumlah Setoran (Rp)"),
      "250000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Setoran" }),
    );

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Saldo rekening bank "BCA Tahapan" tidak mencukupi',
      ),
    );
    expect(
      screen.getByRole("dialog", { name: "Setor ke Dana Liburan" }),
    ).toBeInTheDocument();
  }, 10000);

  it("admin_staff gets no Setor button but can open the contribution history", async () => {
    mockSession("admin_staff");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await screen.findByText("Dana Liburan");
    expect(
      screen.queryByRole("button", { name: /Setor ke/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Riwayat Setoran" }));
    expect(await screen.findByText("Rp 250.000")).toBeInTheDocument();
    expect(screen.getByText(/Manual · BCA Tahapan/)).toBeInTheDocument();
  }, 10000);
});
