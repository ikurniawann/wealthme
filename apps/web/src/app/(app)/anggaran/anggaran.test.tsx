/**
 * EPIC-022 Group F (F3) — CASL grants "manage Budget" to owner/spouse/member
 * but "manage Category" only to owner/spouse. A `member` adding a budget
 * used to always hit the create-a-category flow first, which 403s for them
 * (they only "read Category") — the budget could never actually be created.
 * Locks in: a `member` sees the "pick an existing category" picker instead
 * of the create-category fields, and the submit path never POSTs
 * /categories for that role — only POSTs /budgets against the picked id.
 * An owner still sees the original create-category flow (regression guard).
 */

import type { ReactElement, ReactNode } from "react";
import {
  resolveEffectiveAccess,
  type MemberRoleKey,
} from "@wealthme/contracts";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

import AnggaranPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";
const EXISTING_CATEGORY = { id: "cat-1", name: "Makanan", kind: "expense" };

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

const EXISTING_BUDGET = {
  id: "budget-1",
  categoryId: EXISTING_CATEGORY.id,
  categoryName: EXISTING_CATEGORY.name,
  categoryIcon: "🛒",
  period: "monthly",
  limitAmount: 500_000,
  spentAmount: 100_000,
  remainingAmount: 400_000,
  usagePercent: 20,
  isOverBudget: false,
  isNearLimit: false,
  budgetType: null,
  autoDebitDay: 25,
};

function mockSession(
  role: string,
  { withExistingBudget = false }: { withExistingBudget?: boolean } = {},
) {
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
    if (path.endsWith(`/budgets/${EXISTING_BUDGET.id}`)) {
      if (options?.method === "PATCH") {
        return Promise.resolve({
          ...EXISTING_BUDGET,
          ...JSON.parse((options.body as string) ?? "{}"),
        });
      }
      if (options?.method === "DELETE") {
        return Promise.resolve(undefined);
      }
    }
    if (path.endsWith("/budgets")) {
      if (options?.method === "POST") {
        return Promise.resolve({
          id: "budget-1",
          categoryId: EXISTING_CATEGORY.id,
          categoryName: EXISTING_CATEGORY.name,
          categoryIcon: null,
          period: "monthly",
          limitAmount: 500_000,
          spentAmount: 0,
          remainingAmount: 500_000,
          usagePercent: 0,
          isOverBudget: false,
          isNearLimit: false,
          budgetType: null,
        });
      }
      return Promise.resolve(withExistingBudget ? [EXISTING_BUDGET] : []);
    }
    if (path.endsWith("/coa-accounts")) {
      return Promise.resolve([]);
    }
    if (path.endsWith("/categories")) {
      return Promise.resolve([EXISTING_CATEGORY]);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
});

