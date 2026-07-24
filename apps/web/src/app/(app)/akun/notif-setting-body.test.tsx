/**
 * EPIC-016 Task B3 — NotifSettingBody wiring tests.
 *
 * Verifies that the notification preference toggles reflect the real
 * `useProfile().notificationPrefs` (not a local-only default) and that
 * clicking "Simpan" persists the full preference map (9 keys as of EPIC-016
 * Task K's "newLogin") via PATCH /auth/profile, mirroring
 * pengaturan-body.test.tsx's mock harness for the currency picker
 * (EPIC-016 Task B2).
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom doesn't implement PointerEvent, but the Base UI Switch's click
// handler (used by the notification toggles) reads pointer-event fields —
// polyfill the minimum shape so userEvent.click() on a switch doesn't throw.
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

// Mock auth-client (same as pengaturan-body.test.tsx / profil-body.test.tsx)
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

// Mock sonner toast library
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock api-client so we can spy on the PATCH /auth/profile call.
const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Mock use-profile so each test controls the "current" resolved prefs.
const mockUseProfile = jest.fn();
jest.mock("../../../hooks/use-profile", () => ({
  useProfile: () => mockUseProfile(),
}));

import { NotifSettingBody } from "./page";

const ALL_ON_PREFS = {
  txnIn: true,
  txnOut: true,
  txnBig: true,
  budget80: true,
  goalMilestone: true,
  billDue: true,
  stockPrice: true,
  dividend: true,
  // EPIC-016 Task K — "newLogin" has no row in this component (it lives in
  // KeamananBody's Autentikasi section), but is part of the shared
  // NOTIF_PREF_KEYS list this component's save() always resends in full —
  // see NOTIF_PREF_KEYS's own comment in page.tsx for why.
  newLogin: true,
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

describe("NotifSettingBody — Notification Preferences (EPIC-016 Task B3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProfile.mockReturnValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        notificationPrefs: ALL_ON_PREFS,
      },
      isLoading: false,
    });
    mockApiFetch.mockResolvedValue({ success: true, data: {} });
  });

  it("reflects the stored budget80: false preference as an off switch", () => {
    // Arrange
    mockUseProfile.mockReturnValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        notificationPrefs: { ...ALL_ON_PREFS, budget80: false },
      },
      isLoading: false,
    });

    // Act
    render(<NotifSettingBody />);

    // Assert — the budget80 switch is off, every other switch stays on
    expect(
      screen.getByRole("switch", { name: "Anggaran Mendekati Batas" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Notif Transaksi Masuk" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Update Progres Tujuan" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("defaults every switch to on when the profile has not resolved notificationPrefs yet", () => {
    // Arrange — profile query still loading, no notificationPrefs field
    mockUseProfile.mockReturnValue({
      data: { id: "user-1", email: "user@example.com" },
      isLoading: true,
    });

    // Act
    render(<NotifSettingBody />);

    // Assert
    expect(
      screen.getByRole("switch", { name: "Notif Transaksi Keluar" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Jatuh Tempo Tagihan" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("persists all known keys via PATCH /auth/profile when Simpan is clicked", async () => {
    // Arrange
    mockUseProfile.mockReturnValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        notificationPrefs: { ...ALL_ON_PREFS, budget80: false },
      },
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<NotifSettingBody />);

    // Act
    await user.click(screen.getByText("Simpan"));

    // Assert — PATCH sent to /auth/profile with a body carrying exactly the
    // known keys, preserving the currently-off budget80 toggle.
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/auth/profile",
      expect.objectContaining({ method: "PATCH" }),
    );
    const [, options] = mockApiFetch.mock.calls[0] as [
      string,
      { body: string },
    ];
    const sentBody = JSON.parse(options.body) as {
      notificationPrefs: Record<string, boolean>;
    };
    expect(Object.keys(sentBody.notificationPrefs).sort()).toEqual(
      Object.keys(ALL_ON_PREFS).sort(),
    );
    expect(sentBody.notificationPrefs.budget80).toBe(false);
    expect(sentBody.notificationPrefs.txnIn).toBe(true);
  });

  it("toggling a switch before Simpan changes what gets persisted", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<NotifSettingBody />);

    // Act — turn off "Notif Transaksi Masuk" (starts on) then save
    await user.click(
      screen.getByRole("switch", { name: "Notif Transaksi Masuk" }),
    );
    await user.click(screen.getByText("Simpan"));

    // Assert
    const [, options] = mockApiFetch.mock.calls[0] as [
      string,
      { body: string },
    ];
    const sentBody = JSON.parse(options.body) as {
      notificationPrefs: Record<string, boolean>;
    };
    expect(sentBody.notificationPrefs.txnIn).toBe(false);
  });
});
