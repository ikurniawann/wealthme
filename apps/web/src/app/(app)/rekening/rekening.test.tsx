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
    name: "Kas Tunai",
    type: "cash",
    institution: null,
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

describe("RekeningPage — cash-account negative balance (EPIC-022 A2)", () => {
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

  it("preserves an already-negative cash balance across an unrelated edit (no sign-flip regression)", async () => {
    // Arrange — this cash account already went negative (e.g. an
    // over-budget expense debited it below zero).
    mockApiRoutes([
      buildAccount({ id: "acc-1", name: "Kas Tunai", balance: "-75000" }),
    ]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await screen.findByText("Kas Tunai");

    // Act — open the kebab menu and click "Edit" without touching the
    // balance field.
    await user.click(screen.getByRole("button", { name: "Opsi rekening" }));
    await user.click(await screen.findByText("✏️ Edit"));

    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Edit Kas Tunai" }),
    ).toBeInTheDocument();
    // The amount field must display the existing negative balance, not a
    // sign-stripped positive one — this is the actual regression: before
    // the fix, this field showed "75.000" (no "-").
    expect(dialog.getByPlaceholderText("0")).toHaveValue("-75.000");
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    // Assert — the PATCH resubmits the SAME negative balance, not +75000,
    // and resends `type: "cash"` so the API's per-type negative-balance
    // check still sees this as a cash account on the partial update.
    const patchCall = mockApiFetch.mock.calls.find(
      (call) => call[1]?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    expect(patchCall![0]).toBe(
      `/family-groups/${FAMILY_GROUP_ID}/accounts/acc-1`,
    );
    const body = JSON.parse(patchCall![1].body as string) as {
      balance: number;
      type: string;
    };
    expect(body.balance).toBe(-75000);
    expect(body.type).toBe("cash");
  });

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
    await user.click(await screen.findByText("✏️ Edit"));

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
});
