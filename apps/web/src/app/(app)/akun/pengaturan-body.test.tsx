/**
 * EPIC-016 Task B1 — RED phase tests for theme and language picker wiring.
 *
 * These tests verify that:
 * 1. Selecting a theme option calls the real `setTheme()` (not just updating orphaned localStorage)
 * 2. Selecting a language option calls the real `setLocale()` (not just updating orphaned localStorage)
 * 3. The displayed theme/language values reflect the REAL current state from `useTheme()`/`useLocale()`
 *    instead of the orphaned `wealthme_settings` localStorage key
 *
 * Currently these tests FAIL because the implementation reads from/writes to the orphaned
 * `wealthme_settings` key instead of calling the real setters.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Real Indonesian dictionary, reused as the mocked `useLocale().t` below —
// `PengaturanBody` now reads `t.akun.pengaturan.*` for its own copy (EPIC-018
// Task A2), so every `useLocale` mock in this file needs a real dictionary
// shape instead of `{}` or the component throws on render. The name must
// start with "mock" (case-insensitive) so `jest.mock`'s out-of-scope-variable
// check allows referencing it from inside the factory below.
import { id as mockAkunDictionary } from "../../../i18n/id";
import { en as mockAkunDictionaryEn } from "../../../i18n/en";

// Mock auth-client (same as profil-body.test.tsx)
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

// Mock next-themes so we can spy on setTheme calls
const mockSetTheme = jest.fn();
const mockSetLocale = jest.fn();

jest.mock("next-themes", () => ({
  useTheme: jest.fn(() => ({
    theme: "light",
    setTheme: mockSetTheme,
    themes: ["light", "dark", "system"],
    systemTheme: "light",
    resolvedTheme: "light",
  })),
}));

// Mock use-locale so we can spy on setLocale calls
jest.mock("../../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: mockSetLocale,
    toggle: jest.fn(),
    t: mockAkunDictionary,
  })),
}));

// Mock api-client so we can spy on the real updateProfile PATCH call
// (EPIC-016 Task B2 currency picker wiring).
const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Mock use-profile so each test controls the "current" profile currency
// (EPIC-016 Task B2 currency picker wiring).
const mockUseProfile = jest.fn();
jest.mock("../../../hooks/use-profile", () => ({
  useProfile: () => mockUseProfile(),
}));

import { PengaturanBody } from "./page";

// PengaturanBody now reads/writes the real profile (useProfile + a
// PATCH /auth/profile mutation for currency), both of which need a
// QueryClientProvider ancestor — plain @testing-library/react.render()
// doesn't provide one, so every render() in this file goes through this
// wrapper instead.
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

// File-wide default so every describe block (not just the Currency Picker
// one) gets a valid useProfile() return value — PengaturanBody calls it
// unconditionally now that the currency picker reads from the real profile.
beforeEach(() => {
  mockUseProfile.mockReturnValue({
    data: { id: "user-1", email: "user@example.com", name: "Test User" },
    isLoading: false,
  });
  mockApiFetch.mockResolvedValue({ success: true, data: { currency: "USD" } });
  // Reset useLocale to the Indonesian default before every test.
  // `mockReturnValue` (used by individual tests below to simulate an
  // "app is in English" state) persists across tests until overridden
  // again — without this file-wide reset, a later test that never touches
  // `useLocale` itself would silently inherit an earlier test's English
  // override once `PengaturanBody` started reading `t.akun.pengaturan.*`
  // (EPIC-018 Task A2), instead of the Indonesian baseline this file's
  // other assertions assume.
  const { useLocale } = jest.requireMock<{
    useLocale: jest.Mock;
  }>("../../../hooks/use-locale");
  useLocale.mockReturnValue({
    locale: "id",
    setLocale: mockSetLocale,
    toggle: jest.fn(),
    t: mockAkunDictionary,
  });
});

describe("PengaturanBody — Theme & Language Picker Wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the orphaned localStorage key
    localStorage.removeItem("wealthme_settings");
  });

  describe("Theme Picker", () => {
    it("should call setTheme when selecting a different theme", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PengaturanBody />);

      // Find the theme select (the third Field in the "Bahasa & Tampilan" section)
      // Get all selects and pick the last one (theme is after language and dateFormat)
      const selects = screen.getAllByRole("combobox");
      const themeSelect = selects[2]; // 0=language, 1=dateFormat, 2=theme

      // Act — select "Gelap (Dark)"
      await user.selectOptions(themeSelect, "🌙 Gelap (Dark)");

      // Assert — the real setTheme should have been called with "dark"
      // (Currently FAILS because PengaturanBody doesn't call setTheme)
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("should call setTheme with 'system' when selecting Ikuti Sistem", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PengaturanBody />);

      const selects = screen.getAllByRole("combobox");
      const themeSelect = selects[2];

      // Act
      await user.selectOptions(themeSelect, "🖥️ Ikuti Sistem");

      // Assert
      expect(mockSetTheme).toHaveBeenCalledWith("system");
    });

    it("should display the REAL current theme from useTheme(), not the orphaned settings", async () => {
      // Arrange — mock useTheme to return "dark" as current theme
      const { useTheme } = jest.requireMock("next-themes");
      useTheme.mockReturnValue({
        theme: "dark",
        setTheme: mockSetTheme,
        themes: ["light", "dark", "system"],
        systemTheme: "light",
        resolvedTheme: "dark",
      });

      // Act
      render(<PengaturanBody />);

      // Assert — the theme select should display the value for "dark"
      // which corresponds to the option "🌙 Gelap (Dark)"
      const selects = screen.getAllByRole("combobox");
      const themeSelect = selects[2] as HTMLSelectElement;

      // Currently this FAILS because PengaturanBody reads from orphaned
      // localStorage["wealthme_settings"], which defaults to "☀️ Terang (Light)"
      // regardless of what useTheme() returns
      expect(themeSelect.value).toMatch(/Gelap.*Dark/);
    });
  });

  describe("Language Picker", () => {
    it("should call setLocale when selecting English", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PengaturanBody />);

      // Language select is the first one (before dateFormat and theme)
      const selects = screen.getAllByRole("combobox");
      const languageSelect = selects[0];

      // Act
      await user.selectOptions(languageSelect, "🇬🇧 English");

      // Assert
      // (Currently FAILS because PengaturanBody doesn't call setLocale)
      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });

    it("should call setLocale with 'id' when selecting Bahasa Indonesia", async () => {
      // Arrange — set initial locale to "en" so switching to Indonesian is a real change
      const { useLocale } = jest.requireMock("../../../hooks/use-locale");
      useLocale.mockReturnValue({
        locale: "en",
        setLocale: mockSetLocale,
        toggle: jest.fn(),
        t: mockAkunDictionaryEn,
      });

      const user = userEvent.setup();
      render(<PengaturanBody />);

      const selects = screen.getAllByRole("combobox");
      const languageSelect = selects[0];

      // Act
      await user.selectOptions(languageSelect, "🇮🇩 Bahasa Indonesia");

      // Assert
      expect(mockSetLocale).toHaveBeenCalledWith("id");
    });

    it("should display the REAL current locale from useLocale(), not the orphaned settings", async () => {
      // Arrange — mock useLocale to return "en" as current locale
      const { useLocale } = jest.requireMock("../../../hooks/use-locale");
      useLocale.mockReturnValue({
        locale: "en",
        setLocale: mockSetLocale,
        toggle: jest.fn(),
        t: mockAkunDictionaryEn,
      });

      // Act
      render(<PengaturanBody />);

      // Assert — the language select should display "🇬🇧 English"
      const selects = screen.getAllByRole("combobox");
      const languageSelect = selects[0] as HTMLSelectElement;

      // Currently this FAILS because PengaturanBody reads from orphaned
      // localStorage["wealthme_settings"], which defaults to "🇮🇩 Bahasa Indonesia"
      // regardless of what useLocale() returns
      expect(languageSelect.value).toMatch(/English/);
    });
  });

  describe("Regression: Picker value mismatch", () => {
    it("should not show a mismatch where picker says Indonesian but app is in English", async () => {
      // This is a key regression: a user opens settings while the app is actually
      // in English (because they switched via the top navbar), but the picker
      // still shows "Bahasa Indonesia" because it reads from the orphaned settings.
      // Arrange
      const { useLocale } = jest.requireMock("../../../hooks/use-locale");
      useLocale.mockReturnValue({
        locale: "en", // app is actually in English
        setLocale: mockSetLocale,
        toggle: jest.fn(),
        t: mockAkunDictionaryEn,
      });

      // Act
      render(<PengaturanBody />);

      // Assert — the picker should show English, not Indonesian
      const selects = screen.getAllByRole("combobox");
      const languageSelect = selects[0] as HTMLSelectElement;

      // Currently FAILS: languageSelect.value === "🇮🇩 Bahasa Indonesia"
      // (from orphaned settings default) instead of "🇬🇧 English"
      expect(languageSelect.value).toBe("🇬🇧 English");
    });

    it("should not show a mismatch where picker says Light but app is in Dark mode", async () => {
      // Arrange
      const { useTheme } = jest.requireMock("next-themes");
      useTheme.mockReturnValue({
        theme: "dark", // app is actually in dark mode
        setTheme: mockSetTheme,
        themes: ["light", "dark", "system"],
        systemTheme: "light",
        resolvedTheme: "dark",
      });

      // Act
      render(<PengaturanBody />);

      // Assert
      const selects = screen.getAllByRole("combobox");
      const themeSelect = selects[2] as HTMLSelectElement;

      // Currently FAILS: themeSelect.value === "☀️ Terang (Light)"
      // (from orphaned settings default) instead of "🌙 Gelap (Dark)"
      expect(themeSelect.value).toMatch(/Gelap.*Dark/);
    });
  });

  describe("Interaction: Clicking Simpan should use real setters", () => {
    it("should NOT just save to orphaned localStorage when Simpan is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PengaturanBody />);

      const selects = screen.getAllByRole("combobox");
      const languageSelect = selects[0];
      const saveButton = screen.getByText("Simpan Pengaturan");

      // Act — change language and click save
      await user.selectOptions(languageSelect, "🇬🇧 English");
      await user.click(saveButton);

      // Assert — clicking save should have triggered setLocale,
      // not just written to orphaned localStorage
      // (Currently FAILS because save() only writes to orphaned localStorage,
      // and setLocale was never called in the first place)
      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });
  });
});

describe("PengaturanBody — Currency Picker Wiring (EPIC-016 Task B2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.removeItem("wealthme_settings");
    // Re-apply the file-wide defaults — clearAllMocks() above only clears
    // call history, not implementations, but keep this explicit per-block
    // since individual tests below override mockUseProfile per case.
    mockUseProfile.mockReturnValue({
      data: { id: "user-1", email: "user@example.com", name: "Test User" },
      isLoading: false,
    });
    mockApiFetch.mockResolvedValue({
      success: true,
      data: { currency: "USD" },
    });
  });

  describe("Currency Picker", () => {
    it("should call updateProfile mutation when selecting a different currency", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PengaturanBody />);

      // Find the currency picker
      // It's a div container with currency options (not a native select)
      // currencyOptions is used in assertions below
      // For now, find by looking for the USD currency option
      // The actual selector depends on how currency picker is implemented
      const usdOption = screen.getByText(/Dollar Amerika/);

      // Act — click the USD currency option
      await user.click(usdOption);

      // Assert — the real updateProfile should have been called with currency: USD
      // (Currently FAILS because PengaturanBody doesn't call updateProfile,
      // it only writes to the orphaned settings localStorage)
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/profile"),
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("USD"),
        }),
      );
    });

    it("should display the REAL current currency from user profile, not orphaned settings", async () => {
      // Arrange — mock the profile query to return currency: "EUR"
      mockUseProfile.mockReturnValue({
        data: { currency: "EUR" },
        isLoading: false,
      });

      // Act
      render(<PengaturanBody />);

      // Assert — the currency picker should show EUR as selected,
      // not the default "IDR" from orphaned localStorage
      // (exact title text — "EUR — Euro" — since "Euro" alone also matches
      // the "€ · Euro" subtitle rendered right below it)
      const eurOption = screen.getByText("EUR — Euro");
      // The EUR option should be visually selected (has "selected" class or
      // aria-checked). The title text sits two divs deep inside the
      // selectable row, so target the row container specifically (it's the
      // only ancestor div carrying "cursor-pointer") rather than the
      // immediate wrapping div, which is just the title's own text div.
      expect(eurOption.closest("button.cursor-pointer")).toHaveClass(
        "border-primary",
      );
    });

    it("should persist to API on Simpan, not just orphaned localStorage", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PengaturanBody />);

      const usdOption = screen.getByText(/Dollar Amerika/);
      const saveButton = screen.getByText("Simpan Pengaturan");

      // Act — select USD and click save
      await user.click(usdOption);
      await user.click(saveButton);

      // Assert — save should call updateProfile API, not just write to localStorage
      // (Currently FAILS because save() only writes to orphaned localStorage)
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/profile"),
        expect.objectContaining({
          method: "PATCH",
        }),
      );

      // Verify orphaned localStorage is NOT the source of truth
      // or should sync from server, not be the only source
      expect(mockApiFetch).toHaveBeenCalled();
    });

    it("should list all 5 supported currencies (IDR, USD, SGD, EUR, JPY)", async () => {
      // Arrange
      render(<PengaturanBody />);

      // Assert — all 5 currency options should be visible
      expect(screen.getByText(/Rupiah Indonesia/)).toBeInTheDocument();
      expect(screen.getByText(/Dollar Amerika/)).toBeInTheDocument();
      expect(screen.getByText(/Dollar Singapura/)).toBeInTheDocument();
      // "Euro" alone matches both the title and subtitle text — assert the
      // full title so this stays a single-element query.
      expect(screen.getByText("EUR — Euro")).toBeInTheDocument();
      expect(screen.getByText(/Yen Jepang/)).toBeInTheDocument();
    });

    it("should show IDR selected by default when user profile has no currency set", async () => {
      // Arrange — profile has no currency field (pre-migration user)
      mockUseProfile.mockReturnValue({
        data: {
          id: "user-1",
          email: "user@example.com",
          name: "Test User",
          // currency field is missing
        },
        isLoading: false,
      });

      // Act
      render(<PengaturanBody />);

      // Assert — IDR should be shown as selected
      const idrOption = screen.getByText(/Rupiah Indonesia/);
      // See the EUR test above for why this targets the row container
      // specifically instead of the immediate (title-only) wrapping div.
      expect(idrOption.closest("button.cursor-pointer")).toHaveClass(
        "border-primary",
      );
    });
  });
});

// Note: The component tests above test the Settings currency picker wiring (RED phase).
// They should fail because currency preference integration doesn't exist yet.
// Once implemented, all tests should pass without modifying test assertions.
