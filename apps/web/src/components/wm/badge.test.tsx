import { render, screen } from "@testing-library/react";

import { StatusBadge } from "./badge";

describe("StatusBadge — Arc UI adaptation", () => {
  it.each([
    ["success", "success"],
    ["danger", "danger"],
    ["warning", "warning"],
    ["info", "info"],
    ["purple", "purple"],
    ["gray", "neutral"],
  ] as const)("keeps the %s WealthMe variant mapped to %s", (variant, tone) => {
    render(<StatusBadge variant={variant}>Status</StatusBadge>);

    const badge = screen.getByText("Status");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveAttribute("data-uiarc", "badge");
    expect(badge).toHaveAttribute("data-tone", tone);
  });

  it("keeps custom classes and renders its label as readable text", () => {
    render(
      <StatusBadge className="custom-status" variant="success">
        Aktif
      </StatusBadge>,
    );

    const badge = screen.getByText("Aktif");
    expect(badge).toHaveClass("custom-status");
    expect(badge).toHaveTextContent("Aktif");
  });
});