describe("AnggaranPage — member picks an existing category, never creates one (F3)", () => {
  it("shows the existing-category picker (not the create-category fields) and submits without POSTing /categories", async () => {
    mockSession("member");
    const user = userEvent.setup();
    render(<AnggaranPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Kategori" }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText("Kategori");

    // Create-a-category fields are gone for a member.
    expect(
      within(dialog).queryByLabelText("Nama Kategori"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText("Kategori Privat"),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      within(dialog).getByLabelText("Kategori"),
      EXISTING_CATEGORY.id,
    );
    await user.type(
      within(dialog).getByLabelText("Budget per Bulan (Rp)"),
      "500000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Kategori" }),
    );

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    const categoryPosts = mockApiFetch.mock.calls.filter(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith("/categories") &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    expect(categoryPosts).toHaveLength(0);

    const budgetPosts = mockApiFetch.mock.calls.filter(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith("/budgets") &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    expect(budgetPosts).toHaveLength(1);
    const body = JSON.parse(
      (budgetPosts[0]?.[1] as RequestInit).body as string,
    );
    expect(body.categoryId).toBe(EXISTING_CATEGORY.id);
  }, 10000);
});

describe("AnggaranPage — owner still creates a new category (regression guard)", () => {
  it("shows the create-category fields, not the existing-category picker", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<AnggaranPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Kategori" }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText("Nama Kategori");

    expect(within(dialog).queryByLabelText("Kategori")).not.toBeInTheDocument();
    // The create-category form mounts the full EmojiPicker grid in jsdom
    // (~2.5s alone, 10s+ when the whole suite runs in parallel).
  }, 30000);
});

describe("AnggaranPage — edit and delete a budget (EPIC-022 C2)", () => {
  it("an owner can edit an existing budget's limit and period via PATCH", async () => {
    mockSession("owner", { withExistingBudget: true });
    const user = userEvent.setup();
    render(<AnggaranPage />);

    await user.click(
      await screen.findByRole("button", {
        name: `Edit anggaran ${EXISTING_CATEGORY.name}`,
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit Anggaran" });
    const amountInput = within(dialog).getByLabelText("Budget per Bulan (Rp)");
    await user.clear(amountInput);
    await user.type(amountInput, "750000");
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Perubahan" }),
    );

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    const patchCalls = mockApiFetch.mock.calls.filter(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith(`/budgets/${EXISTING_BUDGET.id}`) &&
        (options as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patchCalls).toHaveLength(1);
    const body = JSON.parse((patchCalls[0]?.[1] as RequestInit).body as string);
    expect(body.limitAmount).toBe(750000);
    expect(body.period).toBe("monthly");
  }, 10000);

  it("an owner can delete an existing budget via DELETE, after confirming", async () => {
    mockSession("owner", { withExistingBudget: true });
    const user = userEvent.setup();
    render(<AnggaranPage />);

    await user.click(
      await screen.findByRole("button", {
        name: `Hapus anggaran ${EXISTING_CATEGORY.name}`,
      }),
    );
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Hapus Anggaran?",
    });
    await user.click(
      within(confirmDialog).getByRole("button", { name: "Ya, Hapus" }),
    );

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    const deleteCalls = mockApiFetch.mock.calls.filter(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith(`/budgets/${EXISTING_BUDGET.id}`) &&
        (options as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCalls).toHaveLength(1);
  }, 10000);

  it("a role without manage Budget sees no edit/delete controls", async () => {
    mockSession("admin_staff", { withExistingBudget: true });
    render(<AnggaranPage />);

    await screen.findAllByText(EXISTING_CATEGORY.name);
    expect(
      screen.queryByRole("button", {
        name: `Edit anggaran ${EXISTING_CATEGORY.name}`,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: `Hapus anggaran ${EXISTING_CATEGORY.name}`,
      }),
    ).not.toBeInTheDocument();
  }, 10000);
});

describe("AnggaranPage — budgets carry no auto-debit (Revisi F item 4)", () => {
  it("shows no auto-debit day on the list, none in the edit dialog, and PATCH never sends one", async () => {
    mockSession("owner", { withExistingBudget: true });
    const user = userEvent.setup();
    render(<AnggaranPage />);

    const editButton = await screen.findByRole("button", {
      name: `Edit anggaran ${EXISTING_CATEGORY.name}`,
    });
    expect(screen.queryByText(/autodebet tgl/i)).not.toBeInTheDocument();

    await user.click(editButton);
    const dialog = await screen.findByRole("dialog", { name: "Edit Anggaran" });
    expect(
      within(dialog).queryByLabelText(/Auto-debet/i),
    ).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Perubahan" }),
    );

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const patch = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith(`/budgets/${EXISTING_BUDGET.id}`) &&
        (options as RequestInit | undefined)?.method === "PATCH",
    );
    const body = JSON.parse((patch?.[1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("autoDebitDay");
  }, 10000);

  it("the add dialog offers no auto-debit day field", async () => {
    mockSession("member");
    const user = userEvent.setup();
    render(<AnggaranPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Kategori" }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText("Kategori");
    expect(
      within(dialog).queryByLabelText(/Auto-debet/i),
    ).not.toBeInTheDocument();
  }, 10000);
});
