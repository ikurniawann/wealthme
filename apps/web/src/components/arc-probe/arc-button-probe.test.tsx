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
  // Motion captures matchMedia on first render, so exercise both preferences first.
  it("removes label travel and blur when reduced motion is preferred", () => {
    const original = window.matchMedia;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const preference = { matches: false };
    const notifyPreferenceChange = () => {
      const event = new Event("change");
      listeners.forEach((listener) => {
        if (typeof listener === "function") listener(event);
        else listener.handleEvent(event);
      });
    };
    window.matchMedia = (query) =>
      ({
        get matches() {
          return preference.matches;
        },
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject | null,
        ) => {
          if (type === "change" && listener) listeners.add(listener);
        },
        removeEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject | null,
        ) => {
          if (type === "change" && listener) listeners.delete(listener);
        },
        dispatchEvent: () => false,
      }) as MediaQueryList;

    try {
      const normal = render(<ArcButtonProbe label="Simpan" />);
      normal.rerender(<ArcButtonProbe label="Tersimpan" />);
      const normalStyle = screen.getByText("Tersimpan").getAttribute("style");
      normal.unmount();

      preference.matches = true;
      notifyPreferenceChange();
      const reduced = render(<ArcButtonProbe label="Simpan" />);
      reduced.rerender(<ArcButtonProbe label="Tersimpan" />);
      const reducedStyle = screen.getByText("Tersimpan").getAttribute("style");

      expect(normalStyle).toContain("blur(4px)");
      expect(normalStyle).toContain("translateY(4px)");
      expect(reducedStyle).toContain("blur(0px)");
      expect(reducedStyle).not.toContain("translateY(4px)");
    } finally {
      preference.matches = false;
      notifyPreferenceChange();
      window.matchMedia = original;
    }
  });

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
});
