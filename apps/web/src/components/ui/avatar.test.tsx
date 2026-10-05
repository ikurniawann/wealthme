import { render, screen } from "@testing-library/react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "./avatar";

describe("Avatar — Arc visual adapter", () => {
  it("keeps Base UI composition while exposing Arc marker and size", () => {
    render(
      <Avatar size="lg" aria-label="Ayu Pratama">
        <AvatarFallback>AP</AvatarFallback>
        <AvatarBadge aria-label="online" />
      </Avatar>,
    );

    const avatar = screen.getByLabelText("Ayu Pratama");
    expect(avatar).toHaveAttribute("data-uiarc", "avatar");
    expect(avatar).toHaveAttribute("data-size", "lg");
    expect(avatar).toHaveClass("avatar");
    expect(screen.getByText("AP")).toHaveClass("fallback");
    expect(screen.getByLabelText("online")).toHaveAttribute(
      "data-slot",
      "avatar-badge",
    );
  });

  it("preserves overlapping avatar groups and group counts", () => {
    render(
      <AvatarGroup aria-label="Team">
        <Avatar aria-label="Ayu">
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>,
    );

    expect(screen.getByLabelText("Team")).toHaveClass("group");
    expect(screen.getByText("+2")).toHaveClass("groupCount");
  });
});
