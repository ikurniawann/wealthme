import { render, screen } from "@testing-library/react";
import { CountUpRupiah } from "./motion";

// C5 (client revision round 2) — CountUpRupiah gained an optional `format`
// prop so pages that display a converted currency can pass
// `useMoney().format` instead of always rendering plain IDR. Reduced-motion
// is forced here so the counted value settles to `value` synchronously
// (no requestAnimationFrame loop to await in the test).
beforeEach(() => {
  window.matchMedia = function matchMedia(query: string): MediaQueryList {
    return {
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
});

describe("CountUpRupiah", () => {
  it("defaults to plain IDR formatting", async () => {
    render(<CountUpRupiah value={1_500_000} />);
    expect(await screen.findByText("Rp 1.500.000")).toBeInTheDocument();
  });

  it("routes through a custom formatter (e.g. useMoney().format) when given", async () => {
    const usdFormat = (idr: number) => `≈ $${(idr / 15000).toFixed(2)}`;
    render(<CountUpRupiah value={1_500_000} format={usdFormat} />);
    expect(await screen.findByText("≈ $100.00")).toBeInTheDocument();
  });
});
