/**
 * EPIC-022 A5 — "deleting a category silently destroys budgets and
 * allow-lists". The API now rejects with a 409 naming exactly which
 * budgets/allowances are attached (categories.service.spec.ts); this locks
 * in the UI half: /masterdata must surface that real message instead of a
 * generic "gagal menghapus kategori" toast.
 *
 * EPIC-024 Task J (D14, US-MD-1) — the seven reference lists are now real
 * API-backed data, not a hardcoded local array. Locks in: seeded items show
 * a "Bawaan" badge and no delete button; owner-added items add via a real
 * POST and can be deleted via a real DELETE.
 */

import type { ReactElement, ReactNode } from "react";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CategoryDto, ReferenceItemDto } from "@wealthme/contracts";

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
  }),
}));

// MasterDataPage calls useRouter() (next/navigation) — not present without a
// real Next.js App Router, so it must be mocked in a component test.
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// jsdom has no PointerEvent — Base UI's Dialog primitives read pointer-event
// fields internally, so the ConfirmDeleteDialog needs this polyfilled (same
// fix as dana/dana.test.tsx).
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

import MasterDataPage from "./page";
import { useReferenceItems } from "../../../hooks/use-reference-items";

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

function buildCategory(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return {
    id: "cat-1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Belanja",
    kind: "expense",
    color: null,
    icon: "🛒",
    isPrivate: false,
    coaAccountId: "coa-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildReferenceItem(
  overrides: Partial<ReferenceItemDto> = {},
): ReferenceItemDto {
  return {
    id: "ref-1",
    familyGroupId: FAMILY_GROUP_ID,
    group: "bank",
    label: "BCA",
    sortOrder: 0,
    isSystem: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MasterDataPage, category delete surfaces the real server message (EPIC-022 A5)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("surfaces the API's 409 message instead of the generic delete-failed toast", async () => {
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/coa-accounts")) return Promise.resolve([]);
      // F3 — `useCanManage("Category")` resolves the signed-in role via
      // this endpoint; an "owner" role keeps the edit/delete affordances
      // this suite asserts on visible.
      // EPIC-030 — menu/permission gating reads the resolved IAM access.
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      if (options?.method === "DELETE") {
        return Promise.reject({
          status: 409,
          message:
            "Kategori ini dipakai 2 anggaran. Hapus atau ubah dulu sebelum menghapus kategori ini.",
        });
      }
      return Promise.resolve([buildCategory()]);
    });
    const user = userEvent.setup();
    render(<MasterDataPage />);

    // The category row is "🛒 Belanja" as one text run (icon + space + name
    // in the same <span>) — match by substring, not an exact string.
    await screen.findByText(/Belanja/);
    await user.click(screen.getByRole("button", { name: /Hapus Belanja/i }));
    await user.click(await screen.findByRole("button", { name: "Ya, Hapus" }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Kategori ini dipakai 2 anggaran. Hapus atau ubah dulu sebelum menghapus kategori ini.",
    );
  });
});

