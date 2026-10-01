import { render, screen } from "@testing-library/react";

// Batch C — HarianSection now reads useMoney() (DisplayCurrencyProvider's
// hook), which pulls in useCurrencyPreference -> useProfile -> useSession
// from lib/auth-compat -> lib/auth-client (better-auth's ESM client). Mock
// it the same way laporan-balance.test.tsx already does so Jest never has
// to transform that ESM module.
jest.mock("../../../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
  },
}));

import { setLocale } from "../../../../../hooks/use-locale";
import { HarianSection } from "./harian-section";

// The day picker moved to the shared hero (laporan-inner.tsx owns it) — this
// section no longer renders its own date field or a bare page heading, only
// the KPI tiles and the transaction list card.
describe("HarianSection — card content", () => {
  beforeEach(() => setLocale("id"));

  it("renders no date picker of its own", () => {
    const { container } = render(<HarianSection />);

    expect(
      container.querySelector('input[type="date"]:not(.sr-only)'),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Tanggal laporan/ }),
    ).toBeNull();
  });

  it("shows the honest empty state when there are no transactions", () => {
    render(<HarianSection />);

    expect(screen.getByText("Tidak ada transaksi hari ini")).toBeVisible();
  });
});
