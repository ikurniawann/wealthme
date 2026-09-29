/**
 * fix-round1 — Kalkulator inline validation:
 *  - Tabungan: a zero (or too-small) monthly deposit with a target above
 *    the current balance never reaches it; the old code showed the
 *    misleading "±600 Bulan" (the loop's own 600-month cap) as if that
 *    were a real estimate instead of "unreachable".
 *  - Split Group: 0 or a negative "Jumlah Orang" was silently clamped to
 *    1 person, hiding the typo behind a plausible-looking "per orang"
 *    figure computed for 1 person instead of the group.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

import KalkulatorPage from "./page";

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

// `Field` (kalkulator/page.tsx) renders a plain `<label>` (no `htmlFor`)
// followed by its input as a sibling — `getByLabelText` has nothing to
// associate them by, so locate the input via the label text instead.
function fieldInput(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  return label.nextElementSibling as HTMLInputElement;
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: "test-token", familyGroupId: "fg-1" },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
  mockApiFetch.mockResolvedValue(null);
});

describe("Tabungan — unreachable target with a zero monthly deposit", () => {
  it("shows an Indonesian inline error instead of '±600 Bulan' when the deposit can never reach the target", async () => {
    const user = userEvent.setup();
    render(<KalkulatorPage />);

    await user.click(screen.getByRole("button", { name: "Tabungan" }));

    const setorInput = fieldInput("Setoran per Bulan (Rp)");
    await user.clear(setorInput);
    await user.type(setorInput, "0");

    expect(screen.queryByText(/±600 Bulan/)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Target tidak akan tercapai dengan setoran bulanan ini, naikkan setoran per bulan atau bunga per tahun.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows a real estimate (not the error) once a workable monthly deposit is entered", async () => {
    const user = userEvent.setup();
    render(<KalkulatorPage />);

    await user.click(screen.getByRole("button", { name: "Tabungan" }));

    expect(
      screen.queryByText(
        "Target tidak akan tercapai dengan setoran bulanan ini, naikkan setoran per bulan atau bunga per tahun.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Bulan$/)).toBeInTheDocument();
  });
});

describe("Split Group — Jumlah Orang 0 or negative", () => {
  it("shows an Indonesian inline error instead of silently clamping to 1 person", async () => {
    const user = userEvent.setup();
    render(<KalkulatorPage />);

    await user.click(screen.getByRole("button", { name: "Split Group" }));

    const peopleInput = fieldInput("Jumlah Orang");
    await user.clear(peopleInput);
    await user.type(peopleInput, "0");

    expect(
      screen.getAllByText("Jumlah orang harus lebih dari 0.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Buat Split Bill/ }),
    ).toBeDisabled();
  });

  it("rejects a negative Jumlah Orang the same way", async () => {
    const user = userEvent.setup();
    render(<KalkulatorPage />);

    await user.click(screen.getByRole("button", { name: "Split Group" }));

    const peopleInput = fieldInput("Jumlah Orang");
    await user.clear(peopleInput);
    await user.type(peopleInput, "-5");

    expect(
      screen.getAllByText("Jumlah orang harus lebih dari 0.").length,
    ).toBeGreaterThan(0);
  });

  it("computes a real per-person amount once Jumlah Orang is a positive number", async () => {
    const user = userEvent.setup();
    render(<KalkulatorPage />);

    await user.click(screen.getByRole("button", { name: "Split Group" }));

    expect(
      screen.queryByText("Jumlah orang harus lebih dari 0."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Buat Split Bill/ }),
    ).not.toBeDisabled();
  });
});
