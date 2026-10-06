// "Arus Kas" journey-flow chart (2026-10-06) — recreated locally since
// uiarc.dev's `journey-flow` block is Pro-only. Behavior coverage: it
// speaks through a single `role="img"` `aria-label` (same accessible-chart
// contract as `bento-charts.tsx`), draws one rect per node, and renders
// nothing when there is no data to show.
import { render, screen } from "@testing-library/react";

import { JourneyFlowChart, type FlowNode } from "./journey-flow-chart";

const sources: FlowNode[] = [
  { id: "gaji", label: "Gaji", value: 8_000_000, color: "var(--wm-lime)" },
  { id: "lain", label: "Lainnya", value: 2_000_000, color: "var(--wm-lime)" },
];
const destinations: FlowNode[] = [
  {
    id: "belanja",
    label: "Belanja",
    value: 4_000_000,
    color: "var(--wm-orange)",
  },
  {
    id: "__surplus",
    label: "Surplus",
    value: 6_000_000,
    color: "var(--success)",
  },
];

describe("JourneyFlowChart", () => {
  it("renders as a single accessible image carrying the summary in its aria-label", () => {
    const { container } = render(
      <JourneyFlowChart
        sources={sources}
        destinations={destinations}
        totalLabel="Pemasukan"
        totalValue={10_000_000}
        format={(v) => `Rp${v}`}
        ariaLabel="Arus Kas: Pemasukan Rp10000000, Pengeluaran Rp4000000"
      />,
    );

    const svg = screen.getByRole("img", {
      name: "Arus Kas: Pemasukan Rp10000000, Pengeluaran Rp4000000",
    });
    expect(svg).toBeInTheDocument();

    // One node rect per source, one for the total node, one per
    // destination node. Excludes each node's own 2-rect hatch-pattern
    // definition (its tonal fill) — the drawn shapes stay out of the
    // accessible name (aria-hidden), so this asserts structure, not
    // duplicate text.
    const allRects = container.querySelectorAll("rect");
    const patternRects = container.querySelectorAll("pattern rect");
    expect(allRects.length - patternRects.length).toBe(
      sources.length + 1 + destinations.length,
    );

    // One flowing ribbon per source and per destination.
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(sources.length + destinations.length);
  });

  it("renders nothing when there are no nodes on either side", () => {
    const { container } = render(
      <JourneyFlowChart
        sources={[]}
        destinations={[]}
        totalLabel="Pemasukan"
        totalValue={0}
        format={(v) => String(v)}
        ariaLabel="Arus Kas"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
