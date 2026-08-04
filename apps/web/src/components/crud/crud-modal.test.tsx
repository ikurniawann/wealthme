/**
 * EPIC-022 A1 — "family invite rejects phone numbers". The `member` CRUD
 * entity was labelled "Email / No. HP" but always POSTed to an `@IsEmail`
 * DTO, and offered a "Co-Owner" role that isn't real (submission hardcoded
 * "member" regardless of the select). This locks in the fix: the entity is
 * email-only, and its role picker only offers the two roles the invitation
 * endpoint actually accepts.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CrudModal } from "./crud-modal";

// jsdom has no PointerEvent — Base UI's Dialog primitives read pointer-event
// fields internally, so opening/submitting the dialog needs this polyfilled
// (same fix as dana/dana.test.tsx and rekening/rekening.test.tsx).
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

describe("CrudModal — 'member' entity (EPIC-022 A1)", () => {
  it("is email-only: no 'Nama Lengkap' or 'Hubungan' field, and the amount input is type=email", async () => {
    render(
      <CrudModal
        state={{ entity: "member", mode: "add" }}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Email")).toBeInTheDocument();
    expect(dialog.queryByText("Nama Lengkap")).not.toBeInTheDocument();
    expect(dialog.queryByText("Hubungan")).not.toBeInTheDocument();

    const emailInput = dialog.getByPlaceholderText("nama@email.com");
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("offers only the two real invitable roles, never 'Co-Owner'", async () => {
    render(
      <CrudModal
        state={{ entity: "member", mode: "add" }}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    const dialog = within(await screen.findByRole("dialog"));
    const roleSelect = dialog.getByDisplayValue("member") as HTMLSelectElement;
    const optionValues = Array.from(roleSelect.options).map((o) => o.value);
    expect(optionValues.sort()).toEqual(["admin_staff", "member"]);
    expect(optionValues).not.toContain("Co-Owner");
  });

  it("uses dynamicOptions labels for the role select when provided by the caller", async () => {
    render(
      <CrudModal
        state={{ entity: "member", mode: "add" }}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        dynamicOptions={{
          role: [
            { value: "member", label: "Anggota" },
            { value: "admin_staff", label: "Admin / Staf" },
          ],
        }}
      />,
    );

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("option", { name: "Anggota" })).toBeInTheDocument();
    expect(
      dialog.getByRole("option", { name: "Admin / Staf" }),
    ).toBeInTheDocument();
  });

  it("submits the real email + role the user picked (role is wired, not hardcoded)", async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(
      <CrudModal
        state={{ entity: "member", mode: "add" }}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const dialog = within(await screen.findByRole("dialog"));
    await user.type(
      dialog.getByPlaceholderText("nama@email.com"),
      "budi@example.com",
    );
    await user.selectOptions(dialog.getByDisplayValue("member"), "admin_staff");
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      "member",
      "add",
      expect.objectContaining({
        email: "budi@example.com",
        role: "admin_staff",
      }),
    );
  });
});
