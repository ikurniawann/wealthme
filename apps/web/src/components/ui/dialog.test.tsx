import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

// Behavior coverage for the shared Base UI Dialog primitive — Batch 2
// closed this gap (no `ui/dialog.tsx`, `ui/dropdown-menu.tsx` or
// `ui/tooltip.tsx` behavior test existed before). Every feature dialog in
// the app (CRUD, transaction, search, nav) composes these same exports, so
// Escape, focus restoration and disabled-trigger behavior here protect all
// of them at once.
describe("Dialog — Base UI primitive, Batch 2 behavior coverage", () => {
  function Example() {
    return (
      <Dialog>
        <DialogTrigger>Buka dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Judul dialog</DialogTitle>
          <DialogClose>Tutup</DialogClose>
        </DialogContent>
      </Dialog>
    );
  }

  it("opens on trigger click and closes on Escape, restoring focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Example />);

    const trigger = screen.getByRole("button", { name: "Buka dialog" });
    await user.click(trigger);

    expect(
      await screen.findByRole("dialog", { name: "Judul dialog" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Judul dialog" }),
      ).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("closes via the close control and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Example />);

    const trigger = screen.getByRole("button", { name: "Buka dialog" });
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Judul dialog" });

    await user.click(screen.getByRole("button", { name: "Tutup" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Judul dialog" }),
      ).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("does not open when the trigger is disabled", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger disabled>Buka dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Judul dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Buka dialog" }));

    expect(
      screen.queryByRole("dialog", { name: "Judul dialog" }),
    ).not.toBeInTheDocument();
  });
});
