/**
 * Hardening batch G2 — akun Tentang's Privacy Policy / Terms / License rows
 * and the register/login footer used to only toast "belum tersedia". These
 * now link to real draft pages, each honestly marked "Draf, belum final".
 */

import { render, screen } from "@testing-library/react";

import PrivacyPolicyPage from "./privasi/page";
import TermsPage from "./syarat/page";
import OpenSourceLicensesPage from "./lisensi/page";

describe("/legal pages", () => {
  it("privasi page shows the draft disclaimer and a UU PDP reference", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(/Draf, belum final/)).toBeInTheDocument();
    expect(screen.getByText(/Nomor 27 Tahun 2022/)).toBeInTheDocument();
  });

  it("syarat page shows the draft disclaimer", () => {
    render(<TermsPage />);
    expect(screen.getByText(/Draf, belum final/)).toBeInTheDocument();
  });

  it("lisensi page lists major open-source dependencies", () => {
    render(<OpenSourceLicensesPage />);
    expect(screen.getByText("Next.js")).toBeInTheDocument();
    expect(screen.getByText("Prisma")).toBeInTheDocument();
  });
});
