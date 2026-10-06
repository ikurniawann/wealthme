// Defect fix (2026-10-06): MoneyCurrencyPicker rendered its own unconditional
// <Check> icon on every DropdownMenuRadioItem, duplicating the item's own
// Base UI RadioItemIndicator (which already shows only for the checked
// value) — every currency row showed a checkmark instead of only the
// selected one.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MoneyCurrencyPicker } from "./currency-picker";

describe("MoneyCurrencyPicker", () => {
  it("shows a check only on the selected currency, not every option", async () => {
    const user = userEvent.setup();
    render(<MoneyCurrencyPicker value="SGD" onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Mata uang/i }));

    const options = await screen.findAllByRole("menuitemradio");
    expect(options.length).toBeGreaterThan(1);

    const checked = options.filter(
      (option) => option.getAttribute("aria-checked") === "true",
    );
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent("SGD");

    // Base UI only mounts RadioItemIndicator's children for the checked
    // item — this is the actual DOM assertion the icon-duplication bug
    // broke (every item had its own always-rendered <svg>).
    for (const option of options) {
      const svgCount = option.querySelectorAll("svg").length;
      if (option.getAttribute("aria-checked") === "true") {
        expect(svgCount).toBe(1);
      } else {
        expect(svgCount).toBe(0);
      }
    }
  });

  it("switches selection on click", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<MoneyCurrencyPicker value="SGD" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Mata uang/i }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: /IDR/i }),
    );

    expect(onChange).toHaveBeenCalledWith("IDR");
  });
});
