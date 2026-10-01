/**
 * Revisi H final-review fix — the "Anggota" section on /akun used to label
 * its role column with the literal "Peran" instead of the shared role
 * label /iam's `MembersTab` uses (`t.common.roleLabels`). EPIC-033 restyle
 * replaced the multi-column table with a row list (akun.html's compact
 * member rows); this now asserts the row's subtext still uses the shared
 * role label, not a literal "Peran" string, and that the member is shown
 * (not hidden behind a column that no longer exists).
 */

import { render, screen } from "@testing-library/react";

import { id as mockAkunDictionary } from "../../../i18n/id";

// page.tsx imports auth-client at module scope (used by other exported
// bodies in this file) — better-auth's React client ships ESM that Jest
// can't parse unmocked, so it must be stubbed even though
// `FamilyMembersTableCard` never calls it (same pattern as
// family-allowance-threshold.test.tsx).
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(),
    signOut: jest.fn(),
    changePassword: jest.fn(),
    listSessions: jest.fn(),
    revokeSession: jest.fn(),
  },
}));

jest.mock("../../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: mockAkunDictionary,
  })),
}));

import { FamilyMembersTableCard, type FamilyMember } from "./page";

const t = mockAkunDictionary.akun;
const commonT = mockAkunDictionary.common;

const MEMBERS: FamilyMember[] = [
  {
    id: "m1",
    userId: "u1",
    familyGroupId: "fg-1",
    role: "owner",
    name: "Irfan",
    email: "irfan@wit.id",
    createdAt: "2026-01-01T00:00:00.000Z",
    largeTxnThreshold: null,
  },
];

describe("FamilyMembersTableCard — row subtext matches /iam's shared role labels (Revisi H)", () => {
  it("shows the member's name and the shared role label, not a literal 'Peran'", () => {
    render(
      <FamilyMembersTableCard
        familyMembers={MEMBERS}
        myUserId="u1"
        displayInitials="IR"
        displayName="Irfan"
        displayEmail="irfan@wit.id"
        isElevated={true}
        isOwner={true}
        onCategoryLimit={jest.fn()}
        onThreshold={jest.fn()}
      />,
    );

    expect(screen.getByText(/Irfan/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(commonT.roleLabels.owner)),
    ).toBeInTheDocument();
    expect(screen.queryByText("Peran")).not.toBeInTheDocument();
  });

  it("shows the section title with the member count", () => {
    render(
      <FamilyMembersTableCard
        familyMembers={MEMBERS}
        myUserId="u1"
        displayInitials="IR"
        displayName="Irfan"
        displayEmail="irfan@wit.id"
        isElevated={true}
        isOwner={true}
        onCategoryLimit={jest.fn()}
        onThreshold={jest.fn()}
      />,
    );

    expect(
      screen.getByText(`${t.family.membersSectionTitle} (1)`),
    ).toBeInTheDocument();
  });
});
