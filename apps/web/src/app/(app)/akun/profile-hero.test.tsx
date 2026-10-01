import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileHero } from "./profile-hero";

describe("ProfileHero", () => {
  it("renders identity, role, and profile action without nesting the action in identity text", () => {
    const onEdit = jest.fn();
    render(
      <ProfileHero
        initials="AR"
        displayName="Andi Raharjo"
        email="andi@example.com"
        role="Pemilik"
        memberSince="Bergabung sejak 2024"
        actionLabel="Edit profil"
        onEdit={onEdit}
      />,
    );

    const email = screen.getByText("andi@example.com");
    const action = screen.getByRole("button", { name: "Edit profil" });
    expect(screen.getByText("Andi Raharjo")).toBeInTheDocument();
    expect(screen.getByText("Pemilik")).toBeInTheDocument();
    // Prototype hero row is role badge + email only (akun.html `.ak-meta`) —
    // `memberSince` is accepted for compat but no longer rendered here.
    expect(action.parentElement).not.toBe(email.parentElement);

    fireEvent.click(action);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("ProfileHero avatar picker", () => {
  const base = {
    initials: "SO",
    displayName: "Staff Operasional",
    email: "@staff",
    role: "Staf",
    memberSince: "",
    actionLabel: "Edit profil",
    onEdit: jest.fn(),
  };
  const avatar = (over = {}) => ({
    url: null,
    busy: false,
    changeLabel: "Ganti foto",
    removeLabel: "Hapus foto",
    busyLabel: "Mengunggah foto…",
    onPick: jest.fn(),
    onRemove: jest.fn(),
    ...over,
  });

  it("opens a file picker from the avatar and forwards the chosen file", () => {
    const a = avatar();
    const { container } = render(<ProfileHero {...base} avatar={a} />);
    expect(screen.getByRole("button", { name: "Ganti foto" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Hapus foto" }),
    ).not.toBeInTheDocument();

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input.accept).toBe("image/jpeg,image/png,image/webp");
    const file = new File(["x"], "me.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(a.onPick).toHaveBeenCalledWith(file);
  });

  it("offers Hapus foto when a photo is set and disables while busy", () => {
    const a = avatar({ url: "/users/u/avatar?v=1", busy: true });
    render(<ProfileHero {...base} avatar={a} />);
    expect(
      screen.getByRole("button", { name: "Mengunggah foto…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hapus foto" })).toBeDisabled();
  });

  it("keeps the role badge and identity in one meta row", () => {
    render(<ProfileHero {...base} />);
    expect(screen.getByText("Staf").parentElement).toBe(
      screen.getByText("@staff").parentElement,
    );
  });
});
