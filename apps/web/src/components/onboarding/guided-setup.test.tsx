/**
 * EPIC-023 Task H3 (D22, US-DASH-7) — behavioral coverage for the guided
 * first setup that replaces the old button tour: it must create REAL rows
 * through the real endpoints, show the consequence of each write, resume
 * after being abandoned mid-way, let a step be skipped when the row already
 * exists, and never pretend a failed write succeeded.
 */

import { useState, type ReactElement, type ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseSessionAuth = jest.fn();
jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastWarning = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  }),
}));

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";
const USER_ID = "user-1";

type BudgetFixture = {
  id: string;
  categoryId: string;
  categoryName: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usagePercent: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  budgetType: null;
  period: string;
};

let accountsStore: { id: string; name: string }[] = [];
let budgetsStore: BudgetFixture[] = [];
let netWorthQueue: number[] = [];
let heldTransaction = false;
let failAccountCreate = false;

function nextNetWorth(): number {
  return netWorthQueue.length > 1
    ? (netWorthQueue.shift() as number)
    : (netWorthQueue[0] ?? 0);
}

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? "GET";

    if (url.endsWith("/dashboard/summary")) {
      return Promise.resolve({ netWorth: nextNetWorth() });
    }
    if (url.endsWith("/accounts") && method === "GET") {
      return Promise.resolve(accountsStore);
    }
    if (url.endsWith("/accounts") && method === "POST") {
      if (failAccountCreate) {
        return Promise.reject({ status: 500, message: "boom" });
      }
      const body = JSON.parse(options?.body as string) as { name: string };
      const acc = { id: "acc-new", name: body.name };
      accountsStore = [...accountsStore, acc];
      return Promise.resolve(acc);
    }
    if (url.endsWith("/budgets") && method === "GET") {
      return Promise.resolve(budgetsStore);
    }
    if (url.endsWith("/budgets") && method === "POST") {
      const body = JSON.parse(options?.body as string) as {
        categoryId: string;
        limitAmount: number;
        period: string;
      };
      const budget: BudgetFixture = {
        id: "budget-new",
        categoryId: body.categoryId,
        categoryName: "Makan & Minum",
        limitAmount: body.limitAmount,
        spentAmount: 0,
        remainingAmount: body.limitAmount,
        usagePercent: 0,
        isOverBudget: false,
        isNearLimit: false,
        budgetType: null,
        period: body.period,
      };
      budgetsStore = [...budgetsStore, budget];
      return Promise.resolve(budget);
    }
    if (url.endsWith("/categories") && method === "POST") {
      return Promise.resolve({ id: "cat-new" });
    }
    if (url.endsWith("/transactions") && method === "POST") {
      if (heldTransaction) {
        return Promise.resolve({ held: true });
      }
      budgetsStore = budgetsStore.map((b) => ({
        ...b,
        spentAmount: 150_000,
        usagePercent: 30,
      }));
      return Promise.resolve({ id: "tx-new" });
    }
    return Promise.resolve({});
  },
);
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

import { GuidedSetup } from "./guided-setup";
import { isOnboarded } from "./use-onboarded";
import { getSetupProgress, setSetupProgress } from "./setup-progress";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function render(ui: ReactElement, queryClient = createTestQueryClient()) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, ...rtlRender(ui, { wrapper: Providers }) };
}

// Several tests here drive all three wizard steps end to end to reach the
// done screen, so they are long by nature. `userEvent`'s default per-keystroke
// delay is pure harness overhead and is disabled at every setup below, which
// is what actually made them fast (the happy path went from timing out to
// ~0.7s). This ceiling is headroom for GitHub's shared runner, which is
// several times slower than a dev machine — it relaxes no assertion, and it
// is set for the file so a newly-added multi-step test does not rediscover
// the same 5s default one CI run at a time.
jest.setTimeout(30_000);

