/**
 * EPIC-016 Task B2 — RED phase test for "indicative rate" honesty labeling on beranda.
 *
 * This test verifies that:
 * 1. When user's currency preference is IDR (default), no "indicative" label appears
 * 2. When user's currency preference is non-IDR (USD, SGD, EUR, JPY), a visual indicator
 *    (e.g. "≈" prefix or caption text) appears alongside converted amounts to label them
 *    as approximations using mock exchange rates, not live market data
 *
 * Currently this test FAILS because:
 * - The currency preference feature doesn't exist yet
 * - The beranda component doesn't use use-currency-preference hook
 * - No "indicative rate" labeling logic exists
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock auth-client
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

// BerandaPage calls useRouter() (next/navigation) — not present without a
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

// Mock use-currency-preference hook (will be created in this task).
// The wrapper arrow function (not a direct reference) defers evaluating
// mockUseCurrencyPreference until it's actually called during render —
// jest.mock's factory itself runs eagerly, as soon as "./page" is required
// below, which is before this file's own `const mockUseCurrencyPreference =
// jest.fn()` has executed.
const mockUseCurrencyPreference = jest.fn();
jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: (...args: unknown[]) =>
    mockUseCurrencyPreference(...args),
}));

import { BerandaPage } from "./page";
import { ShellProvider } from "../../../components/shell/shell-context";

// BerandaPage also calls useSession() (auth-compat) and several useQuery()
// calls directly — all of which need a QueryClientProvider ancestor that
// plain @testing-library/react.render() doesn't provide.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ShellProvider>{children}</ShellProvider>
    </QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

describe("Beranda — Indicative Rate Labeling (EPIC-016 Task B2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should NOT show indicative label when currency is IDR (default)", () => {
    // Arrange — user's currency is IDR (default, no conversion needed)
    mockUseCurrencyPreference.mockReturnValue({
      currency: "IDR",
      rate: 1,
      isIndicative: false,
      isReady: true,
      formatMoney: (value: number) => `Rp ${value.toLocaleString("id-ID")}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert — no "≈" or "indicative" text should appear
    const approximateSymbols = screen.queryAllByText(/≈/);
    const indicativeLabels = screen.queryAllByText(
      /indicative|approximate|perkiraan/i,
    );

    expect(approximateSymbols.length).toBe(0);
    expect(indicativeLabels.length).toBe(0);
  });

  it("should show indicative label when currency is USD (non-default)", () => {
    // Arrange — user's currency is USD
    mockUseCurrencyPreference.mockReturnValue({
      currency: "USD",
      rate: 0.000063,
      isIndicative: true,
      isReady: true,
      formatMoney: (value: number) => `$ ${(value * 0.000063).toFixed(2)}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert — "≈" or "indicative" label should appear to mark converted amounts as approximate
    // The label can be:
    // - "≈" prefix before amount
    // - a caption/tooltip like "Perkiraan kurs" (Indicative rate)
    // - a small "(~)" notation
    const hasIndicativeMarker =
      screen.queryAllByText(/≈/).length > 0 ||
      screen.queryByText(/indicative|approximate|perkiraan/i) !== null ||
      screen.queryByText(/kurs|exchange|exchange rate/i) !== null;

    expect(hasIndicativeMarker).toBe(true);
  });

  it("should show indicative label when currency is SGD (non-default)", () => {
    // Arrange
    mockUseCurrencyPreference.mockReturnValue({
      currency: "SGD",
      rate: 0.000085,
      isIndicative: true,
      isReady: true,
      formatMoney: (value: number) => `S$ ${(value * 0.000085).toFixed(2)}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert
    const hasIndicativeMarker =
      screen.queryAllByText(/≈/).length > 0 ||
      screen.queryByText(/indicative|approximate|perkiraan/i) !== null;

    expect(hasIndicativeMarker).toBe(true);
  });

  it("should show indicative label when currency is EUR (non-default)", () => {
    // Arrange
    mockUseCurrencyPreference.mockReturnValue({
      currency: "EUR",
      rate: 0.000058,
      isIndicative: true,
      isReady: true,
      formatMoney: (value: number) => `€ ${(value * 0.000058).toFixed(2)}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert
    const hasIndicativeMarker =
      screen.queryAllByText(/≈/).length > 0 ||
      screen.queryByText(/indicative|approximate|perkiraan/i) !== null;

    expect(hasIndicativeMarker).toBe(true);
  });

  it("should show indicative label when currency is JPY (non-default)", () => {
    // Arrange
    mockUseCurrencyPreference.mockReturnValue({
      currency: "JPY",
      rate: 0.0095,
      isIndicative: true,
      isReady: true,
      formatMoney: (value: number) => `¥ ${Math.round(value * 0.0095)}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert
    const hasIndicativeMarker =
      screen.queryAllByText(/≈/).length > 0 ||
      screen.queryByText(/indicative|approximate|perkiraan/i) !== null;

    expect(hasIndicativeMarker).toBe(true);
  });

  it("should apply indicative label to net worth hero card when currency is non-IDR", () => {
    // Arrange — the hero card at the top shows the user's total net worth
    mockUseCurrencyPreference.mockReturnValue({
      currency: "USD",
      rate: 0.000063,
      isIndicative: true,
      isReady: true,
      formatMoney: (value: number) => `$ ${(value * 0.000063).toFixed(2)}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert — find the net worth display (the hero's big figure)
    // and verify it has an indicative marker nearby
    const heroCard = document.querySelector<HTMLElement>(".wm-big")!;
    const heroSection = heroCard.closest("div");

    const hasIndicativeMarker =
      heroSection?.textContent?.includes("≈") ||
      heroSection?.textContent?.match(/indicative|approximate|perkiraan/i);

    expect(hasIndicativeMarker).toBe(true);
  });

  it("should apply indicative label to summary cards when currency is non-IDR", () => {
    // Arrange
    mockUseCurrencyPreference.mockReturnValue({
      currency: "SGD",
      rate: 0.000085,
      isIndicative: true,
      isReady: true,
      formatMoney: (value: number) => `S$ ${(value * 0.000085).toFixed(2)}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert — summary cards (Dana, Utang, Investasi, etc.) should all show indicative marker
    // Find cards by looking for common labels
    const cardLabels = [
      screen.queryByText(/Dana|Cash/),
      screen.queryByText(/Utang|Debt/),
      screen.queryByText(/Investasi|Investment/),
    ];

    for (const label of cardLabels) {
      if (label) {
        const card = label.closest("div");
        const hasMarker =
          card?.textContent?.includes("≈") ||
          card?.textContent?.match(/indicative|approximate/i);
        expect(hasMarker).toBe(true);
      }
    }
  });

  it("should clear indicative label when user switches back to IDR", () => {
    // Arrange — start with USD
    const { rerender } = render(<BerandaPage />);
    mockUseCurrencyPreference.mockReturnValue({
      currency: "USD",
      rate: 0.000063,
      isIndicative: true,
      isReady: true,
      formatMoney: (value: number) => `$ ${(value * 0.000063).toFixed(2)}`,
    });
    rerender(<BerandaPage />);

    let hasMarker = screen.queryAllByText(/≈/).length > 0;
    expect(hasMarker).toBe(true);

    // Act — switch to IDR
    mockUseCurrencyPreference.mockReturnValue({
      currency: "IDR",
      rate: 1,
      isIndicative: false,
      isReady: true,
      formatMoney: (value: number) => `Rp ${value.toLocaleString("id-ID")}`,
    });
    rerender(<BerandaPage />);

    // Assert — indicative label should disappear
    hasMarker = screen.queryAllByText(/≈/).length > 0;
    expect(hasMarker).toBe(false);
  });

  it("should show a loading placeholder — never a fabricated 1:1-rate conversion — while the FX rate is not ready", () => {
    // Arrange — currency preference resolved to USD, but the FX rate hasn't
    // loaded yet (isReady: false). A regression here would fall back to
    // rate=1 and render the raw IDR magnitude under a "$" symbol — off by
    // orders of magnitude. formatMoney is deliberately wired with rate=1
    // below so that bug, if reintroduced, would be visible as "$" next to
    // the unconverted (huge) number.
    mockUseCurrencyPreference.mockReturnValue({
      currency: "USD",
      rate: 1,
      isIndicative: true,
      isReady: false,
      formatMoney: (value: number) => `$ ${value.toFixed(2)}`,
    });

    // Act
    render(<BerandaPage />);

    // Assert — the hero heading shows a loading placeholder, never the "$"
    // symbol paired with the raw (unconverted) magnitude.
    const heroCard = document.querySelector<HTMLElement>(".wm-big")!;
    expect(heroCard.textContent).toMatch(/Memuat|Loading/);
    expect(heroCard.textContent).not.toMatch(/\$/);
  });
});
