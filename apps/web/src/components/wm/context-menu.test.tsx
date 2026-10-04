import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ContextMenu } from "./context-menu";

describe("ContextMenu — uiarc.dev reference, adapted onto Base UI", () => {
  it("opens on right-click and fires onSelect for the clicked item", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <ContextMenu
        label="Baris contoh"
        items={[{ id: "edit", label: "Ubah", onSelect }]}
      >
        <span>Baris contoh</span>
      </ContextMenu>,
    );

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("Baris contoh"),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Ubah" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("disables an item and skips calling its onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <ContextMenu
        label="Baris terkunci"
        items={[{ id: "edit", label: "Ubah", onSelect, disabled: true }]}
      >
        <span>Baris terkunci</span>
      </ContextMenu>,
    );

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("Baris terkunci"),
    });
    const item = await screen.findByRole("menuitem", { name: "Ubah" });
    expect(item).toHaveAttribute("data-disabled", "");
    await user.click(item);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders as the given element via `render` instead of its default <div>", async () => {
    const user = userEvent.setup();
    render(
      <table>
        <tbody>
          <ContextMenu
            label="Baris tabel"
            items={[{ id: "detail", label: "Detail" }]}
            render={<tr data-testid="row" />}
          >
            <td>Isi baris</td>
          </ContextMenu>
        </tbody>
      </table>,
    );

    const row = screen.getByTestId("row");
    expect(row.tagName).toBe("TR");
    expect(within(row).getByText("Isi baris")).toBeInTheDocument();

    await user.pointer({ keys: "[MouseRight]", target: row });
    expect(
      await screen.findByRole("menuitem", { name: "Detail" }),
    ).toBeInTheDocument();
  });
});