describe("MasterDataPage, reference items are real API-backed data (EPIC-024 Task J)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  function stubApiFetch(referenceItems: ReferenceItemDto[]) {
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/coa-accounts")) return Promise.resolve([]);
      // F3 — `useCanManage("Category"/"ReferenceItem")` resolves the role
      // via this endpoint; an "owner" role keeps the add/delete affordances
      // this suite asserts on visible.
      // EPIC-030 — menu/permission gating reads the resolved IAM access.
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      if (path.includes("/reference-items")) {
        if (options?.method === "POST") {
          return Promise.resolve(
            buildReferenceItem({ id: "ref-new", isSystem: false }),
          );
        }
        if (options?.method === "DELETE") return Promise.resolve(undefined);
        return Promise.resolve(referenceItems);
      }
      if (path.includes("/categories")) return Promise.resolve([]);
      return Promise.resolve([]);
    });
  }

  it("shows a seeded ('Bawaan') item with no delete button, the API protects it, so the UI does not offer an action that will 403", async () => {
    stubApiFetch([buildReferenceItem({ label: "BCA", isSystem: true })]);
    render(<MasterDataPage />);

    await screen.findByText("BCA");
    expect(screen.getByText("Bawaan")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hapus BCA/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a delete button for an owner-added (non-system) item", async () => {
    stubApiFetch([
      buildReferenceItem({
        id: "ref-2",
        label: "Bank Jago",
        isSystem: false,
      }),
    ]);
    render(<MasterDataPage />);

    await screen.findByText("Bank Jago");
    expect(
      screen.getByRole("button", { name: /Hapus Bank Jago/i }),
    ).toBeInTheDocument();
  });

  it("adding an item POSTs {group, label} to the real reference-items API, no more 'bawaan sistem' toast", async () => {
    stubApiFetch([]);
    const user = userEvent.setup();
    render(<MasterDataPage />);

    await screen.findByText("Bank");
    // Render order is Kategori, then Bank (first of the seven reference
    // groups) — "+ Tambah" (index 1) opens the Bank add modal. `findAllByRole`
    // (not `getAllByRole`) — F3 role-gating hides these links until
    // `useCanManage`'s own role fetch resolves (mocked "owner" above).
    const addButtons = await screen.findAllByRole("button", {
      name: "+ Tambah",
    });
    await user.click(addButtons[1]);

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Bank Jago"),
      "Bank Neo",
    );
    await user.click(within(dialog).getByRole("button", { name: /Simpan/i }));

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/reference-items`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ group: "bank", label: "Bank Neo" }),
      }),
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("deleting a non-system item DELETEs the real reference-items API", async () => {
    stubApiFetch([
      buildReferenceItem({ id: "ref-3", label: "Bank Jago", isSystem: false }),
    ]);
    const user = userEvent.setup();
    render(<MasterDataPage />);

    await screen.findByText("Bank Jago");
    await user.click(screen.getByRole("button", { name: /Hapus Bank Jago/i }));
    await user.click(await screen.findByRole("button", { name: "Ya, Hapus" }));

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/reference-items/ref-3`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("shows only Bank, E-Wallet and Lembaga Donasi; enum-duplicate groups and their old rows are gone (Revisi H)", async () => {
    stubApiFetch([
      buildReferenceItem({ id: "r-bank", group: "bank", label: "BCA" }),
      buildReferenceItem({
        id: "r-txn",
        group: "txntype",
        label: "Kartu Kredit",
      }),
      buildReferenceItem({ id: "r-inv", group: "invtype", label: "Crypto" }),
      buildReferenceItem({
        id: "r-lem",
        group: "lembaga",
        label: "BAZNAS",
      }),
    ]);
    render(<MasterDataPage />);

    await screen.findByText("BAZNAS");
    expect(screen.getByText("Lembaga Donasi")).toBeInTheDocument();
    expect(screen.getByText("E-Wallet")).toBeInTheDocument();
    expect(screen.queryByText("Kartu Kredit")).not.toBeInTheDocument();
    expect(screen.queryByText("Crypto")).not.toBeInTheDocument();
    for (const title of [
      /Jenis Transaksi/,
      /Jenis Investasi/,
      /Kategori Aset/,
      /Jenis Asuransi/,
    ]) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });
});

describe("MasterDataPage, a new item reaches every form reading the same group (Revisi H)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  function BankProbe() {
    const { items } = useReferenceItems("bank");
    return (
      <ul aria-label="bank-probe">
        {items.map((i) => (
          <li key={i.id}>{i.label}</li>
        ))}
      </ul>
    );
  }

  it("adding a bank in Master Data refreshes a form-side useReferenceItems('bank') consumer", async () => {
    let list: ReferenceItemDto[] = [
      buildReferenceItem({ id: "ref-bca", label: "BCA" }),
    ];
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/coa-accounts")) return Promise.resolve([]);
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      if (path.includes("/reference-items")) {
        if (options?.method === "POST") {
          const body = JSON.parse(String(options.body)) as {
            group: ReferenceItemDto["group"];
            label: string;
          };
          const created = buildReferenceItem({
            id: "ref-new",
            group: body.group,
            label: body.label,
            isSystem: false,
          });
          list = [...list, created];
          return Promise.resolve(created);
        }
        return Promise.resolve(list);
      }
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    render(
      <>
        <MasterDataPage />
        <BankProbe />
      </>,
    );

    const probe = await screen.findByRole("list", { name: "bank-probe" });
    await within(probe).findByText("BCA");

    const addButtons = await screen.findAllByRole("button", {
      name: "+ Tambah",
    });
    await user.click(addButtons[1]);
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Bank Jago"),
      "Bank Tes MD",
    );
    await user.click(within(dialog).getByRole("button", { name: /Simpan/i }));

    expect(await within(probe).findByText("Bank Tes MD")).toBeInTheDocument();
  });
});
