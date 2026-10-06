import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { GhostButton, Segmented } from "./bento";

describe("GhostButton", () => {
  it("does not submit its surrounding form unless the caller overrides type", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn((event: React.FormEvent) =>
      event.preventDefault(),
    );
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <GhostButton>Neutral action</GhostButton>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Neutral action" }));
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <form onSubmit={onSubmit}>
        <GhostButton type="submit">Submit action</GhostButton>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Submit action" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it.each(["{Enter}", " "])(
    "activates its caller action with keyboard key %s",
    async (key) => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      render(<GhostButton onClick={onClick}>Action</GhostButton>);
      const button = screen.getByRole("button", { name: "Action" });

      button.focus();
      await user.keyboard(key);

      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps a disabled action non-activating", () => {
    const onClick = jest.fn();
    render(
      <GhostButton disabled onClick={onClick}>
        Disabled action
      </GhostButton>,
    );
    const button = screen.getByRole("button", { name: "Disabled action" });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Segmented", () => {
  function Example() {
    const [value, setValue] = useState<"day" | "week" | "month">("day");
    return (
      <Segmented
        label="Rentang"
        value={value}
        onChange={setValue}
        options={[
          { value: "day", label: "Hari" },
          { value: "week", label: "Minggu" },
          { value: "month", label: "Bulan" },
        ]}
      />
    );
  }

  it("marks only the selected option as aria-pressed and switches on click", async () => {
    const user = userEvent.setup();
    render(<Example />);

    expect(screen.getByRole("button", { name: "Hari" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Minggu" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Minggu" }));

    expect(screen.getByRole("button", { name: "Minggu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Hari" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders the sliding indicator only inside the selected option", () => {
    render(<Example />);

    const selected = screen.getByRole("button", { name: "Hari" });
    const unselected = screen.getByRole("button", { name: "Minggu" });

    expect(selected.querySelector(".wm-seg-indicator")).toBeInTheDocument();
    expect(
      unselected.querySelector(".wm-seg-indicator"),
    ).not.toBeInTheDocument();
  });

  it("exposes the group via role=group and the given label", () => {
    render(<Example />);

    expect(screen.getByRole("group", { name: "Rentang" })).toBeInTheDocument();
  });
});
