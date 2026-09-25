/**
 * EPIC-022 A2 — "Negative cash balance sign is silently flipped". /rekening
 * lists every account type (including `cash`), but always opened the
 * "Rekening Bank" CRUD entity for editing — whose "Saldo" field has no
 * `allowNegative`, so a cash account holding e.g. -Rp 75.000 pre-filled the
 * edit form as +75.000, and an untouched save re-persisted the positive
 * sign with a success toast. This locks in the fix: a `cash` account now
 * opens the "cash" CRUD entity (the one already used correctly by /dana),
 * preserves the sign, and resends `type: "cash"` on the PATCH so the API's
 * per-type negative-balance allowance still applies on a partial update.
 */

import type { ReactElement, ReactNode } from "react";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AccountDto } from "@wealthme/contracts";

// `./page` imports `auth-compat`, which re-exports the `better-auth` React
// client (ESM, unparsable by jest without a transform) — mock it before
// `./page` is required, same pattern as every other `(app)/**/*.test.tsx`.
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

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// RekeningPage's AccountCardItem calls useRouter() (next/navigation) — not
// present without a real Next.js App Router, so it must be mocked in a
// component test (same fix as beranda/beranda.test.tsx).
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

import RekeningPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

// jsdom has no PointerEvent — Base UI's Dialog/DropdownMenu primitives read
// pointer-event fields internally, so opening the kebab menu and the CrudModal
// dialog needs this polyfilled (same fix as dana/dana.test.tsx).
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

function buildAccount(overrides: Partial<AccountDto> = {}): AccountDto {
  return {
    id: "acc-1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Tabungan Utama",
    type: "bank",
    institution: "BCA",
    maskedNumber: null,
    balance: "500000",
    currency: "IDR",
    isPrivate: false,
    ownerUserId: null,
    ownerName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Routes `apiFetch` calls by path/method instead of one blanket mock, since
 * this page fires 3 GETs (accounts, members, fx rates) plus the PATCH under
 * test. */
function mockApiRoutes(accounts: AccountDto[]) {
  mockApiFetch.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (options?.method === "PATCH") {
        return Promise.resolve({ id: "acc-1" });
      }
      if (path.endsWith("/members")) {
        return Promise.resolve([]);
      }
      if (path.startsWith("/fx/rates")) {
        return Promise.resolve({ base: "IDR", rates: {} });
      }
      // F3 — `useCanManage`/`useMyRole` resolve the signed-in role via this
      // endpoint; an "owner" role keeps every create/edit/delete affordance
      // this suite already asserts on visible (CASL grants owner "manage
      // Account" — see casl-ability.factory.ts).
      // EPIC-030 — menu/permission gating reads the resolved IAM access.
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      return Promise.resolve(accounts);
    },
  );
}

describe("RekeningPage, ownership labels and bank edit (EPIC-022 A2)", () => {
  beforeEach(() => {
    // `resetAllMocks` (not `clearAllMocks`) — a prior test's queued
    // `mockResolvedValueOnce`/`mockImplementation` must not survive.
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

  // Revisi — a family-shared account is labelled "Bersama"; an owned one
  // shows its owner instead.
  it("labels a family-shared account 'Bersama' and an owned one by owner", async () => {
    mockApiRoutes([
      buildAccount({ id: "acc-shared", name: "Tabungan Keluarga" }),
      buildAccount({
        id: "acc-owned",
        name: "Rekening Adit",
        ownerUserId: "user-2",
        ownerName: "Adit",
      }),
    ]);
    render(<RekeningPage />);
    await screen.findByText("Tabungan Keluarga");
    const sharedCard = screen
      .getByText("Tabungan Keluarga")
      .closest("article, li, div.card, [class*='card']") as HTMLElement;
    expect(within(sharedCard).getByText("Bersama")).toBeInTheDocument();
    const ownedCard = screen
      .getByText("Rekening Adit")
      .closest("article, li, div.card, [class*='card']") as HTMLElement;
    expect(within(ownedCard).queryByText("Bersama")).not.toBeInTheDocument();
  });

  // EPIC-033 p24 — cash accounts moved off this page (Cash & E-Wallet owns
  // them), so the negative-cash edit case now lives in dana.test.tsx.

  it("still edits a bank account through the 'Rekening Bank' form (non-cash unaffected)", async () => {
    mockApiRoutes([
      buildAccount({
        id: "acc-2",
        name: "BCA Tahapan",
        type: "bank",
        institution: "BCA",
        balance: "1000000",
      }),
    ]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await screen.findByText("BCA Tahapan");

    await user.click(screen.getByRole("button", { name: "Opsi rekening" }));
    await user.click(await screen.findByText("Edit"));

    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Edit Rekening Bank" }),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    const patchCall = mockApiFetch.mock.calls.find(
      (call) => call[1]?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body as string) as {
      balance: number;
      type?: string;
    };
    // Unchanged pre-existing behavior — no `type` resend for non-cash edits.
    expect(body.balance).toBe(1000000);
    expect(body.type).toBeUndefined();
  });

  it("Mutasi footer button opens Transaksi filtered to that account", async () => {
    mockApiRoutes([buildAccount()]);
    const user = userEvent.setup();
    render(<RekeningPage />);

    const card = (await screen.findByText("Tabungan Utama")).closest(
      "article, li, div.card, [class*='card']",
    ) as HTMLElement;
    await user.click(
      within(card).getByRole("button", { name: /lihat mutasi/i }),
    );

    expect(mockPush).toHaveBeenCalledWith("/transaksi?accountId=acc-1");
  });

  it("explains what Privat means on the badge", async () => {
    mockApiRoutes([buildAccount({ isPrivate: true })]);
    render(<RekeningPage />);

    expect(
      await screen.findByTitle(/hanya terlihat oleh master/i),
    ).toBeInTheDocument();
  });
});
