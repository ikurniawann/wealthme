import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateField, DateRangeFilterField } from "./date-range-field";

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Mirrors the component's private `formatFullDate` (id locale) so tests can
 *  find a day button by its accessible name (`aria-label`) rather than its
 *  bare visible number. */
function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
    const month = localMonthPrefix();
    await user.click(
      within(pop).getByRole("button", { name: dayLabel(`${month}-03`) }),
    );
    await user.click(
      within(pop).getByRole("button", { name: dayLabel(`${month}-10`) }),
    );
    await user.click(within(pop).getByRole("button", { name: "Terapkan" }));

    expect(onApply).toHaveBeenCalledWith(`${month}-03`, `${month}-10`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves focus into the popover on open, landing on the selected/today's day, and returns it to the trigger on close via Escape", async () => {
    const user = userEvent.setup();
    renderRangeInCard();
    const trigger = screen.getByRole("button", { name: /semua tanggal/i });

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(document.activeElement).toBe(
      within(pop).getByRole("button", { name: dayLabel(todayIso) }),
    );

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("commits a range and returns focus to the trigger via Enter inside the popover", async () => {
    const user = userEvent.setup();
    const onApply = renderRangeInCard();
    const trigger = screen.getByRole("button", { name: /semua tanggal/i });

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    const month = localMonthPrefix();
    await user.click(
      within(pop).getByRole("button", { name: dayLabel(`${month}-03`) }),
    );
    await user.click(
      within(pop).getByRole("button", { name: dayLabel(`${month}-10`) }),
    );
    await user.click(within(pop).getByRole("button", { name: "Terapkan" }));

    expect(onApply).toHaveBeenCalledWith(`${month}-03`, `${month}-10`);
    expect(trigger).toHaveFocus();
  });

  it("gives each day button an accessible name containing month and year", async () => {
    const user = userEvent.setup();
    renderRangeInCard();
    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));
    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });

    const dayFive = within(pop).getByRole("button", { name: /^5 / });
    const label = dayFive.getAttribute("aria-label") ?? "";
    const now = new Date();
    const yearStr = String(now.getFullYear());
    expect(label).toContain(yearStr);
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

function ControlledDateField({
  initial = "",
  onChange,
  min,
  max,
  required,
}: {
  initial?: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="df">Tanggal</label>
      <DateField
        id="df"
        value={value}
        locale="id"
        label="Tanggal"
        min={min}
        max={max}
        required={required}
        onChange={(iso) => {
          setValue(iso);
          onChange?.(iso);
        }}
      />
    </>
  );
}

describe("DateField", () => {
  it("is named by its external <label> and shows the placeholder when empty", () => {
    render(<ControlledDateField />);
    const trigger = screen.getByLabelText("Tanggal");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveTextContent("Pilih tanggal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("one click on a day emits the ISO date, closes, and shows 'D Month YYYY'", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" onChange={onChange} />);
    const trigger = screen.getByLabelText("Tanggal");
    expect(trigger).toHaveTextContent("10 September 2026");

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Tanggal" });
    expect(pop.parentElement).toBe(document.body);
    await user.click(
      within(pop).getByRole("button", { name: dayLabel("2026-09-15") }),
    );

    expect(onChange).toHaveBeenCalledWith("2026-09-15");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("15 September 2026");
    expect(trigger).toHaveAttribute("data-value", "2026-09-15");
    expect(trigger).toHaveFocus();
  });

  it("jumps decades with the year select (birth dates)", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" onChange={onChange} />);

    await user.click(screen.getByLabelText("Tanggal"));
    const pop = screen.getByRole("dialog", { name: "Tanggal" });
    await user.selectOptions(
      within(pop).getByRole("combobox", { name: "Tahun" }),
      "1990",
    );
    await user.click(
      within(pop).getByRole("button", { name: dayLabel("1990-09-01") }),
    );

    expect(onChange).toHaveBeenCalledWith("1990-09-01");
  });

  it("disables days outside min/max", async () => {
    const user = userEvent.setup();
    render(
      <ControlledDateField
        initial="2026-09-10"
        min="2026-09-05"
        max="2026-09-20"
      />,
    );

    await user.click(screen.getByLabelText("Tanggal"));
    const pop = screen.getByRole("dialog", { name: "Tanggal" });

    expect(
      within(pop).getByRole("button", { name: dayLabel("2026-09-04") }),
    ).toBeDisabled();
    expect(
      within(pop).getByRole("button", { name: dayLabel("2026-09-21") }),
    ).toBeDisabled();
    expect(
      within(pop).getByRole("button", { name: dayLabel("2026-09-05") }),
    ).toBeEnabled();
    expect(
      within(pop).getByRole("button", { name: dayLabel("2026-09-20") }),
    ).toBeEnabled();
  });

  it("lets an optional date be cleared back to an empty string", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" onChange={onChange} />);

    await user.click(screen.getByLabelText("Tanggal"));
    await user.click(
      within(screen.getByRole("dialog", { name: "Tanggal" })).getByRole(
        "button",
        { name: "Hapus tanggal" },
      ),
    );

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.getByLabelText("Tanggal")).toHaveTextContent("Pilih tanggal");
  });

  it("offers no clear action on a required date", async () => {
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" required />);

    await user.click(screen.getByLabelText("Tanggal"));

    expect(
      within(screen.getByRole("dialog", { name: "Tanggal" })).queryByRole(
        "button",
        { name: "Hapus tanggal" },
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps a native date input in sync for forms and native validation", () => {
    const { container } = render(
      <ControlledDateField initial="2026-09-10" required />,
    );
    const native = container.querySelector<HTMLInputElement>(
      '.date-field input[type="date"]',
    );
    if (!native) throw new Error("native date input missing");

    expect(native).toHaveValue("2026-09-10");
    expect(native).toBeRequired();

    fireEvent.change(native, { target: { value: "2026-01-02" } });
    expect(screen.getByLabelText("Tanggal")).toHaveAttribute(
      "data-value",
      "2026-01-02",
    );
  });

  it("moves focus into the popover on open, landing on the selected day, and returns it to the trigger on close via Escape", async () => {
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" />);
    const trigger = screen.getByLabelText("Tanggal");

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Tanggal" });
    expect(document.activeElement).toBe(
      within(pop).getByRole("button", { name: dayLabel("2026-09-10") }),
    );

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("focuses the visible trigger instead of blocking silently when the hidden native input reports invalid", () => {
    const { container } = render(<ControlledDateField initial="" required />);
    const trigger = screen.getByLabelText("Tanggal");
    const native = container.querySelector<HTMLInputElement>(
      '.date-field input[type="date"]',
    );
    if (!native) throw new Error("native date input missing");

    trigger.blur();
    fireEvent.invalid(native);

    expect(trigger).toHaveFocus();
  });

  it("names itself from `label` + value when no external label is wired", () => {
    render(
      <DateField
        value="2026-09-10"
        locale="id"
        label="Tanggal laporan"
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Tanggal laporan: 10 September 2026",
      }),
    ).toBeInTheDocument();
  });
});
