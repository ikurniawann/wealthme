import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

// Batch 2 behavior coverage — see dialog.test.tsx for why this gap mattered.
// Arc's own dropdown-menu is Radix + a flat `items` array (a different
// consumer API from this file's child composition); this suite protects the
// Base UI composition every real consumer (topbar, notifications, pickers,
// account/insurance pages) already uses.
describe("DropdownMenu — Base UI primitive, Batch 2 behavior coverage", () => {
  function Example({ onSelect }: { onSelect: (item: string) => void }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>Buka menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onSelect("ubah")}>
            Ubah
          </DropdownMenuItem>
          <DropdownMenuItem disabled onClick={() => onSelect("hapus")}>
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  it("opens on trigger click and selects an item", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<Example onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Buka menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ubah" }));

    expect(onSelect).toHaveBeenCalledWith("ubah");
  });

  it("skips a disabled item", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<Example onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Buka menu" }));
    const disabledItem = await screen.findByRole("menuitem", {
      name: "Hapus",
    });
    expect(disabledItem).toHaveAttribute("data-disabled");

    await user.click(disabledItem);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Example onSelect={jest.fn()} />);

    const trigger = screen.getByRole("button", { name: "Buka menu" });
    await user.click(trigger);
    await screen.findByRole("menuitem", { name: "Ubah" });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("menuitem", { name: "Ubah" }),
      ).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