describe("GuidedSetup, guided first setup (EPIC-023 H3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    accountsStore = [];
    budgetsStore = [];
    heldTransaction = false;
    failAccountCreate = false;
    netWorthQueue = [0, 5_000_000, 4_700_000];

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: USER_ID, name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("creates a real account, budget, and transaction, and shows the consequence of each", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = jest.fn();
    const { queryClient } = render(<GuidedSetup open onClose={onClose} />);
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    // Step 1 — account.
    await screen.findByText("Tambahkan rekening pertamamu");
    await user.type(screen.getByLabelText("Nama Rekening"), "BCA Tabungan");
    await user.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
    await user.click(
      screen.getByRole("button", {
        name: "Tambah Rekening & Lihat Kekayaan Bersih",
      }),
    );

    // Consequence — net worth appears (before/after).
    const accountConsequenceHeading = await screen.findByText(
      "Lihat, kekayaan bersihmu langsung muncul",
    );
    expect(screen.getByText(/Sebelum: Rp 0/)).toBeInTheDocument();
    expect(screen.getByText(/Sesudah: Rp 5\.000\.000/)).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/accounts`,
      expect.objectContaining({ method: "POST" }),
    );
    // CRITICAL 2 — focus must move to the consequence heading the instant
    // it appears, not stay on the now-disabled submit button (which blurs
    // to <body>). The `step` value does NOT change for this transition, so
    // this only passes if the focus effect also depends on the consequence
    // state.
    await waitFor(() => expect(accountConsequenceHeading).toHaveFocus());
    // CRITICAL 1 — the pages underneath (Rekening, Beranda) are cached
    // TanStack Query reads; without invalidation they'd still show the
    // stale pre-wizard data after this dialog closes.
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["accounts", FAMILY_GROUP_ID] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["netWorth", FAMILY_GROUP_ID],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    // Step 2 — budget.
    await screen.findByText("Buat anggaran pertamamu");
    await user.type(screen.getByLabelText("Nama Kategori"), "Makan & Minum");
    await user.type(screen.getByLabelText("Batas Bulanan"), "2000000");
    await user.click(screen.getByRole("button", { name: "Buat Anggaran" }));

    const budgetConsequenceHeading = await screen.findByText(
      "Anggaran siap, 0% terpakai",
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/budgets`,
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() => expect(budgetConsequenceHeading).toHaveFocus());
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["budgets", FAMILY_GROUP_ID] }),
    );
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    // Step 3 — transaction.
    await screen.findByText("Catat pengeluaran pertamamu");
    await user.type(screen.getByLabelText("Jumlah"), "150000");
    await user.click(
      screen.getByRole("button", { name: "Catat & Lihat Perubahannya" }),
    );

    // Consequence — net worth moves AND the budget usage rises together.
    const txConsequenceHeading = await screen.findByText(
      "Lihat, dua hal berubah sekaligus",
    );
    expect(screen.getByText(/Rp 4\.700\.000/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/transactions`,
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() => expect(txConsequenceHeading).toHaveFocus());
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["transactions", FAMILY_GROUP_ID],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    // Step 4 — done. Finishing marks onboarded and clears resumable state.
    await screen.findByText("Setup pertamamu selesai");
    await user.click(screen.getByRole("button", { name: "Selesai" }));

    expect(onClose).toHaveBeenCalled();
    expect(isOnboarded(USER_ID)).toBe(true);
    expect(getSetupProgress(USER_ID)).toBeNull();
  });

  it("lets a step be skipped when the family already has one, instead of creating a duplicate", async () => {
    accountsStore = [{ id: "acc-existing", name: "Rekening Lama" }];
    const user = userEvent.setup({ delay: null });
    render(<GuidedSetup open onClose={jest.fn()} />);

    await screen.findByText("Kamu sudah punya rekening tercatat.");
    await user.click(
      screen.getByRole("button", { name: "Lewati langkah ini" }),
    );

    // Advances straight to the budget step — no POST to /accounts happened.
    await screen.findByText("Buat anggaran pertamamu");
    const wroteAccount = mockApiFetch.mock.calls.some(
      ([url, opts]) => url.endsWith("/accounts") && opts?.method === "POST",
    );
    expect(wroteAccount).toBe(false);
  });

  it("resumes from the exact step it left off after being closed mid-way", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = jest.fn();
    const { unmount } = render(<GuidedSetup open onClose={onClose} />);

    await screen.findByText("Tambahkan rekening pertamamu");
    await user.type(screen.getByLabelText("Nama Rekening"), "BCA Tabungan");
    await user.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
    await user.click(
      screen.getByRole("button", {
        name: "Tambah Rekening & Lihat Kekayaan Bersih",
      }),
    );
    await screen.findByText("Lihat, kekayaan bersihmu langsung muncul");

    // Abandon mid-way: close without finishing. Progress must be saved and
    // the user must NOT be marked onboarded (they can still be re-prompted).
    onClose();
    unmount();
    expect(isOnboarded(USER_ID)).toBe(false);
    expect(getSetupProgress(USER_ID)?.step).toBe("budget");

    // Re-open: resumes directly at the budget step, not back at account.
    render(<GuidedSetup open onClose={jest.fn()} />);
    await screen.findByText("Buat anggaran pertamamu");
    expect(
      screen.queryByText("Tambahkan rekening pertamamu"),
    ).not.toBeInTheDocument();
  });

  it("shows an error and stays on the step when the create call fails", async () => {
    failAccountCreate = true;
    const user = userEvent.setup({ delay: null });
    render(<GuidedSetup open onClose={jest.fn()} />);

    await screen.findByText("Tambahkan rekening pertamamu");
    await user.type(screen.getByLabelText("Nama Rekening"), "BCA Tabungan");
    await user.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
    await user.click(
      screen.getByRole("button", {
        name: "Tambah Rekening & Lihat Kekayaan Bersih",
      }),
    );

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Gagal membuat rekening. Coba lagi.",
      ),
    );
    // Still on the account step's form — no consequence panel, no advance.
    expect(
      screen.getByRole("button", {
        name: "Tambah Rekening & Lihat Kekayaan Bersih",
      }),
    ).toBeInTheDocument();
    expect(getSetupProgress(USER_ID)).toBeNull();
  });

  it("honestly reports a held (over-threshold) expense instead of claiming a transaction was created", async () => {
    accountsStore = [{ id: "acc-existing", name: "Rekening Lama" }];
    budgetsStore = [
      {
        id: "budget-existing",
        categoryId: "cat-existing",
        categoryName: "Makan & Minum",
        limitAmount: 1_000_000,
        spentAmount: 0,
        remainingAmount: 1_000_000,
        usagePercent: 0,
        isOverBudget: false,
        isNearLimit: false,
        budgetType: null,
        period: "monthly",
      },
    ];
    heldTransaction = true;
    const user = userEvent.setup({ delay: null });
    render(<GuidedSetup open onClose={jest.fn()} />);

    await screen.findByText("Kamu sudah punya rekening tercatat.");
    await user.click(
      screen.getByRole("button", { name: "Lewati langkah ini" }),
    );
    await screen.findByText("Kamu sudah punya anggaran tercatat.");
    await user.click(
      screen.getByRole("button", { name: "Lewati langkah ini" }),
    );

    await screen.findByText("Catat pengeluaran pertamamu");
    await user.type(screen.getByLabelText("Jumlah"), "9000000");
    await user.click(
      screen.getByRole("button", { name: "Catat & Lihat Perubahannya" }),
    );

    await waitFor(() =>
      expect(mockToastWarning).toHaveBeenCalledWith(
        "Pengeluaran ini melewati batas dan menunggu persetujuan, belum tercatat sebagai transaksi.",
      ),
    );
    await screen.findByText("Setup pertamamu selesai");
    expect(
      screen.getByText(/Pengeluaran terakhir melewati batas keluargamu/),
    ).toBeInTheDocument();
    // HIGH 3 — a held expense becomes an AllowanceRequest, not a
    // Transaction; /transaksi has no query for it at all, so the CTA that
    // would send the user there must not be offered for this outcome.
    expect(
      screen.queryByRole("button", { name: "Lihat Transaksi" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lihat Rekening" }),
    ).toBeInTheDocument();
  });

  it("clicking a done-step nav button closes the wizard before navigating (MEDIUM 9)", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = jest.fn();
    render(<GuidedSetup open onClose={onClose} />);

    await screen.findByText("Tambahkan rekening pertamamu");
    await user.type(screen.getByLabelText("Nama Rekening"), "BCA Tabungan");
    await user.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
    await user.click(
      screen.getByRole("button", {
        name: "Tambah Rekening & Lihat Kekayaan Bersih",
      }),
    );
    await screen.findByText("Lihat, kekayaan bersihmu langsung muncul");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    await screen.findByText("Buat anggaran pertamamu");
    await user.type(screen.getByLabelText("Nama Kategori"), "Makan & Minum");
    await user.type(screen.getByLabelText("Batas Bulanan"), "2000000");
    await user.click(screen.getByRole("button", { name: "Buat Anggaran" }));
    await screen.findByText("Anggaran siap, 0% terpakai");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    await screen.findByText("Catat pengeluaran pertamamu");
    await user.type(screen.getByLabelText("Jumlah"), "150000");
    await user.click(
      screen.getByRole("button", { name: "Catat & Lihat Perubahannya" }),
    );
    await screen.findByText("Lihat, dua hal berubah sekaligus");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    await screen.findByText("Setup pertamamu selesai");
    await user.click(screen.getByRole("button", { name: "Lihat Rekening" }));

    // Previously this only navigated — the dialog stayed open and blocked
    // the very page the button just routed to.
    expect(onClose).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith("/rekening");
  });

  it("tells the user what was already created before closing via Skip Setup (MEDIUM 8)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<GuidedSetup open onClose={jest.fn()} />);

    await screen.findByText("Tambahkan rekening pertamamu");
    await user.type(screen.getByLabelText("Nama Rekening"), "BCA Tabungan");
    await user.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
    await user.click(
      screen.getByRole("button", {
        name: "Tambah Rekening & Lihat Kekayaan Bersih",
      }),
    );
    await screen.findByText("Lihat, kekayaan bersihmu langsung muncul");

    await user.click(screen.getByRole("button", { name: "Lewati Setup" }));

    // The account is real and already created — closing without saying so
    // would be the only chance the user ever gets to hear it was kept.
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Yang sudah kamu buat tetap tersimpan: Rekening",
    );
  });

  it("restarts from the account step when a resumed accountId no longer exists (MEDIUM 7)", async () => {
    setSetupProgress(USER_ID, {
      step: "budget",
      accountId: "acc-deleted-by-another-member",
      accountName: "Rekening Yang Sudah Dihapus",
    });
    const user = userEvent.setup({ delay: null });
    render(<GuidedSetup open onClose={jest.fn()} />);

    // The saved progress pointed at "budget", but that account is gone
    // from `accountsStore` (empty in this test) — resuming there would
    // make the eventual POST fail server-side forever.
    await screen.findByText("Tambahkan rekening pertamamu");
    expect(
      screen.queryByText("Buat anggaran pertamamu"),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Nama Rekening"), "BCA Tabungan");
    await user.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
    await user.click(
      screen.getByRole("button", {
        name: "Tambah Rekening & Lihat Kekayaan Bersih",
      }),
    );
    // Creating fresh works — the dangling id didn't get reused.
    await screen.findByText("Lihat, kekayaan bersihmu langsung muncul");
  });

  it("restores focus to whatever opened it once it closes (HIGH 6)", async () => {
    const user = userEvent.setup({ delay: null });
    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Mulai Tur
          </button>
          <GuidedSetup open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Wrapper />);

    const openerButton = screen.getByRole("button", { name: "Mulai Tur" });
    await user.click(openerButton);
    await screen.findByText("Tambahkan rekening pertamamu");

    await user.click(screen.getByRole("button", { name: "Lewati Setup" }));
    await waitFor(() => expect(openerButton).toHaveFocus());
  });
});
