/**
 * Revisi E — the display-currency picker offers IDR, Emas and a select of
 * every foreign FX code (with flags). Default locale is "id".
 */

import { fireEvent, render, screen, within } from "@testing-library/react";

import { RingkasanPageLead } from "./page-lead";
import type { DisplayCurrency } from "./display-currency";

function renderLead(displayCurrency: DisplayCurrency) {
  const onDisplayCurrencyChange = jest.fn();
  render(
    <RingkasanPageLead
      familyName="Keluarga Demo"
      todayLabel="25 September 2026"
      trendRange="12m"
      onTrendRangeChange={jest.fn()}
      customRange={{ from: "2026-06-25", to: "2026-09-25" }}
      onCustomRangeChange={jest.fn()}
      displayCurrency={displayCurrency}
      onDisplayCurrencyChange={onDisplayCurrencyChange}
      privacyOn={false}
      onTogglePrivacy={jest.fn()}
    />,
  );
  const select = screen.getByRole("combobox", {
    name: "Mata uang asing",
  }) as HTMLSelectElement;
  return { onDisplayCurrencyChange, select };
}

describe("RingkasanPageLead — display currency picker", () => {
  it("offers IDR, Emas and every foreign FX currency with its flag", () => {
    const { select } = renderLead("IDR");

    expect(screen.getByRole("tab", { name: "IDR" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Emas" })).toBeInTheDocument();
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["🇺🇸 USD", "🇸🇬 SGD", "🇪🇺 EUR", "🇯🇵 JPY", "🇦🇺 AUD", "🇨🇳 CNY"]);
  });

  it("picking a foreign currency switches the display currency", () => {
    const { onDisplayCurrencyChange, select } = renderLead("IDR");

    fireEvent.change(select, { target: { value: "JPY" } });

    expect(onDisplayCurrencyChange).toHaveBeenCalledWith("JPY");
  });

  it("an idle select shows the placeholder, so re-picking USD from Emas still fires", () => {
    const { onDisplayCurrencyChange, select } = renderLead("GOLD");
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "USD" } });

    expect(onDisplayCurrencyChange).toHaveBeenCalledWith("USD");
  });

  it("a foreign selection shows in the select and deselects IDR/Emas", () => {
    const { select } = renderLead("EUR");

    expect(select.value).toBe("EUR");
    expect(screen.getByRole("tab", { name: "IDR" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Emas" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("clicking Emas selects GOLD", () => {
    const { onDisplayCurrencyChange } = renderLead("IDR");

    fireEvent.click(screen.getByRole("tab", { name: "Emas" }));

    expect(onDisplayCurrencyChange).toHaveBeenCalledWith("GOLD");
  });
});
