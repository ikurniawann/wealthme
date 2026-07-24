/**
 * EPIC-016 Task F — /laporan header decorative controls removed.
 *
 * The page header used to render a Calendar button, a hardcoded period
 * <select> (no value/onChange), and a Download button that only fired
 * toast() messages with no real effect — duplicating the real "Export
 * Laporan" section already on this page (real POST /exports + polling +
 * download). Per the epic decision, these were removed rather than wired:
 * a genuine per-section period filter across all 11 disparate report
 * shapes is EPIC-020's scope, not this task's.
 *
 * This test asserts the decorative controls are gone and the rest of the
 * page (subtitle, tab bar) still renders correctly.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock auth-client so useSession() (via lib/auth-compat) resolves to an
// unauthenticated session — keeps every data-fetching useQuery() disabled
// so this test never needs to mock apiFetch/network calls.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

// LaporanInner calls useRouter() and useSearchParams() (next/navigation) —
// not present without a real Next.js App Router, so both must be mocked.
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LaporanInner } from "./page";

// LaporanInner calls several useQuery() hooks directly, which need a
// QueryClientProvider ancestor that plain @testing-library/react.render()
// doesn't provide.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

describe("Laporan header — decorative controls removed (EPIC-016 Task F)", () => {
  it("does not render the decorative calendar button", () => {
    render(<LaporanInner />);
    expect(screen.queryByLabelText("Kalender")).not.toBeInTheDocument();
  });

  it("does not render the hardcoded, unwired period select", () => {
    render(<LaporanInner />);
    expect(screen.queryByText("April 2025")).not.toBeInTheDocument();
    expect(screen.queryByText("Maret 2025")).not.toBeInTheDocument();
    expect(screen.queryByText("Februari 2025")).not.toBeInTheDocument();
  });

  it("does not render the decorative header download button", () => {
    render(<LaporanInner />);
    expect(screen.queryByLabelText("Unduh")).not.toBeInTheDocument();
  });

  it("still renders the page subtitle and the real tab bar", () => {
    render(<LaporanInner />);
    expect(
      screen.getByText("Pantau keuangan dan investasi kamu"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ringkasan")).toBeInTheDocument();
    expect(screen.getByText("Bulanan")).toBeInTheDocument();
    expect(screen.getByText("Pajak")).toBeInTheDocument();
  });
});
