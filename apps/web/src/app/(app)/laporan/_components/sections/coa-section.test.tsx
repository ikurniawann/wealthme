import { fireEvent, render, screen, within } from "@testing-library/react";
import type { CoaMatrixDto } from "@wealthme/contracts";

// CoaSection reads useMoney() -> useCurrencyPreference -> useProfile ->
// useSession from lib/auth-compat -> lib/auth-client (better-auth's ESM
// client). Mock it like the sibling section tests so Jest never transforms
// that ESM module.
jest.mock("../../../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
  },
}));

import { setLocale } from "../../../../../hooks/use-locale";
import { CoaSection } from "./coa-section";

const ACCOUNTS = [{ id: "acc-1", code: "10001", name: "Gaji" }];

// Sparse year: Jan 5 (two txs), Jan 25, Mar 25. Every other month is empty
// and only days 5 and 25 carry anything.
const MATRIX: CoaMatrixDto = {
  coaAccountId: "acc-1",
  year: 2026,
  total: 16_000_000,
  cells: {
    1: {
      5: [
        { txId: "t1", amount: 5_000_000, description: "Gaji pokok" },
        { txId: "t2", amount: 1_000_000, description: "Bonus" },
      ],
      25: [{ txId: "t3", amount: 2_000_000, description: "Lembur" }],
    },
    3: {
      25: [{ txId: "t4", amount: 8_000_000, description: "THR" }],
    },
  },
};

function renderSection() {
  return render(
    <CoaSection
      coaAccounts={ACCOUNTS}
      coaAccountId="acc-1"
      onCoaAccountIdChange={() => {}}
      year={2026}
      onYearChange={() => {}}
      matrix={MATRIX}
    />,
  );
}

function bodyRowHeaders(): string[] {
  const table = screen.getByRole("table");
  const body = table.querySelector("tbody") as HTMLElement;
  return within(body)
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent ?? "");
}

describe("CoaSection — compact matrix", () => {
  beforeEach(() => setLocale("id"));

  it("hides day rows with no transactions until the toggle shows them", () => {
    renderSection();

    expect(bodyRowHeaders()).toEqual(["TOTAL", "5", "25"]);

    const toggle = screen.getByRole("button", {
      name: "Tampilkan semua tanggal",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);

    expect(bodyRowHeaders()).toHaveLength(32);
    expect(
      screen.getByRole("button", { name: "Sembunyikan tanggal kosong" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("leads the body with a TOTAL row summing each month", () => {
    renderSection();

    const totalRow = screen.getByRole("rowheader", { name: "TOTAL" })
      .parentElement as HTMLElement;
    const cells = within(totalRow).getAllByRole("cell");

    expect(cells).toHaveLength(12);
    // Jan = 5 + 1 + 2 jt, Mar = 8 jt; months without data read "–".
    expect(cells[0]).toHaveTextContent("8");
    expect(cells[0]).not.toHaveTextContent("–");
    expect(cells[1]).toHaveTextContent("–");
    expect(cells[2]).toHaveTextContent("8");
    expect(cells[11]).toHaveTextContent("–");
  });

  it("links a filled cell to /transaksi for that COA account and day", () => {
    renderSection();

    const link = screen.getByRole("link", {
      name: "Lihat transaksi 25 Maret 2026",
    });
    const url = new URL(link.getAttribute("href") as string, "https://x");
    expect(url.pathname).toBe("/transaksi");
    expect(url.searchParams.get("coa")).toBe("acc-1");
    expect(url.searchParams.get("from")).toBe("2026-03-25");
    expect(url.searchParams.get("to")).toBe("2026-03-25");
  });
});

describe("CoaSection — Ringkas view", () => {
  beforeEach(() => setLocale("id"));

  function openSummary() {
    renderSection();
    fireEvent.click(screen.getByRole("radio", { name: "Ringkas" }));
  }

  it("renders one row per month and disables months without data", () => {
    openSummary();

    const list = screen.getByRole("list", { name: "Total per bulan" });
    const rows = within(list).getAllByRole("button");
    expect(rows).toHaveLength(12);

    expect(rows[0]).toBeEnabled();
    expect(rows[0]).toHaveTextContent("3 trx");
    expect(rows[1]).toBeDisabled();
    expect(rows[1]).toHaveTextContent("Belum ada");
    expect(rows[2]).toBeEnabled();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("expands a month into its transactions sorted by date", () => {
    openSummary();

    const list = screen.getByRole("list", { name: "Total per bulan" });
    const jan = within(list).getAllByRole("button")[0];
    expect(jan).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(jan);

    expect(jan).toHaveAttribute("aria-expanded", "true");
    const txList = document.getElementById(
      jan.getAttribute("aria-controls") as string,
    ) as HTMLElement;
    const items = within(txList).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Gaji pokok"),
      expect.stringContaining("Bonus"),
      expect.stringContaining("Lembur"),
    ]);
    expect(items[2]).toHaveTextContent("25 Jan");

    // Each row is a real link to that transaction's detail on /transaksi.
    const link = within(items[2]).getByRole("link");
    expect(link).toHaveAccessibleName(
      expect.stringContaining("Lihat transaksi 25 Januari 2026"),
    );
    const url = new URL(link.getAttribute("href") as string, "https://x");
    expect(url.pathname).toBe("/transaksi");
    expect(url.searchParams.get("tx")).toBe("t3");
    expect(url.searchParams.get("from")).toBe("2026-01-25");
  });

  it("shows the yearly KPIs above the month rows", () => {
    openSummary();

    expect(screen.getByText("Rata-rata per bulan aktif")).toBeVisible();
    expect(screen.getByText("Jumlah transaksi")).toBeVisible();
  });
});
