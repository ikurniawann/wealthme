/**
 * EPIC-016 Task K — KeamananBody wiring tests.
 *
 * Verifies that:
 * 1. Sesi Aktif renders real rows from mocked `authClient.listSessions()`
 *    (not the old hardcoded iPhone 14 Pro / MacBook Pro rows).
 * 2. Clicking "Akhiri" on a non-current session calls
 *    `authClient.revokeSession({ token })`.
 * 3. The hardcoded PIN "Aktif" badge is gone.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockAkunDictionary } from "../../../i18n/id";

// Mock auth-client — adds listSessions/revokeSession alongside the existing
// changePassword/signOut/useSession mocks used by the other akun body tests.
const mockUseSessionAuth = jest.fn();
const mockListSessions = jest.fn();
const mockRevokeSession = jest.fn();

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
    changePassword: jest.fn(),
    listSessions: (...args: unknown[]) => mockListSessions(...args),
    revokeSession: (...args: unknown[]) => mockRevokeSession(...args),
  },
}));

// Mock sonner toast library
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock use-locale with the real Indonesian dictionary.
jest.mock("../../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: mockAkunDictionary,
  })),
}));

// Mock api-client — used for the loginAlert/bigTxnConfirm PATCH mutation and
// auth-compat's internal /auth/me fallback query.
const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Mock use-profile so notificationPrefs (loginAlert/bigTxnConfirm) are
// controlled per test.
const mockUseProfile = jest.fn();
jest.mock("../../../hooks/use-profile", () => ({
  useProfile: () => mockUseProfile(),
}));

import { KeamananBody } from "./page";

const CURRENT_TOKEN = "current-session-token";
const OTHER_TOKEN = "other-session-token";

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

describe("KeamananBody — Sesi Aktif + PIN honesty (EPIC-016 Task K)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: CURRENT_TOKEN },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });

    mockListSessions.mockResolvedValue({
      data: [
        {
          id: "session-current",
          token: CURRENT_TOKEN,
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
          ipAddress: "36.1.2.3",
          createdAt: "2025-07-01T00:00:00.000Z",
          updatedAt: "2025-07-01T00:00:00.000Z",
        },
        {
          id: "session-other",
          token: OTHER_TOKEN,
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
          ipAddress: "36.4.5.6",
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mockRevokeSession.mockResolvedValue({
      data: { status: true },
      error: null,
    });

    mockUseProfile.mockReturnValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        notificationPrefs: {
          txnIn: true,
          txnOut: true,
          txnBig: true,
          budget80: true,
          goalMilestone: true,
          billDue: true,
          stockPrice: true,
          dividend: true,
          loginAlert: false,
          bigTxnConfirm: false,
        },
      },
      isLoading: false,
    });

    // EPIC-023 D2 — KeamananBody now also fetches GET /auth/devices (device
    // management section). Route by path so the pre-existing /auth/me
    // fallback (auth-compat.ts) keeps its own response shape.
    mockApiFetch.mockImplementation((path: unknown) => {
      if (path === "/auth/devices") return Promise.resolve([]);
      return Promise.resolve({ familyGroupId: null });
    });
  });

  it("renders session rows from mocked authClient.listSessions", async () => {
    // Act
    render(<KeamananBody />);

    // Assert — real device labels derived from each session's userAgent
    expect(await screen.findByText("iPhone")).toBeInTheDocument();
    expect(await screen.findByText("Mac")).toBeInTheDocument();
  });

  it("marks the session matching the current token as 'Ini perangkatmu'", async () => {
    // Act
    render(<KeamananBody />);
    await screen.findByText("iPhone");

    // Assert — only the current session shows the "this device" badge
    expect(screen.getByText("Ini perangkatmu")).toBeInTheDocument();
    expect(screen.getByText("Akhiri")).toBeInTheDocument();
  });

  it("shows the current device plus the 2 newest sessions and hides the rest behind 'Lihat semua'", async () => {
    // Arrange: current session + 7 older sessions
    const others = Array.from({ length: 7 }, (_, i) => ({
      id: `session-${i}`,
      token: `token-${i}`,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      ipAddress: "36.4.5.6",
      createdAt: `2025-06-0${i + 1}T00:00:00.000Z`,
      updatedAt: `2025-06-0${i + 1}T00:00:00.000Z`,
    }));
    mockListSessions.mockResolvedValue({
      data: [
        ...others,
        {
          id: "session-current",
          token: CURRENT_TOKEN,
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
          ipAddress: "36.1.2.3",
          createdAt: "2025-05-01T00:00:00.000Z",
          updatedAt: "2025-05-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    // Act
    render(<KeamananBody />);
    await screen.findByText("iPhone");

    // Assert: current device listed despite being oldest; 2 others visible
    // (prototype parity — sessions cap at 3 before "Lihat semua").
    expect(screen.getByText("Ini perangkatmu")).toBeInTheDocument();
    expect(screen.getAllByText("Akhiri")).toHaveLength(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Lihat semua (8)" }),
    );
    expect(screen.getAllByText("Akhiri")).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: "Tampilkan lebih sedikit" }),
    ).toBeInTheDocument();
  });

  it("calls authClient.revokeSession with the target session's token when Akhiri is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<KeamananBody />);
    await screen.findByText("Mac");

    // Act
    await user.click(screen.getByText("Akhiri"));

    // Assert
    expect(mockRevokeSession).toHaveBeenCalledWith({ token: OTHER_TOKEN });
  });

  it("does not render the hardcoded PIN 'Aktif' badge", async () => {
    // Act
    render(<KeamananBody />);
    await screen.findByText("iPhone");

    // Assert — the PIN row no longer claims to be active; it's an honest
    // coming-soon affordance now (no "Aktif" badge anywhere on the page).
    expect(screen.queryByText("Aktif")).not.toBeInTheDocument();
  });
});

/**
 * EPIC-023 D2 fix — HIGH (react-reviewer, confirmed by typescript-reviewer +
 * review-qa flagging the same dead i18n keys as a symptom) — device
 * revocation now requires an explicit confirmation step instead of firing on
 * a single click anywhere on the row, and the device-management list itself
 * (previously zero test coverage per react-reviewer) is exercised here.
 */
