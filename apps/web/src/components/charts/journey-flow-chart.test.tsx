// "Arus Kas" journey-flow chart (2026-10-06) — recreated locally since
// uiarc.dev's `journey-flow` block is Pro-only. Behavior coverage: it
// speaks through a single `role="img"` `aria-label` (same accessible-chart
// contract as `bento-charts.tsx`), draws one rect per node, renders
// nothing when there is no data to show, and dims every ribbon except the
// one under the pointer on hover/tap.
import { fireEvent, render, screen } from "@testing-library/react";

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

  it("dims every other ribbon on hover, and only the hovered one — never a fabricated source-to-destination path", () => {
    const { container } = render(
      <JourneyFlowChart
        sources={sources}
        destinations={destinations}
        totalLabel="Pemasukan"
        totalValue={10_000_000}
        format={(v) => `Rp${v}`}
        ariaLabel="Arus Kas"
      />,
    );

    const ribbons = container.querySelectorAll("path");
    const [gajiRibbon] = ribbons;
    fireEvent.pointerEnter(gajiRibbon);

    const opacities = Array.from(ribbons).map((p) => p.getAttribute("opacity"));
    // The hovered ribbon (gaji, index 0) is boosted; every other ribbon —
    // including the ones on the opposite (destination) side — is dimmed.
    // No ribbon on the destination side is ever boosted by hovering a
    // source: this chart has no per-transaction data linking a specific
    // income category to a specific expense category, so highlighting a
    // "path" across the Total node would fabricate a connection the API
    // doesn't provide.
    expect(opacities[0]).toBe("0.9");
    for (const opacity of opacities.slice(1)) {
      expect(opacity).toBe("0.1");
    }

    fireEvent.pointerLeave(gajiRibbon);
    for (const opacity of Array.from(ribbons).map((p) =>
      p.getAttribute("opacity"),
    )) {
      expect(opacity).toBe("0.55");
    }
  });

  it("tapping (click) toggles the same highlight a hover would, for touch devices", () => {
    const { container } = render(
      <JourneyFlowChart
        sources={sources}
        destinations={destinations}
        totalLabel="Pemasukan"
        totalValue={10_000_000}
        format={(v) => `Rp${v}`}
        ariaLabel="Arus Kas"
      />,
    );

    const [gajiRibbon] = container.querySelectorAll("path");
    fireEvent.click(gajiRibbon);
    expect(gajiRibbon.getAttribute("opacity")).toBe("0.9");

    fireEvent.click(gajiRibbon);
    expect(gajiRibbon.getAttribute("opacity")).toBe("0.55");
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
