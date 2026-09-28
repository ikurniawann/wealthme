/**
 * A3 (revisi-2) — the topbar ID/EN toggle. `useLocale` reads/writes
 * `localStorage` directly (no auth/session dependency), so this renders the
 * real component rather than mocking anything out.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleSwitcher } from "./locale-switcher";

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("shows a friendly aria-label naming the current locale, not a raw code", () => {
    render(<LocaleSwitcher />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toMatch(/ID|EN/);
  });

  test("toggling flips the locale reflected in the aria-label", () => {
    render(<LocaleSwitcher />);
    const button = screen.getByRole("button");
    const before = button.getAttribute("aria-label");
    fireEvent.click(button);
    const after = button.getAttribute("aria-label");
    expect(after).not.toBe(before);
  });
});
