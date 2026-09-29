import { render, screen } from "@testing-library/react";
import { TransactionSummary } from "./transaction-summary";

describe("TransactionSummary", () => {
  it("retains all three totals and their labels in the compact summary", () => {
    render(
      <TransactionSummary
        ariaLabel="Ringkasan transaksi"
        items={[
          {
            label: "Total Pemasukan",
            value: "Rp 1.250.000",
            detail: "2 transaksi",
            valueClassName: "text-success",
          },
          {
            label: "Total Pengeluaran",
            value: "Rp 425.000",
            detail: "1 transaksi",
            valueClassName: "text-destructive",
          },
          {
            label: "Selisih",
            value: "Rp 825.000",
            detail: "Surplus 66% dari pemasukan",
            valueClassName: "text-success",
          },
        ]}
      />,
    );

    const summary = screen.getByRole("group", { name: "Ringkasan transaksi" });
    for (const text of [
      "Total Pemasukan",
      "Rp 1.250.000",
      "2 transaksi",
      "Total Pengeluaran",
      "Rp 425.000",
      "1 transaksi",
      "Selisih",
      "Rp 825.000",
      "Surplus 66% dari pemasukan",
    ]) {
      expect(summary).toHaveTextContent(text);
    }
  });
});
