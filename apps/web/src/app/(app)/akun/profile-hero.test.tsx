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
    expect(screen.getByText("Bergabung sejak 2024")).toBeInTheDocument();
    expect(action.parentElement).not.toBe(email.parentElement);

    fireEvent.click(action);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
