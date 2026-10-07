import { render, screen, within } from "@testing-library/react";
import { FlowStackChart, niceCeil } from "./bento-charts";

describe("niceCeil (chart axis top, prototype `nice`)", () => {
  test.each([
    [0, 1],
    [-5, 1],
    [0.8, 1],
    [1, 1],
    [1.4, 2],
    [2.2, 2.5],
    [3, 5],
    [7, 10],
    [84_320_500, 100_000_000],
    [21_000_000, 25_000_000],
  ])("%p rounds up to %p", (value, expected) => {
    expect(niceCeil(value)).toBe(expected);
  });
});

describe("FlowStackChart (Beranda hero)", () => {
  const days = [
    { label: "Sen", net: 6, income: 10, expense: 4 },
    { label: "Kam", net: 19, income: 25, expense: 6 },
  ];
  const mount = () =>
    render(
      <FlowStackChart
        days={days}
        format={(v) => `Rp ${v}`}
        labels={{
          net: "Selisih",
          income: "Pemasukan",
          expense: "Pengeluaran",
        }}
        ariaLabel="Arus kas"
      />,
    );

  // UIArc chart swap (uiarc.dev/components): FlowStackChart now renders
  // Arc's Streamgraph, which exposes its data through an accessible sr-only
  // <table> (not the old hover-tooltip div) and a legend with visible series
  // labels, instead of raw SVG rects + a `.wm-chart-tip` div. `net` has no
  // slot in Arc's per-series table/tooltip and is intentionally dropped —
  // see the swap comment on `FlowStackChart` in bento-charts.tsx.
  test("exposes income and expense for every day in the accessible data table", () => {
    mount();
    const table = screen.getByRole("table", { name: "Arus kas" });
    const kamisRow = within(table).getByRole("row", { name: /Kam/ });
    expect(
      within(kamisRow).getByRole("cell", { name: "Rp 25" }),
    ).toBeInTheDocument();
    expect(
      within(kamisRow).getByRole("cell", { name: "Rp 6" }),
    ).toBeInTheDocument();
  });

  test("shows a legend toggle labeled for each series", () => {
    mount();
    expect(
      screen.getByRole("button", { name: "Pemasukan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pengeluaran" }),
    ).toBeInTheDocument();
  });
});
