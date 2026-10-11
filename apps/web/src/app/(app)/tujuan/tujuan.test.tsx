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

type MockOptions = {
  contributionError?: string;
  goalPostOk?: boolean;
  // Revisi F final-review Finding 1/3 — lets edit-flow tests seed a goal
  // that already has autoDebitAmount/sourceAccountId set (e.g. a legacy
  // goal with no source account), instead of always the plain default.
  goalOverrides?: Partial<GoalDto>;
};

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
        return opts.goalPostOk
          ? Promise.resolve(buildGoal({ id: "goal-new", name: "Rumah Baru" }))
          : Promise.reject({
              status: 400,
              message: "Target tanggal tidak boleh di masa lalu",
            });
      }
      return Promise.resolve([buildGoal(opts.goalOverrides)]);
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
    await user.type(within(dialog).getByLabelText(/Target Jumlah/), "5000000");
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

// E2E round 1, bug 1 — a goal with an empty/whitespace name used to save
// silently (201, success toast). CrudModal now blocks Simpan with an inline
// error and never calls the API.
describe("TujuanPage — empty name is rejected before any request (E2E round 1 bug 1)", () => {
  it("shows an inline error and does not POST when Nama Tujuan is left empty", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Tujuan" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(
      await within(dialog).findByText("Nama Tujuan wajib diisi."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      mockApiFetch.mock.calls.some(
        ([path, options]) =>
          String(path).endsWith("/goals") && options?.method === "POST",
      ),
    ).toBe(false);
  });

  it("shows an inline error and does not POST when Nama Tujuan is whitespace-only", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Tujuan" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Dana Liburan"),
      "   ",
    );
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(
      await within(dialog).findByText("Nama Tujuan wajib diisi."),
    ).toBeInTheDocument();
    expect(
      mockApiFetch.mock.calls.some(
        ([path, options]) =>
          String(path).endsWith("/goals") && options?.method === "POST",
      ),
    ).toBe(false);
  });
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

// EPIC-033 revision — Setor/Edit/Hapus/Riwayat Setoran no longer sit on the
// tile face; the tile opens a side panel (GoalDetailPanel) that contains
// them. `openGoalDetail` opens that panel the same way a real user would:
// click the tile by its accessible name, then look inside the panel.
async function openGoalDetail(
  user: ReturnType<typeof userEvent.setup>,
  goalName: string,
  pct = 10,
) {
  await user.click(
    await screen.findByRole("button", {
      name: new RegExp(`^${goalName}, ${pct}%`),
    }),
  );
  return screen.findByRole("dialog", { name: goalName });
}

describe("TujuanPage — Setor into a goal (Revisi F item 5)", () => {
  it("posts the amount as a digit string with the source account and a local-midnight date, then closes", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await openGoalDetail(user, "Dana Liburan");
    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    const amount = within(dialog).getByLabelText("Jumlah Setoran");
    await user.type(amount, "250000");
    expect(amount).toHaveValue("250.000");
    await user.selectOptions(
      await within(dialog).findByLabelText("Rekening Sumber"),
      ACCOUNT.id,
    );
    // "Tanggal Setoran" is a shared `DateField` (a button named by its
    // label, portaled calendar) — set it through its hidden native
    // `<input type="date">`, mirroring akun/profil-body.test.tsx.
    const dateInput = dialog.querySelector<HTMLInputElement>(
      '.date-field input[type="date"]',
    );
    if (!dateInput) throw new Error("DateField native input missing");
    fireEvent.change(dateInput, { target: { value: "2026-09-20" } });
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

    await openGoalDetail(user, "Dana Liburan");
    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    const save = within(dialog).getByRole("button", { name: "Simpan Setoran" });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Jumlah Setoran"), "0");
    expect(save).toBeDisabled();
    await user.clear(within(dialog).getByLabelText("Jumlah Setoran"));
    await user.type(within(dialog).getByLabelText("Jumlah Setoran"), "5000");
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

    await openGoalDetail(user, "Dana Liburan");
    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    await user.type(within(dialog).getByLabelText("Jumlah Setoran"), "250000");
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

    const detail = await openGoalDetail(user, "Dana Liburan");
    expect(
      within(detail).queryByRole("button", { name: /Setor ke/i }),
    ).not.toBeInTheDocument();

    await user.click(
      within(detail).getByRole("button", { name: "Riwayat Setoran" }),
    );
    expect(await screen.findByText("Rp 250.000")).toBeInTheDocument();
    expect(screen.getByText(/Manual · BCA Tahapan/)).toBeInTheDocument();
  }, 10000);
});

describe("TujuanPage — goal form source account for auto-debit (Revisi F item 5)", () => {
  it("shows the source-account select only once an auto-debit amount is typed, and sends it", async () => {
    mockSession("owner", { goalPostOk: true });
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
    await user.type(
      within(dialog).getByLabelText("Target Jumlah"),
      "100000000",
    );
    expect(
      within(dialog).queryByLabelText("Rekening Sumber Auto-debit"),
    ).not.toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText("Auto-debit / Bulan"),
      "500000",
    );
    await user.selectOptions(
      await within(dialog).findByLabelText("Rekening Sumber Auto-debit"),
      ACCOUNT.id,
    );
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const post = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith("/goals") &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toMatchObject(
      {
        name: "Rumah Baru",
        targetAmount: 100_000_000,
        autoDebitAmount: 500_000,
        sourceAccountId: ACCOUNT.id,
      },
    );
  }, 30000);

  it("blocks saving an auto-debit without a source account, keeps the dialog open, and never POSTs", async () => {
    mockSession("owner", { goalPostOk: true });
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
    await user.type(
      within(dialog).getByLabelText("Target Jumlah"),
      "100000000",
    );
    await user.type(
      within(dialog).getByLabelText("Auto-debit / Bulan"),
      "500000",
    );
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Pilih rekening sumber untuk auto-debit.",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      mockApiFetch.mock.calls.some(
        ([path, options]) =>
          typeof path === "string" &&
          path.endsWith("/goals") &&
          (options as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  }, 30000);
});

