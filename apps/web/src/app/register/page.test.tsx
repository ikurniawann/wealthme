/**
 * Polish batch 7b item 7 — the register page had a title emoji glyph, a
 * 5-line "no auto-created account" explanation, and an em-dash in the footer
 * sentence. This locks in the shortened copy so a future edit can't
 * regress it back to the wall of text.
 */
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("../../lib/auth-client", () => ({
  authClient: {
    signUp: { email: jest.fn() },
  },
}));

import { render, screen } from "@testing-library/react";

import RegisterPage from "./page";

describe("RegisterPage — polish batch 7b item 7 copy", () => {
  it("has no emoji glyph on the title", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Buat Akun Baru")).toBeInTheDocument();
  });

  it("shows the no-auto-account notice as one short line", () => {
    render(<RegisterPage />);
    expect(
      screen.getByText("Rekening pertama kamu tambahkan setelah daftar."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Tidak ada rekening yang dibuat otomatis/),
    ).not.toBeInTheDocument();
  });

  it("shows the family-member footer note with no em-dash", () => {
    render(<RegisterPage />);
    const footer = screen.getByText(
      "Anggota keluarga didaftarkan oleh kepala keluarga.",
    );
    expect(footer.textContent).not.toContain("—");
  });
});
