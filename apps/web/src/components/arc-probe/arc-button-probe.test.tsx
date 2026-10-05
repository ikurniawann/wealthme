import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ArcButtonProbe } from "./arc-button-probe";

beforeAll(() => {
  // Motion's keyboard press support dispatches PointerEvent; jsdom 20 lacks it.
  Object.defineProperty(window, "PointerEvent", {
    value: MouseEvent,
    configurable: true,
  });
});

describe("ArcButtonProbe", () => {
  it("keeps its supplied label as the button name", () => {
    render(<ArcButtonProbe label="Simpan" />);
    expect(screen.getByRole("button", { name: "Simpan" })).toBeVisible();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("does not activate while disabled", async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(<ArcButtonProbe label="Simpan" disabled onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Simpan" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("announces loading, retains its label and focus, and cannot activate", async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ArcButtonProbe label="Simpan" onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "Simpan" });
    button.focus();

    rerender(<ArcButtonProbe label="Simpan" loading onClick={onClick} />);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Memproses Simpan");
    await user.click(button);
    await user.keyboard("{Enter} ");
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(["{Enter}", " "])("activates with %s", async (key) => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(<ArcButtonProbe label="Simpan" onClick={onClick} />);

    screen.getByRole("button", { name: "Simpan" }).focus();
    await user.keyboard(key);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the button stationary under reduced motion", async () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    });
    try {
      const user = userEvent.setup();
      render(<ArcButtonProbe label="Simpan" />);
      const button = screen.getByRole("button", { name: "Simpan" });
      await user.pointer({ keys: "[MouseLeft>]", target: button });
      expect(button).not.toHaveStyle({ transform: "scale(0.97)" });
    } finally {
      window.matchMedia = original;
    }
  });
});
