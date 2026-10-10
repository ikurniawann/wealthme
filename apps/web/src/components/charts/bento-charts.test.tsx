import { render, screen, within } from "@testing-library/react";
import { HatchedBarChart, niceCeil } from "./bento-charts";

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

describe("HatchedBarChart, two or more series", () => {
  const mount = (props: { legend?: boolean } = {}) =>
    render(
      <HatchedBarChart
        labels={["Mei", "Jun"]}
        series={[
          { name: "Pemasukan", data: [10, 25], color: "#9ccb3b" },
          { name: "Pengeluaran", data: [4, -6], color: "#888" },
        ]}
        format={(v) => `Rp ${v}`}
        ariaLabel="Arus kas"
        {...props}
      />,
    );

  test("exposes every series value per label in the accessible data table", () => {
    mount();
    const table = screen.getByRole("table", { name: "Arus kas" });
    const jun = within(table).getByRole("row", { name: /Jun/ });
    expect(
      within(jun).getByRole("cell", { name: "Rp 25" }),
    ).toBeInTheDocument();
    expect(
      within(jun).getByRole("cell", { name: "Rp -6" }),
    ).toBeInTheDocument();
  });

  test("labels each series in its legend, and drops it on request", () => {
    const { container, unmount } = mount();
    expect(container).toHaveTextContent("Pemasukan");
    unmount();
    const { container: bare } = mount({ legend: false });
    // Only the sr-only table still names the series.
    expect(bare.querySelectorAll("table th[scope=col]")).toHaveLength(3);
    expect(
      [...bare.querySelectorAll("[aria-hidden=true] span")].map(
        (el) => el.textContent,
      ),
    ).not.toContain("Pemasukan");
  });
});
