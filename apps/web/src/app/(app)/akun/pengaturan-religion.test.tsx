/**
 * EPIC-023 Group F fix round.
 *
 * HIGH 3 — the religion `<select>` (rendered via the shared `Field` helper)
 * had no accessible name: `Field`'s `<label>` carried no `htmlFor`. Fails
 * against pre-fix code (no `Field` consumer, including this one, exposed an
 * accessible name via `getByLabelText`/`getByRole(..., { name })`).
 *
 * MEDIUM 9 — "not yet chosen" is now representable (`religion === null`),
 * distinct from all three real choices, with its own honest UI: a disabled
 * placeholder in the owner's picker, and its own label for a non-owner.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockAkunDictionary } from "../../../i18n/id";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
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

const mockUpdateReligion = jest.fn();
const mockUseFamilyReligion = jest.fn();
jest.mock("../../../hooks/use-family-religion", () => ({
  useFamilyReligion: () => mockUseFamilyReligion(),
}));

jest.mock("../../../hooks/use-profile", () => ({
  useProfile: () => ({
    data: { id: "user-1", email: "user@example.com", name: "Test User" },
    isLoading: false,
  }),
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { PengaturanBody } from "./page";

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

describe("PengaturanBody — family religion setting (EPIC-023 Group F)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({});
  });

  it("HIGH 3: the religion select has an accessible name via its label", () => {
    mockUseFamilyReligion.mockReturnValue({
      religion: "islam",
      isOwner: true,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });

    render(<PengaturanBody />);

    expect(
      screen.getByRole("combobox", { name: /agama keluarga/i }),
    ).toBeInTheDocument();
  });

  it("MEDIUM 9: an unconfirmed family shows a disabled placeholder, not a fabricated choice", async () => {
    mockUseFamilyReligion.mockReturnValue({
      religion: null,
      isOwner: true,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });

    render(<PengaturanBody />);

    const select = screen.getByRole("combobox", { name: /agama keluarga/i });
    expect(select).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Pilih agama keluarga" }),
    ).toBeDisabled();

    const user = userEvent.setup();
    await user.selectOptions(select, "kristen");

    expect(mockUpdateReligion).toHaveBeenCalledWith(
      "kristen",
      expect.anything(),
    );
  });

  it("MEDIUM 9: a non-owner viewing an unconfirmed family sees an honest 'not yet chosen' label", () => {
    mockUseFamilyReligion.mockReturnValue({
      religion: null,
      isOwner: false,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });

    render(<PengaturanBody />);

    expect(screen.getByText("Belum dipilih")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /agama keluarga/i }),
    ).not.toBeInTheDocument();
  });
});
