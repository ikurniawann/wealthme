import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GhostButton } from "./bento";

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
