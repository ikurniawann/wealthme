import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateRangeFilterField } from "./date-range-field";

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function renderRangeInCard(onApply = jest.fn()) {
  render(
    <div
      className="card"
      data-testid="card"
      style={{ transform: "translateY(0px)" }}
    >
      <DateRangeFilterField
        from=""
        to=""
        locale="id"
        label="Rentang Tanggal"
        cancelLabel="Batal"
        applyLabel="Terapkan"
        onApply={onApply}
      />
    </div>,
  );
  return onApply;
}

describe("DateRangeFilterField — portaled popover", () => {
  it("keeps no popover in the DOM until opened", () => {
    renderRangeInCard();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("portals the open popover to document.body, outside the transformed card", async () => {
    const user = userEvent.setup();
    renderRangeInCard();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));

    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    expect(pop.parentElement).toBe(document.body);
    expect(screen.getByTestId("card")).not.toContainElement(pop);
    expect(pop).toHaveClass("date-range__pop", "date-range__pop--portal");
    expect(pop).toHaveAttribute("data-open", "true");
    expect(pop.style.top).toMatch(/px$/);
    expect(pop.style.left).toMatch(/px$/);
  });

  it("portals into the enclosing dialog popup instead of body", async () => {
    const user = userEvent.setup();
    render(
      <div data-slot="dialog-content" data-testid="host">
        <DateRangeFilterField
          from=""
          to=""
          locale="id"
          label="Rentang Tanggal"
          cancelLabel="Batal"
          applyLabel="Terapkan"
          onApply={jest.fn()}
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));

    expect(
      screen.getByRole("dialog", { name: "Rentang Tanggal" }).parentElement,
    ).toBe(screen.getByTestId("host"));
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderRangeInCard();
    const trigger = screen.getByRole("button", { name: /semua tanggal/i });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("stays open for clicks inside the popover and closes on a pointerdown outside", async () => {
    const user = userEvent.setup();
    renderRangeInCard();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));
    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    await user.click(
      within(pop).getByRole("button", { name: "Bulan berikutnya" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Rentang Tanggal" }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still applies a picked range from the portaled grid", async () => {
    const user = userEvent.setup();
    const onApply = renderRangeInCard();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));
    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    await user.click(within(pop).getByRole("button", { name: "3" }));
    await user.click(within(pop).getByRole("button", { name: "10" }));
    await user.click(within(pop).getByRole("button", { name: "Terapkan" }));

    const month = localMonthPrefix();
    expect(onApply).toHaveBeenCalledWith(`${month}-03`, `${month}-10`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("flips above the trigger and clamps to the right edge when there is no room below", async () => {
    const heightSpy = jest
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(300);
    const widthSpy = jest
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(296);
    try {
      const user = userEvent.setup();
      renderRangeInCard();
      const trigger = screen.getByRole("button", { name: /semua tanggal/i });
      trigger.getBoundingClientRect = () =>
        ({
          top: 700,
          bottom: 740,
          left: 1000,
          right: 1100,
          width: 100,
          height: 40,
          x: 1000,
          y: 700,
          toJSON: () => ({}),
        }) as DOMRect;

      await user.click(trigger);

      const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
      // jsdom viewport is 1024×768: 740 + 6 + 300 overflows, 700 − 6 − 300 = 394 fits.
      expect(pop.style.top).toBe("394px");
      expect(pop.style.left).toBe(`${1024 - 8 - 296}px`);
    } finally {
      heightSpy.mockRestore();
      widthSpy.mockRestore();
    }
  });
});
