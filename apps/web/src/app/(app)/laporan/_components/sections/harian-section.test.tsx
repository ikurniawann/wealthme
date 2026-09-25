import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { setLocale } from "../../../../../hooks/use-locale";
import { HarianSection } from "./harian-section";

describe("HarianSection — report day picker", () => {
  beforeEach(() => setLocale("id"));

  it("uses the shared calendar instead of a native date input", async () => {
    const onDateChange = jest.fn();
    const user = userEvent.setup();
    const { container } = render(
      <HarianSection date="2026-09-10" onDateChange={onDateChange} />,
    );

    expect(
      container.querySelector('input[type="date"]:not(.sr-only)'),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: "Tanggal laporan: 10 September 2026",
      }),
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Tanggal laporan" })).getByRole(
        "button",
        { name: /^12 / },
      ),
    );

    expect(onDateChange).toHaveBeenCalledWith("2026-09-12");
  });
});
