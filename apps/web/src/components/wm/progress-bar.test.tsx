import { render, screen } from "@testing-library/react";

import { ProgressBar } from "./progress-bar";

describe("ProgressBar — Arc UI adaptation", () => {
  it("clamps the value and exposes a named progressbar", () => {
    render(
      <ProgressBar value={130} ariaLabel="Alokasi ahli waris" height={10} />,
    );

    const progress = screen.getByRole("progressbar", {
      name: "Alokasi ahli waris",
    });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(progress).toHaveAttribute("aria-valuenow", "100");
    expect(progress).toHaveAttribute("aria-valuetext", "100%");
    expect(progress).toHaveStyle({ "--progress-height": "10px" });
    expect(progress.querySelector('[data-uiarc="progress-fill"]')).toBeTruthy();
  });

  it("keeps custom color and class while clamping invalid values safely", () => {
    render(
      <ProgressBar
        value={Number.NaN}
        color="linear-gradient(90deg, green, blue)"
        className="custom-progress"
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(progress).toHaveAttribute("aria-valuetext", "0%");
    expect(progress).toHaveClass("custom-progress");
    expect(progress).toHaveStyle({
      "--progress-color": "linear-gradient(90deg, green, blue)",
    });
  });
});
