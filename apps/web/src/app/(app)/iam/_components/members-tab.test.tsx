import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { id as mockDictionary } from "../../../../i18n/id";

import { MembersTab, type MemberRow } from "./members-tab";

jest.mock("../../../../hooks/use-locale", () => ({
  useLocale: () => ({ t: mockDictionary, locale: "id" }),
}));

const master: MemberRow = {
  id: "m1",
  userId: "u-master",
  name: "Irfan Arsandi",
  email: "irfan@wit.id",
  role: "owner",
  relationship: null,
  username: null,
  managedLogin: false,
};
const coMaster: MemberRow = {
  ...master,
  id: "m2",
  userId: "u-elsa",
  name: "Elsa Mariska",
  email: "member-x@members.internal.wealthme.invalid",
  username: "elsamariska",
  managedLogin: true,
};
const child: MemberRow = {
  ...master,
  id: "m3",
  userId: "u-child",
  name: "Aisyah",
  email: "member-y@members.internal.wealthme.invalid",
  role: "dependant",
  username: "aisyah",
  managedLogin: true,
  accessRoleId: "r1",
  accessRoleName: "Anak Sekolah",
  accessOverrides: { tujuan: "view", tax: "none" },
};

function setup() {
  const handlers = {
    onEditAccess: jest.fn(),
    onResetPassword: jest.fn(),
    onEditEmail: jest.fn(),
    onRemove: jest.fn(),
  };
  render(
    <MembersTab
      members={[master, coMaster, child]}
      isLoading={false}
      roles={[
        {
          id: "r1",
          name: "Anak Sekolah",
          description: null,
          dataScope: "own",
          permissions: { transaksi: "manage" },
          memberCount: 1,
          createdAt: "2026-09-24T00:00:00.000Z",
        },
      ]}
      currentUserId="u-master"
      {...handlers}
    />,
  );
  return handlers;
}

describe("IAM MembersTab (row list, EPIC-033 restyle)", () => {
  it("shows the username for members without email, and email otherwise", () => {
    setup();
    expect(screen.getByText("Username: elsamariska")).toBeInTheDocument();
    expect(screen.getByText("Username: aisyah")).toBeInTheDocument();
    expect(screen.getByText("irfan@wit.id")).toBeInTheDocument();
    expect(
      screen.queryByText(/members\.internal\.wealthme\.invalid/),
    ).not.toBeInTheDocument();
  });

  it("shows both the family login and a real email when the member has both", () => {
    render(
      <MembersTab
        members={[
          {
            ...child,
            id: "m9",
            userId: "u-9",
            name: "Budi",
            email: "budi@gmail.com",
            username: "budi@arsandi",
          },
        ]}
        isLoading={false}
        roles={[]}
        currentUserId="u-master"
        onEditAccess={jest.fn()}
        onResetPassword={jest.fn()}
        onEditEmail={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByText("Username: budi@arsandi")).toBeInTheDocument();
    expect(screen.getByText("budi@gmail.com")).toBeInTheDocument();
    // Master-created with an email: still resettable by the Master.
    expect(
      screen.getByRole("button", { name: /Reset Password/ }),
    ).toBeInTheDocument();
  });

  it("shows the assigned role, its overrides, and the data scope in the row subtext", () => {
    setup();
    expect(screen.getByText(/Anak Sekolah/)).toBeInTheDocument();
    expect(screen.getByText(/\+2 khusus/)).toBeInTheDocument();
    expect(screen.getByText(/Hanya data miliknya/)).toBeInTheDocument();
    expect(screen.getAllByText(/Akses penuh/)).toHaveLength(2);
  });

  it("offers Reset Password on managed logins but never on your own row", async () => {
    const { onResetPassword } = setup();
    const resets = screen.getAllByRole("button", { name: /Reset Password/ });
    expect(resets).toHaveLength(2); // Elsa + Aisyah, not Irfan (self)
    await userEvent.click(resets[1]);
    expect(onResetPassword).toHaveBeenCalledWith(child);
  });

  it("clicking a non-master row opens 'Atur Akses' for that member; the Master row is not clickable", async () => {
    const { onEditAccess } = setup();
    await userEvent.click(
      screen.getByRole("button", { name: /Atur akses Aisyah/i }),
    );
    expect(onEditAccess).toHaveBeenCalledWith(child);
    expect(
      screen.queryByRole("button", { name: /Atur akses Irfan/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking a row's Reset Password icon does not also open 'Atur Akses' for that row", async () => {
    const { onEditAccess, onResetPassword } = setup();
    const resets = screen.getAllByRole("button", { name: /Reset Password/ });
    await userEvent.click(resets[1]);
    expect(onResetPassword).toHaveBeenCalledWith(child);
    expect(onEditAccess).not.toHaveBeenCalled();
  });

  it("offers a copy button next to each username, and never for members without one", async () => {
    const user = userEvent.setup();
    // `userEvent.setup()` installs jsdom's missing Clipboard stub; the spy
    // has to attach to that stub, not to navigator.clipboard beforehand.
    const writeText = jest
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    setup();

    const CC = mockDictionary.akun.copyCredentials;
    const copyButtons = screen.getAllByRole("button", {
      name: CC.usernameAriaLabel,
    });
    // Elsa + Aisyah have a username; Irfan (Master) does not.
    expect(copyButtons).toHaveLength(2);

    await user.click(copyButtons[0]);
    expect(writeText).toHaveBeenLastCalledWith("elsamariska");
  });
});
