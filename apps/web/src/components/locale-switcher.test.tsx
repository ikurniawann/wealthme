/**
 * A3 (revisi-2) — the topbar ID/EN segmented switch. `useLocale` reads/writes
 * `localStorage` directly (no auth/session dependency), so this renders the
 * real component rather than mocking anything out.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleSwitcher } from "./locale-switcher";

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("renders ID and EN as a radio group with exactly one selected", () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole("radiogroup").getAttribute("aria-label")).toMatch(
      /ID|EN/,
    );
    const checked = screen
      .getAllByRole("radio")
      .filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });

  test("clicking the other language switches, clicking the active one does not", () => {
    render(<LocaleSwitcher />);
    const id = screen.getByRole("radio", { name: "ID" });
    const en = screen.getByRole("radio", { name: "EN" });
    const active = id.getAttribute("aria-checked") === "true" ? id : en;
    const other = active === id ? en : id;
    fireEvent.click(active);
    expect(active.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(other);
    expect(other.getAttribute("aria-checked")).toBe("true");
    expect(active.getAttribute("aria-checked")).toBe("false");
  });
});
