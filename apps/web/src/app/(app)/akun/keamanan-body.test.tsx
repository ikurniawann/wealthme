/**
 * EPIC-016 Task K — KeamananBody security settings wiring tests.
 *
 * Previously: PIN Aplikasi showed a hardcoded "Aktif" badge (setup was a
 * toast only); Sidik Jari/Face ID, Konfirmasi Transaksi Besar, and
 * Notifikasi Login Baru were inert `defaultChecked` switches with no
 * state/persistence; Sesi Aktif showed two hardcoded rows ("iPhone 14 Pro" /
 * "MacBook Pro") with a toast-only "Akhiri". Password change (already real,
 * `authClient.changePassword`) is untouched and not re-tested here.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom doesn't implement PointerEvent, but the Base UI Switch's click
// handler (used by the Autentikasi toggles) reads pointer-event fields —
// polyfill the minimum shape, matching notif-setting-body.test.tsx.
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

const mockListSessions = jest.fn();
const mockRevokeSession = jest.fn();
const mockAuthSignOut = jest.fn();
const mockUseSession = jest.fn();

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSession(...args),
    signOut: (...args: unknown[]) => mockAuthSignOut(...args),
    changePassword: jest.fn(),
    listSessions: (...args: unknown[]) => mockListSessions(...args),
    revokeSession: (...args: unknown[]) => mockRevokeSession(...args),
  },
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockUseProfile = jest.fn();
jest.mock("../../../hooks/use-profile", () => ({
  useProfile: () => mockUseProfile(),
}));

import { KeamananBody } from "./page";

const ALL_ON_NOTIF_PREFS = {
  txnIn: true,
  txnOut: true,
  txnBig: true,
  budget80: true,
  goalMilestone: true,
  billDue: true,
  stockPrice: true,
  dividend: true,
  newLogin: true,
};

const CURRENT_SESSION = {
  id: "sess-current",
  token: "tok-current",
  createdAt: "2026-07-20T09:00:00.000Z",
  updatedAt: "2026-07-24T10:00:00.000Z",
  expiresAt: "2026-08-24T10:00:00.000Z",
  ipAddress: "203.0.113.5",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
};

const OTHER_SESSION = {
  id: "sess-other",
  token: "tok-other",
  createdAt: "2026-07-18T09:00:00.000Z",
  updatedAt: "2026-07-22T08:00:00.000Z",
  expiresAt: "2026-08-22T08:00:00.000Z",
  ipAddress: "198.51.100.9",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function render(ui: ReactElement) {
  const queryClient = makeQueryClient();
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return rtlRender(ui, { wrapper: Providers });
}

describe("KeamananBody — security settings (EPIC-016 Task K)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: {
        session: { token: "tok-current", familyGroupId: "fg-1" },
        user: { id: "user-1", name: "Jane Doe", email: "jane@example.com" },
      },
      isPending: false,
    });
    mockUseProfile.mockReturnValue({
      data: {
        id: "user-1",
        email: "jane@example.com",
        notificationPrefs: ALL_ON_NOTIF_PREFS,
        securityPrefs: { confirmLargeTxn: true },
      },
      isLoading: false,
    });
    mockListSessions.mockResolvedValue({
      data: [CURRENT_SESSION, OTHER_SESSION],
      error: null,
    });
    mockRevokeSession.mockResolvedValue({
      data: { status: true },
      error: null,
    });
    mockApiFetch.mockResolvedValue({ success: true, data: {} });
  });

  describe("Sesi Aktif", () => {
    it("renders real sessions from authClient.listSessions(), not the hardcoded iPhone 14 Pro / MacBook Pro rows", async () => {
      render(<KeamananBody />);

      await waitFor(() => {
        expect(mockListSessions).toHaveBeenCalled();
      });

      // Real device labels parsed from the real userAgent strings.
      expect(await screen.findByText("Chrome di Windows")).toBeInTheDocument();
      expect(screen.getByText("Safari di iPhone")).toBeInTheDocument();

      expect(screen.queryByText("iPhone 14 Pro")).not.toBeInTheDocument();
      expect(screen.queryByText("MacBook Pro")).not.toBeInTheDocument();
    });

    it("shows a loading state before the real sessions arrive", () => {
      mockListSessions.mockReturnValue(new Promise(() => {}));

      render(<KeamananBody />);

      expect(screen.getByText("Memuat sesi...")).toBeInTheDocument();
      expect(screen.queryByText("iPhone 14 Pro")).not.toBeInTheDocument();
    });

    it("shows the loading state — never a false 'Tidak ada sesi aktif.' — while the session token hasn't hydrated yet", () => {
      // useSession() (auth-compat) is still pending on first mount, so
      // currentToken is undefined and the sessions query is `enabled: false`.
      // A disabled TanStack Query v5 query reports isLoading: false, so
      // without the `pending` fix this used to render the empty-state text
      // even though the real session list was never fetched.
      mockUseSession.mockReturnValue({
        data: undefined,
        isPending: true,
      });

      render(<KeamananBody />);

      expect(screen.getByText("Memuat sesi...")).toBeInTheDocument();
      expect(
        screen.queryByText("Tidak ada sesi aktif."),
      ).not.toBeInTheDocument();
      // The disabled query (no token yet) must never even fire.
      expect(mockListSessions).not.toHaveBeenCalled();
    });

    it("shows an error banner (not fake data) when the sessions fetch fails", async () => {
      mockListSessions.mockResolvedValue({
        data: null,
        error: { message: "network error" },
      });

      render(<KeamananBody />);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Gagal memuat sesi aktif. Silakan refresh halaman.",
      );
    });

    it("marks the session matching the current token as 'Ini perangkatmu'", async () => {
      render(<KeamananBody />);

      await screen.findByText("Chrome di Windows");

      expect(screen.getByText("Ini perangkatmu")).toBeInTheDocument();
    });

    it("really revokes a non-current session via authClient.revokeSession, not a toast", async () => {
      const user = userEvent.setup();
      render(<KeamananBody />);

      await screen.findByText("Safari di iPhone");

      const endButtons = screen.getAllByRole("button", { name: "Akhiri" });
      expect(endButtons).toHaveLength(1);
      await user.click(endButtons[0]!);

      await waitFor(() => {
        expect(mockRevokeSession).toHaveBeenCalledWith({ token: "tok-other" });
      });
      // The current session must never be revoked by an "Akhiri" click on a
      // different row.
      expect(mockRevokeSession).not.toHaveBeenCalledWith({
        token: "tok-current",
      });
    });

    it("ending the CURRENT session calls the real signOut (not revokeSession) — actually signs the user out", async () => {
      const user = userEvent.setup();
      render(<KeamananBody />);

      await screen.findByText("Chrome di Windows");

      await user.click(screen.getByRole("button", { name: "Keluar" }));

      await waitFor(() => {
        expect(mockAuthSignOut).toHaveBeenCalledTimes(1);
      });
      expect(mockRevokeSession).not.toHaveBeenCalled();
    });
  });

  describe("PIN Aplikasi — honest 'coming soon' (no fake Aktif badge)", () => {
    it("never claims PIN is Aktif and discloses it's not available yet on click", async () => {
      const { toast } = jest.requireMock<{ toast: { success: jest.Mock } }>(
        "sonner",
      );
      const user = userEvent.setup();
      render(<KeamananBody />);

      expect(screen.queryByText("Aktif")).not.toBeInTheDocument();
      expect(screen.getByText("Segera hadir")).toBeInTheDocument();

      await user.click(screen.getByText("PIN Aplikasi"));

      expect(toast).toHaveBeenCalledWith(
        "PIN aplikasi belum tersedia — fitur ini segera hadir.",
      );
    });
  });

  describe("Sidik Jari / Face ID — honest 'coming soon' (no inert live-looking toggle)", () => {
    it("renders a disabled, off switch instead of a defaultChecked=true fake-active toggle", () => {
      render(<KeamananBody />);

      const biometricSwitch = screen.getByRole("switch", {
        name: "Sidik Jari / Face ID",
      });
      // Base UI's Switch renders a non-native <span role="switch"> element,
      // so disabled state surfaces as aria-disabled rather than the native
      // `disabled` attribute jest-dom's toBeDisabled() checks for.
      expect(biometricSwitch).toHaveAttribute("aria-disabled", "true");
      expect(biometricSwitch).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Konfirmasi Transaksi Besar — real persisted toggle", () => {
    it("reflects the real profile.securityPrefs.confirmLargeTxn value", () => {
      mockUseProfile.mockReturnValue({
        data: {
          id: "user-1",
          notificationPrefs: ALL_ON_NOTIF_PREFS,
          securityPrefs: { confirmLargeTxn: false },
        },
        isLoading: false,
      });

      render(<KeamananBody />);

      expect(
        screen.getByRole("switch", { name: "Konfirmasi Transaksi Besar" }),
      ).toHaveAttribute("aria-checked", "false");
    });

    it("persists a real PATCH /auth/profile on toggle, in its own securityPrefs column", async () => {
      const user = userEvent.setup();
      render(<KeamananBody />);

      await user.click(
        screen.getByRole("switch", { name: "Konfirmasi Transaksi Besar" }),
      );

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/auth/profile",
          expect.objectContaining({ method: "PATCH" }),
        );
      });
      const [, options] = mockApiFetch.mock.calls[0] as [
        string,
        { body: string },
      ];
      const sentBody = JSON.parse(options.body) as {
        securityPrefs: Record<string, boolean>;
      };
      expect(sentBody.securityPrefs).toEqual({ confirmLargeTxn: false });
    });
  });

  describe("Notifikasi Login Baru — real persisted toggle, no clobber of other notif prefs", () => {
    it("reflects the real profile.notificationPrefs.newLogin value", () => {
      mockUseProfile.mockReturnValue({
        data: {
          id: "user-1",
          notificationPrefs: { ...ALL_ON_NOTIF_PREFS, newLogin: false },
          securityPrefs: { confirmLargeTxn: true },
        },
        isLoading: false,
      });

      render(<KeamananBody />);

      expect(
        screen.getByRole("switch", { name: "Notifikasi Login Baru" }),
      ).toHaveAttribute("aria-checked", "false");
    });

    it("persists the FULL notificationPrefs set (not just newLogin) so other tabs' toggles aren't reset", async () => {
      mockUseProfile.mockReturnValue({
        data: {
          id: "user-1",
          // budget80 already off from the Notifikasi tab — must survive a
          // save triggered from this Keamanan tab's newLogin toggle.
          notificationPrefs: { ...ALL_ON_NOTIF_PREFS, budget80: false },
          securityPrefs: { confirmLargeTxn: true },
        },
        isLoading: false,
      });
      const user = userEvent.setup();
      render(<KeamananBody />);

      await user.click(
        screen.getByRole("switch", { name: "Notifikasi Login Baru" }),
      );

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/auth/profile",
          expect.objectContaining({ method: "PATCH" }),
        );
      });
      const [, options] = mockApiFetch.mock.calls[0] as [
        string,
        { body: string },
      ];
      const sentBody = JSON.parse(options.body) as {
        notificationPrefs: Record<string, boolean>;
      };
      expect(sentBody.notificationPrefs.newLogin).toBe(false);
      // The pre-existing budget80: false from the other tab is preserved,
      // not silently reset back to the default (true).
      expect(sentBody.notificationPrefs.budget80).toBe(false);
      expect(Object.keys(sentBody.notificationPrefs).sort()).toEqual(
        Object.keys(ALL_ON_NOTIF_PREFS).sort(),
      );
    });
  });

  describe("Optimistic toggle rollback on save failure", () => {
    it("reverts Konfirmasi Transaksi Besar to the last known server value after a failed PATCH", async () => {
      // A manually-controlled promise lets us assert the intermediate
      // optimistic state before deciding when the PATCH rejects.
      let rejectPatch!: (error: Error) => void;
      mockApiFetch.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectPatch = reject;
          }),
      );
      const user = userEvent.setup();
      render(<KeamananBody />);

      const toggle = screen.getByRole("switch", {
        name: "Konfirmasi Transaksi Besar",
      });
      expect(toggle).toHaveAttribute("aria-checked", "true");

      await user.click(toggle);
      // Optimistic override applies immediately, before the PATCH settles.
      expect(toggle).toHaveAttribute("aria-checked", "false");

      rejectPatch(new Error("network error"));

      // Once the PATCH rejects, the override must be cleared so the switch
      // falls back to the real server value — not the stale optimistic click.
      await waitFor(() => {
        expect(toggle).toHaveAttribute("aria-checked", "true");
      });
      const { toast } = jest.requireMock<{ toast: { error: jest.Mock } }>(
        "sonner",
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Gagal menyimpan pengaturan keamanan",
      );
    });

    it("reverts Notifikasi Login Baru to the last known server value after a failed PATCH", async () => {
      let rejectPatch!: (error: Error) => void;
      mockApiFetch.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectPatch = reject;
          }),
      );
      const user = userEvent.setup();
      render(<KeamananBody />);

      const toggle = screen.getByRole("switch", {
        name: "Notifikasi Login Baru",
      });
      expect(toggle).toHaveAttribute("aria-checked", "true");

      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-checked", "false");

      rejectPatch(new Error("network error"));

      await waitFor(() => {
        expect(toggle).toHaveAttribute("aria-checked", "true");
      });
      const { toast } = jest.requireMock<{ toast: { error: jest.Mock } }>(
        "sonner",
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Gagal menyimpan pengaturan notifikasi",
      );
    });
  });
});
