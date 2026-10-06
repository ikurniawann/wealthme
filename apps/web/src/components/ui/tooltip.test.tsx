import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// Batch 2 behavior coverage — see dialog.test.tsx. Arc's tooltip exposes
// only `content`/`children`/`side` ("top" | "bottom"); this file keeps the
// Base UI `TooltipProvider` delay, all four `side`s, `align`/`alignOffset`
// and the arrow real consumers (investasi and others) already use.
describe("Tooltip — Base UI primitive, Batch 2 behavior coverage", () => {
  function Example() {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Info</TooltipTrigger>
          <TooltipContent>Keterangan tambahan</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  it("is hidden until the trigger receives focus, then shows the content", async () => {
    const user = userEvent.setup();
    render(<Example />);

    expect(screen.queryByText("Keterangan tambahan")).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("button", { name: "Info" })).toHaveFocus();

    expect(await screen.findByText("Keterangan tambahan")).toBeInTheDocument();
  });

  it("hides again once focus leaves the trigger", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Example />
        <button type="button">Elemen lain</button>
      </>,
    );

    await user.tab();
    await screen.findByText("Keterangan tambahan");

    await user.tab();
    expect(screen.getByRole("button", { name: "Elemen lain" })).toHaveFocus();

    await waitFor(() => {
      expect(screen.queryByText("Keterangan tambahan")).not.toBeInTheDocument();
    });
  });

  it("dismisses on Escape without moving focus off the trigger", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.tab();
    const trigger = screen.getByRole("button", { name: "Info" });
    expect(trigger).toHaveFocus();
    await screen.findByText("Keterangan tambahan");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Keterangan tambahan")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