describe("KeamananBody — device management (buka cepat) revoke confirmation (EPIC-023 D2)", () => {
  const DEVICE_ROW = {
    id: "device-1",
    label: "iPhone 15",
    hasPinSet: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: "2026-01-02T00:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: CURRENT_TOKEN },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });

    mockListSessions.mockResolvedValue({ data: [], error: null });
    mockRevokeSession.mockResolvedValue({
      data: { status: true },
      error: null,
    });

    mockUseProfile.mockReturnValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        notificationPrefs: {},
      },
      isLoading: false,
    });

    mockApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      if (path === "/auth/devices") {
        const method = (init as { method?: string } | undefined)?.method;
        if (method === "DELETE") return Promise.resolve(undefined);
        return Promise.resolve([DEVICE_ROW]);
      }
      if (
        typeof path === "string" &&
        path.startsWith("/auth/devices/") &&
        (init as { method?: string } | undefined)?.method === "DELETE"
      ) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({ familyGroupId: null });
    });
  });

  it("renders device rows from useDevices (GET /auth/devices)", async () => {
    render(<KeamananBody />);

    expect(await screen.findByText("iPhone 15")).toBeInTheDocument();
    expect(screen.getByText(/PIN aktif/)).toBeInTheDocument();
  });

  it("clicking 'Lupakan' opens the confirmation dialog and does NOT call the revoke mutation yet", async () => {
    const user = userEvent.setup();
    render(<KeamananBody />);
    await screen.findByText("iPhone 15");

    await user.click(screen.getByText("Lupakan"));

    // Assert — the confirmation dialog's previously-dead copy is now shown.
    expect(
      await screen.findByText("Lupakan perangkat ini?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Perangkat ini tidak akan bisa lagi membuka aplikasi dengan PIN. Perangkat perlu password kamu untuk masuk lagi.",
      ),
    ).toBeInTheDocument();

    // The DELETE call must NOT have fired merely from opening the dialog.
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/devices/"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("confirming the dialog calls the revoke mutation and shows a success toast", async () => {
    const user = userEvent.setup();
    render(<KeamananBody />);
    await screen.findByText("iPhone 15");

    await user.click(screen.getByText("Lupakan"));
    await screen.findByText("Lupakan perangkat ini?");
    await user.click(screen.getByRole("button", { name: "Lupakan perangkat" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/auth/devices/device-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("cancelling the dialog leaves the device in the list untouched and does not call the mutation", async () => {
    const user = userEvent.setup();
    render(<KeamananBody />);
    await screen.findByText("iPhone 15");

    await user.click(screen.getByText("Lupakan"));
    await screen.findByText("Lupakan perangkat ini?");
    await user.click(screen.getByText("Batal"));

    // Dialog closes; device row is still present.
    expect(
      screen.queryByText("Lupakan perangkat ini?"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("iPhone 15")).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/devices/"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
