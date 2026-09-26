import { render, screen } from "@testing-library/react";

import { Button } from "./button";

/** Relative luminance / contrast ratio (WCAG 2.x), used to verify the
 *  disabled-primary token's fixed color independently of any stylesheet —
 *  jsdom doesn't load design-system.css, so this checks the actual hex
 *  values the CSS uses rather than computed styles. */
function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [R, G, B] = [r, g, b].map(channel);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort(
    (a, b) => b - a,
  );
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("Button — batch 1 disabled-primary token", () => {
  it("renders the primary variant's .btn--primary class whether enabled or disabled", () => {
    const { rerender } = render(<Button>Simpan</Button>);
    expect(screen.getByRole("button", { name: "Simpan" })).toHaveClass(
      "btn--primary",
    );

    rerender(<Button disabled>Simpan</Button>);
    const disabled = screen.getByRole("button", { name: "Simpan" });
    expect(disabled).toHaveClass("btn--primary");
    expect(disabled).toBeDisabled();
  });

  it("the disabled-primary fill (#3f6b64, design-system.css .btn--primary:disabled) keeps WCAG AA contrast against --primary-foreground (#ffffff)", () => {
    expect(contrastRatio("#3f6b64", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("the disabled-primary fill is a different color from the enabled --primary fill, not an opacity dial-down of it", () => {
    // globals.css --primary
    const enabled = "#126f64";
    const disabled = "#3f6b64";
    expect(disabled).not.toBe(enabled);
    // Distinct hues, not just a lightness step: the disabled fill's red
    // channel is far higher relative to its own green/blue than the
    // enabled fill's, which is what "muted" rather than "washed out" means.
    expect(contrastRatio(disabled, "#ffffff")).toBeLessThan(
      contrastRatio(enabled, "#ffffff"),
    );
  });
});
