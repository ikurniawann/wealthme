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

describe("IAM MembersTab", () => {
  it("shows the username for members without email, and email otherwise", () => {
    setup();
    expect(screen.getByText("Username: elsamariska")).toBeInTheDocument();
    expect(screen.getByText("Username: aisyah")).toBeInTheDocument();
    expect(screen.getByText("irfan@wit.id")).toBeInTheDocument();
    expect(
      screen.queryByText(/members\.internal\.wealthme\.invalid/),
    ).not.toBeInTheDocument();
  });

  it("shows the assigned role, its overrides, and the data scope", () => {
    setup();
    expect(screen.getByText("Anak Sekolah")).toBeInTheDocument();
    expect(screen.getByText("+2 khusus")).toBeInTheDocument();
    expect(screen.getByText("Hanya data miliknya")).toBeInTheDocument();
    expect(screen.getAllByText("Akses penuh")).toHaveLength(2);
  });

  it("offers Reset Password on managed logins but never on your own row", async () => {
    const { onResetPassword, onEditAccess } = setup();
    const resets = screen.getAllByRole("button", { name: /Reset Password/ });
    expect(resets).toHaveLength(2); // Elsa + Aisyah, not Irfan (self)
    await userEvent.click(resets[1]);
    expect(onResetPassword).toHaveBeenCalledWith(child);
    // Masters are never "Atur Akses"-able.
    const edits = screen.getAllByRole("button", { name: /Atur Akses/ });
    expect(edits).toHaveLength(1);
    await userEvent.click(edits[0]);
    expect(onEditAccess).toHaveBeenCalledWith(child);
  });
});