// polish-j batch 6 item 3 — goal.targetDate can arrive as a full
// ISO-datetime string (not a plain YYYY-MM-DD). Passed straight through as
// the edit dialog's `deadline` initial value, `DateField`'s
// `formatFullDate` used to `.split("-")` it, get a NaN day, and render the
// literal string "Invalid Date" in the "Target Tanggal" field.
describe("TujuanPage — edit dialog Target Tanggal (polish-j batch 6 item 3)", () => {
  it("shows a correctly formatted date, not 'Invalid Date', when targetDate is an ISO-datetime string", async () => {
    mockSession("owner", {
      goalOverrides: { targetDate: "2026-12-01T00:00:00.000Z" },
    });
    const user = userEvent.setup();
    render(<TujuanPage />);

    const detail = await openGoalDetail(user, "Dana Liburan");
    await user.click(within(detail).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const deadlineTrigger = within(dialog).getByLabelText("Target Tanggal");

    expect(deadlineTrigger).not.toHaveTextContent("Invalid Date");
    expect(deadlineTrigger).toHaveTextContent("1 Desember 2026");
  });
});

describe("TujuanPage — edit auto-debit (Revisi F final-review Finding 1/3)", () => {
  it("Finding 1: clearing the auto-debit amount on edit sends autoDebitAmount: null explicitly", async () => {
    // targetDate: null — the "Saran: ... / bulan" helper hint (rendered
    // INSIDE the same <label>, per crud-modal.tsx) only computes when a
    // deadline is set; keeping it null keeps the label's accessible name
    // exactly "Auto-debit / Bulan" so `getByLabelText` stays unambiguous,
    // same as the passing create-flow tests above.
    mockSession("owner", {
      goalOverrides: {
        autoDebitAmount: 500_000,
        sourceAccountId: ACCOUNT.id,
        targetDate: null,
      },
    });
    const user = userEvent.setup();
    render(<TujuanPage />);

    const detail = await openGoalDetail(user, "Dana Liburan");
    await user.click(within(detail).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const autodebitInput = within(dialog).getByLabelText("Auto-debit / Bulan");
    expect(autodebitInput).toHaveValue("500.000");
    await user.clear(autodebitInput);
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const patch = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path === `/family-groups/${FAMILY_GROUP_ID}/goals/goal-1` &&
        (options as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patch).toBeDefined();
    const body = JSON.parse((patch?.[1] as RequestInit).body as string);
    expect(body.autoDebitAmount).toBeNull();
  }, 30000);

  it("Finding 3: a name-only edit of a legacy auto-debit goal (no source account) saves without the source-account guard", async () => {
    mockSession("owner", {
      goalOverrides: { autoDebitAmount: 500_000, sourceAccountId: null },
    });
    const user = userEvent.setup();
    render(<TujuanPage />);

    const detail = await openGoalDetail(user, "Dana Liburan");
    await user.click(within(detail).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Dana Liburan"),
      " Renamed",
    );
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(mockToastError).not.toHaveBeenCalledWith(
      "Pilih rekening sumber untuk auto-debit.",
    );
    const patch = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path === `/family-groups/${FAMILY_GROUP_ID}/goals/goal-1` &&
        (options as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patch).toBeDefined();
  }, 30000);
});

describe("TujuanPage — bento hero KPIs", () => {
  it("shows the hero KPIs, and 'Perlu perhatian' shows the all-good state when every goal is on track", async () => {
    // audit P1-5/AC-5 — "Perlu perhatian" must show exactly one unambiguous
    // status signal: an on-track goal must never appear under a "needs
    // attention" heading. With only an on-track goal, the panel shows the
    // all-good empty state instead of padding in that goal as a row.
    // On track means a plan that reaches the target: an auto-debit large
    // enough to close the 9 jt gap by the target date.
    mockSession("owner", {
      goalOverrides: { autoDebitAmount: 9_000_000, autoDebitDay: 25 },
    });
    render(<TujuanPage />);

    await screen.findByText("Dana Liburan");
    // The KPI label and the goal's own status chip now share the wording.
    expect(screen.getAllByText("Sesuai rencana").length).toBeGreaterThan(0);
    expect(screen.getByText("Perlu perhatian")).toBeInTheDocument();
    expect(
      screen.getByText("Semua tujuan berjalan sesuai rencana."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dana Liburan 10%")).not.toBeInTheDocument();
  });

  it("lists a goal that needs a push under 'Perlu perhatian'", async () => {
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
    mockApiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/access/me")) {
        return Promise.resolve(
          resolveEffectiveAccess({ role: "owner" as MemberRoleKey }),
        );
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      if (path.endsWith("/goals")) {
        return Promise.resolve([
          buildGoal({}),
          buildGoal({
            id: "goal-2",
            name: "Rumah Baru",
            status: "needs_boost",
            progressPercent: 5,
          }),
        ]);
      }
      return Promise.resolve([]);
    });
    render(<TujuanPage />);

    await screen.findByText("Dana Liburan");
    await screen.findByText("Rumah Baru");
    expect(screen.getByText("Perlu perhatian")).toBeInTheDocument();
    expect(screen.getByText("Rumah Baru 5%")).toBeInTheDocument();
  });
});
