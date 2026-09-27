import { render, screen } from "@testing-library/react";

import { SummaryCard } from "./stat";

describe("SummaryCard — batch 1 neutral caption", () => {
  it("renders a neutral caption without a success/danger delta class when no delta is given", () => {
    render(
      <SummaryCard
        icon={<span aria-hidden="true">🧾</span>}
        iconBg="var(--accent)"
        label="Total Ditalangin"
        amount="Rp 500.000"
        caption="3 aktif"
      />,
    );

    const caption = screen.getByText("3 aktif");
    expect(caption).toHaveClass("stat__delta");
    expect(caption).toHaveClass("stat__delta--neutral");
    expect(caption).not.toHaveClass("t-success");
    expect(caption).not.toHaveClass("t-danger");
  });

  it("still renders delta with its success/danger color, ignoring caption when both are given", () => {
    render(
      <SummaryCard
        icon={<span aria-hidden="true">✅</span>}
        iconBg="var(--success-soft)"
        label="Sudah Dibayar"
        amount="Rp 200.000"
        delta="40%"
        deltaUp
        caption="ignored"
      />,
    );

    expect(screen.getByText("40%")).toHaveClass("t-success");
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
  });

  it("renders the danger delta class when deltaUp is false", () => {
    render(
      <SummaryCard
        icon={<span aria-hidden="true">⏳</span>}
        iconBg="var(--warning-soft)"
        label="Belum Dibayar"
        amount="Rp 100.000"
        delta="2 orang"
      />,
    );

    expect(screen.getByText("2 orang")).toHaveClass("t-danger");
  });
});
