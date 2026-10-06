import { fireEvent, render } from "@testing-library/react";
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

  test("pins no tooltip until a column is hovered or focused", () => {
    const { container } = mount();
    expect(container.querySelector(".wm-chart-tip")).toBeNull();
    const column = container.querySelectorAll("g[tabindex='0']")[1];
    fireEvent.mouseEnter(column);
    expect(container.querySelector(".wm-chart-tip")).toHaveTextContent("Kam");
    fireEvent.mouseLeave(column);
    expect(container.querySelector(".wm-chart-tip")).toBeNull();
    fireEvent.focus(column);
    expect(container.querySelector(".wm-chart-tip")).toHaveTextContent("Kam");
    expect(container.querySelector(".wm-chart-tip")).toHaveTextContent(
      "SelisihRp 19",
    );
  });

  test("keeps each series in its own hue; other columns only lose opacity", () => {
    const { container } = mount();
    const bars = () =>
      Array.from(
        container.querySelectorAll<SVGRectElement>("rect.wm-chart-bar"),
      );
    const before = bars().map((bar) => bar.getAttribute("fill"));
    expect(before.some((fill) => fill?.includes("ghost"))).toBe(false);
    fireEvent.mouseEnter(container.querySelectorAll("g[tabindex='0']")[1]);
    expect(bars().map((bar) => bar.getAttribute("fill"))).toEqual(before);
    expect(bars()[0].style.opacity).toBe("0.5");
    expect(bars()[bars().length - 1].style.opacity).toBe("");
  });
});
