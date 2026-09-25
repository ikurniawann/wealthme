/**
 * Revisi H final-review fix — the "Anggota Keluarga" table on /akun used to
 * label its columns "Peran" (literal) and
 * `t.akun.addDependant.relationshipLabel` ("Hubungan (opsional)", which
 * reads wrong in a table header), while /iam's `MembersTab` names the same
 * two concepts via `t.akun.memberConcepts.systemRole` ("Peran sistem") and
 * `t.akun.memberConcepts.relationship` ("Hubungan"). This asserts /akun uses
 * the same shared labels.
 */

import { render, screen, within } from "@testing-library/react";

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

describe("FamilyMembersTableCard — column labels match /iam's member concepts (Revisi H)", () => {
  it("labels the role column with memberConcepts.systemRole, not literal 'Peran'", () => {
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

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", {
        name: t.memberConcepts.systemRole,
      }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("columnheader", { name: "Peran" }),
    ).not.toBeInTheDocument();
  });

  it("labels the relationship column with memberConcepts.relationship, not the addDependant '(opsional)' wording", () => {
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

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", {
        name: t.memberConcepts.relationship,
      }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("columnheader", {
        name: t.addDependant.relationshipLabel,
      }),
    ).not.toBeInTheDocument();
  });
});
