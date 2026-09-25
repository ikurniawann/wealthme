/**
 * Revisi E — the display-currency picker offers IDR, Emas and a select of
 * every foreign FX code (with flags). Default locale is "id".
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { setLocale } from "../../../../hooks/use-locale";
import { RingkasanPageLead } from "./page-lead";
import type { DisplayCurrency } from "./display-currency";
import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";

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

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function renderTrendLead(
  trendRange: TrendRangeKey,
  customRange: TrendCustomRange = { from: "", to: "" },
) {
  const onCustomRangeChange = jest.fn();
  const result = render(
    <RingkasanPageLead
      familyName="Keluarga Demo"
      todayLabel="25 September 2026"
      trendRange={trendRange}
      onTrendRangeChange={jest.fn()}
      customRange={customRange}
      onCustomRangeChange={onCustomRangeChange}
      displayCurrency="IDR"
      onDisplayCurrencyChange={jest.fn()}
      privacyOn={false}
      onTogglePrivacy={jest.fn()}
    />,
  );
  return { ...result, onCustomRangeChange };
}

describe("RingkasanPageLead — custom trend range", () => {
  beforeEach(() => setLocale("id"));

  it("renders no range picker unless the custom range is selected", () => {
    renderTrendLead("6m");
    expect(
      screen.queryByRole("button", { name: /semua tanggal/i }),
    ).not.toBeInTheDocument();
  });

  it("uses the shared range picker, not two native date inputs", async () => {
    const user = userEvent.setup();
    const { container, onCustomRangeChange } = renderTrendLead("custom");

    expect(container.querySelector('input[type="date"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));
    const pop = screen.getByRole("dialog", { name: "Kustom" });
    await user.click(within(pop).getByRole("button", { name: "3" }));
    await user.click(within(pop).getByRole("button", { name: "10" }));
    await user.click(within(pop).getByRole("button", { name: "Simpan" }));

    const month = localMonthPrefix();
    expect(onCustomRangeChange).toHaveBeenCalledWith({
      from: `${month}-03`,
      to: `${month}-10`,
    });
  });

  it("shows the chosen custom range on the trigger", () => {
    renderTrendLead("custom", { from: "2026-08-01", to: "2026-08-15" });
    expect(
      screen.getByRole("button", { name: "1 – 15 Agustus 2026" }),
    ).toBeInTheDocument();
  });
});
