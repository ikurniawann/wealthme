/**
 * EPIC-016 Task D — Admin "Kelola akses" menu.
 *
 * Previously the ellipsis button on an Admin/Staf row only fired
 * `toast(`Kelola akses ${m.name}`)` with no real action. It's now a real
 * dropdown menu wired to the pre-existing (but previously unused by any
 * frontend page) PATCH/DELETE member endpoints
 * (apps/api/src/family-groups/family-groups.controller.ts).
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom doesn't implement PointerEvent — Base UI's Dropdown/Dialog trigger
// and item click handlers read pointer-event fields (same gap documented in
// notif-setting-body.test.tsx for the Switch component).
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

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { FamilyBody } from "./page";

const ADMIN_MEMBER = {
  id: "member-admin-1",
  userId: "user-admin-1",
  familyGroupId: "fg-1",
  role: "admin_staff",
  name: "Budi Santoso",
  email: "budi@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const OWNER_GROUP = {
  id: "fg-1",
  name: "Keluarga Test",
  memberCount: 2,
  myRole: "owner",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

describe("FamilyBody — real 'Kelola akses' menu (EPIC-016 Task D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({});
  });

  it("calls PATCH .../members/:id with role: member when 'Jadikan Anggota Biasa' is chosen", async () => {
    const { toast } = jest.requireMock<{
      toast: { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const user = userEvent.setup();

    render(
      <FamilyBody
        name="Test User"
        email="test@example.com"
        initials="TU"
        group={OWNER_GROUP}
        members={[ADMIN_MEMBER]}
        myUserId="my-user-id"
        familyGroupId="fg-1"
        token="tok-1"
        onAddAdmin={jest.fn()}
        onInviteMember={jest.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Kelola akses Budi Santoso"));
    await user.click(await screen.findByText("Jadikan Anggota Biasa"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/family-groups/fg-1/members/member-admin-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "member" }),
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Budi Santoso sekarang menjadi anggota biasa.",
    );
  });

  it("asks for confirmation, then calls DELETE .../members/:id when removal is confirmed", async () => {
    const { toast } = jest.requireMock<{
      toast: { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const user = userEvent.setup();

    render(
      <FamilyBody
        name="Test User"
        email="test@example.com"
        initials="TU"
        group={OWNER_GROUP}
        members={[ADMIN_MEMBER]}
        myUserId="my-user-id"
        familyGroupId="fg-1"
        token="tok-1"
        onAddAdmin={jest.fn()}
        onInviteMember={jest.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Kelola akses Budi Santoso"));
    await user.click(await screen.findByText("Hapus dari Family"));

    // Confirmation dialog gates the destructive call — not fired yet.
    expect(mockApiFetch).not.toHaveBeenCalled();
    const confirmButton = await screen.findByText("Ya, Hapus");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/family-groups/fg-1/members/member-admin-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Budi Santoso dikeluarkan dari family group.",
    );
  });

  it("hides the 'Kelola akses' menu for a non-owner (server already rejects via assertOwner)", () => {
    render(
      <FamilyBody
        name="Test User"
        email="test@example.com"
        initials="TU"
        group={{ ...OWNER_GROUP, myRole: "member" }}
        members={[ADMIN_MEMBER]}
        myUserId="my-user-id"
        familyGroupId="fg-1"
        token="tok-1"
        onAddAdmin={jest.fn()}
        onInviteMember={jest.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("Kelola akses Budi Santoso"),
    ).not.toBeInTheDocument();
  });
});
