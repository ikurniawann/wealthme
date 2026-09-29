/**
 * Hardening batch G1 (P0 honesty) — akun Pengaturan "data" toggles
 * (hideBalance/showDecimal/weeklySummary) and Privasi toggles
 * (hideFromFamily/screenshotProtect/sendAnalytics/aiPersonalization) used to
 * be uncontrolled `defaultChecked` Switches that saved nothing. These tests
 * verify they're now controlled by the real profile and persist via
 * PATCH /auth/profile { privacyPrefs }.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockAkunDictionary } from "../../../i18n/id";

// jsdom doesn't implement PointerEvent, but the Base UI Switch's click
// handler reads pointer-event fields — polyfill the minimum shape so
// userEvent.click() on a switch doesn't throw (mirrors
// notif-setting-body.test.tsx).
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

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: () => ({ data: undefined, isError: false }),
}));

jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("next-themes", () => ({
  useTheme: jest.fn(() => ({
    theme: "light",
    setTheme: jest.fn(),
    themes: ["light", "dark", "system"],
    systemTheme: "light",
    resolvedTheme: "light",
  })),
}));

jest.mock("../../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: mockAkunDictionary,
  })),
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockUseSession = jest.fn();
jest.mock("../../../lib/auth-compat", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockUseProfile = jest.fn();
jest.mock("../../../hooks/use-profile", () => ({
  useProfile: () => mockUseProfile(),
}));

import { PengaturanBody, PrivasiBody } from "./page";

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

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  mockUseSession.mockReturnValue({ data: { accessToken: "test-token" } });
  mockUseProfile.mockReturnValue({
    data: {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      privacyPrefs: {
        hideBalance: false,
        showDecimal: true,
        weeklySummary: true,
        hideFromFamily: false,
        screenshotProtect: true,
        sendAnalytics: true,
        aiPersonalization: true,
      },
    },
    isLoading: false,
  });
  // PengaturanBody also fires useGoldPrice's /gold-price/antam and
  // /family-groups/mine queries once a real (non-null) token exists — route
  // those to shapes the hooks tolerate so only the /auth/profile PATCH
  // itself is under test here.
  mockApiFetch.mockImplementation((path: unknown) => {
    if (path === "/family-groups/mine") return Promise.resolve([]);
    if (path === "/gold-price/antam") {
      return Promise.resolve({
        pricePerKgIdr: null,
        source: null,
        fetchedAt: null,
        stale: true,
      });
    }
    return Promise.resolve({ success: true });
  });
});

describe("PengaturanBody data toggles persist privacyPrefs", () => {
  it("reflects the real hideBalance value from the profile (unchecked by default)", async () => {
    render(<PengaturanBody />);
    const toggle = await screen.findByRole("switch", {
      name: mockAkunDictionary.akun.pengaturan.hideBalanceLabel,
    });
    expect(toggle).not.toBeChecked();
  });

  it("PATCHes /auth/profile with the new privacyPrefs map when hideBalance is toggled", async () => {
    const user = userEvent.setup();
    render(<PengaturanBody />);
    const toggle = await screen.findByRole("switch", {
      name: mockAkunDictionary.akun.pengaturan.hideBalanceLabel,
    });

    await user.click(toggle);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/auth/profile",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            privacyPrefs: {
              hideBalance: true,
              showDecimal: true,
              weeklySummary: true,
              hideFromFamily: false,
              screenshotProtect: true,
              sendAnalytics: true,
              aiPersonalization: true,
            },
          }),
        }),
      );
    });
  });

  it("rolls back the switch on a failed PATCH", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<PengaturanBody />);
    const toggle = await screen.findByRole("switch", {
      name: mockAkunDictionary.akun.pengaturan.showDecimalLabel,
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => expect(toggle).toBeChecked());
  });
});

describe("PrivasiBody toggles persist privacyPrefs", () => {
  it("reflects the real hideFromFamily value from the profile (unchecked by default)", async () => {
    render(<PrivasiBody />);
    const toggle = await screen.findByRole("switch", {
      name: mockAkunDictionary.akun.privasi.hideFromFamilyLabel,
    });
    expect(toggle).not.toBeChecked();
  });

  it("PATCHes /auth/profile when aiPersonalization is toggled off", async () => {
    const user = userEvent.setup();
    render(<PrivasiBody />);
    const toggle = await screen.findByRole("switch", {
      name: mockAkunDictionary.akun.privasi.aiPersonalizationLabel,
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/auth/profile",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            privacyPrefs: {
              hideBalance: false,
              showDecimal: true,
              weeklySummary: true,
              hideFromFamily: false,
              screenshotProtect: true,
              sendAnalytics: true,
              aiPersonalization: false,
            },
          }),
        }),
      );
    });
  });
});
