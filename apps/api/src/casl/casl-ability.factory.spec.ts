import { Role } from "@prisma/client";

import { CaslAbilityFactory } from "./casl-ability.factory";

describe("CaslAbilityFactory", () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  describe("owner role", () => {
    it("can manage Account", () => {
      // Arrange
      const ability = factory.createForMember({ role: Role.owner });

      // Act & Assert
      expect(ability.can("manage", "Account")).toBe(true);
    });

    it("can manage Category", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "Category")).toBe(true);
    });

    it("can manage Transaction", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "Transaction")).toBe(true);
    });

    it("can manage Member", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "Member")).toBe(true);
    });

    it("can manage Reconciliation (EPIC-021 #29 fee-split)", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "Reconciliation")).toBe(true);
    });

    it("can manage AllowanceRequest (approve/reject)", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "AllowanceRequest")).toBe(true);
    });

    it("can manage MemberCategoryAllowance", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "MemberCategoryAllowance")).toBe(true);
    });

    it("can manage SplitBill (EPIC-023 Task C retry)", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "SplitBill")).toBe(true);
    });

    it("can manage FamilyGroup (EPIC-023 F2 — the religion setting is owner-writable)", () => {
      const ability = factory.createForMember({ role: Role.owner });
      expect(ability.can("manage", "FamilyGroup")).toBe(true);
      expect(ability.can("read", "FamilyGroup")).toBe(true);
    });
  });

  describe("member role", () => {
    it("can read Account", () => {
      // Arrange
      const ability = factory.createForMember({ role: Role.member });

      // Act & Assert
      expect(ability.can("read", "Account")).toBe(true);
    });

    it("cannot delete Account", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("delete", "Account")).toBe(false);
    });

    it("can manage Transaction", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("manage", "Transaction")).toBe(true);
    });

    it("can read Member", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("read", "Member")).toBe(true);
    });

    it("cannot delete Member", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("delete", "Member")).toBe(false);
    });

    it("cannot manage Reconciliation (EPIC-021 #29 — the fee-split action stays reserved for owner/admin_staff/spouse)", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("manage", "Reconciliation")).toBe(false);
    });

    it("PERMISSION — can read and create Reconciliation (EPIC-023 Task C retry HIGH finding: round 2 wrongly flattened every route onto 'manage' and 403'd member on upload/list/match/auto-match)", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("read", "Reconciliation")).toBe(true);
      expect(ability.can("create", "Reconciliation")).toBe(true);
      expect(ability.can("manage", "Reconciliation")).toBe(false);
    });

    it("can create and read AllowanceRequest but not approve/reject it", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("create", "AllowanceRequest")).toBe(true);
      expect(ability.can("read", "AllowanceRequest")).toBe(true);
      expect(ability.can("manage", "AllowanceRequest")).toBe(false);
    });

    it("can read but not manage MemberCategoryAllowance", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("read", "MemberCategoryAllowance")).toBe(true);
      expect(ability.can("manage", "MemberCategoryAllowance")).toBe(false);
    });

    it("can manage SplitBill (EPIC-023 Task C retry)", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("manage", "SplitBill")).toBe(true);
    });

    it("can read but not manage FamilyGroup (EPIC-023 F2 — religion setting stays owner-writable)", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("read", "FamilyGroup")).toBe(true);
      expect(ability.can("manage", "FamilyGroup")).toBe(false);
    });
  });

  describe("admin_staff role", () => {
    it("can read Transaction", () => {
      // Arrange
      const ability = factory.createForMember({ role: Role.admin_staff });

      // Act & Assert
      expect(ability.can("read", "Transaction")).toBe(true);
    });

    it("can create Transaction (input-only)", () => {
      const ability = factory.createForMember({ role: Role.admin_staff });
      expect(ability.can("create", "Transaction")).toBe(true);
    });

    it("can read Account", () => {
      const ability = factory.createForMember({ role: Role.admin_staff });
      expect(ability.can("read", "Account")).toBe(true);
    });

    it("cannot update Category", () => {
      const ability = factory.createForMember({ role: Role.admin_staff });
      expect(ability.can("update", "Category")).toBe(false);
    });

    it("can manage Reconciliation (EPIC-021 #29 fee-split)", () => {
      const ability = factory.createForMember({ role: Role.admin_staff });
      expect(ability.can("manage", "Reconciliation")).toBe(true);
    });

    it("can create/read AllowanceRequest but cannot approve/reject it", () => {
      const ability = factory.createForMember({ role: Role.admin_staff });
      expect(ability.can("create", "AllowanceRequest")).toBe(true);
      expect(ability.can("read", "AllowanceRequest")).toBe(true);
      expect(ability.can("manage", "AllowanceRequest")).toBe(false);
    });

    it("can read but not manage SplitBill (EPIC-023 Task C retry)", () => {
      const ability = factory.createForMember({ role: Role.admin_staff });
      expect(ability.can("read", "SplitBill")).toBe(true);
      expect(ability.can("manage", "SplitBill")).toBe(false);
      expect(ability.can("create", "SplitBill")).toBe(false);
      expect(ability.can("delete", "SplitBill")).toBe(false);
    });

    it("can read but not manage FamilyGroup (EPIC-023 F2)", () => {
      const ability = factory.createForMember({ role: Role.admin_staff });
      expect(ability.can("read", "FamilyGroup")).toBe(true);
      expect(ability.can("manage", "FamilyGroup")).toBe(false);
    });
  });

  // EPIC-023 Task C (D2, US-FAM-10) — a spouse is a full financial co-owner.
  describe("spouse role", () => {
    it("can create/update/delete on every money surface", () => {
      const ability = factory.createForMember({ role: Role.spouse });
      for (const subject of [
        "Account",
        "Asset",
        "Budget",
        "Category",
        "Donation",
        "Goal",
        "Inheritance",
        "Insurance",
        "Investment",
        "Liability",
        "Transaction",
        "TaxRecord",
        "Reconciliation",
        "CoaAccount",
        "SplitBill",
      ] as const) {
        expect(ability.can("create", subject)).toBe(true);
        expect(ability.can("update", subject)).toBe(true);
        expect(ability.can("delete", subject)).toBe(true);
      }
    });

    it("cannot manage Member — DENIAL: one accountable head stays responsible for who is in the family", () => {
      const ability = factory.createForMember({ role: Role.spouse });
      expect(ability.can("manage", "Member")).toBe(false);
      expect(ability.can("read", "Member")).toBe(true);
    });

    it("cannot delete a Member — DENIAL", () => {
      const ability = factory.createForMember({ role: Role.spouse });
      expect(ability.can("delete", "Member")).toBe(false);
    });

    it("can read but not manage FamilyGroup — DENIAL: same 'one accountable head' pattern as Member (EPIC-023 F2)", () => {
      const ability = factory.createForMember({ role: Role.spouse });
      expect(ability.can("read", "FamilyGroup")).toBe(true);
      expect(ability.can("manage", "FamilyGroup")).toBe(false);
    });
  });

  // EPIC-023 Task C (D3, US-FAM-11) — a child is scoped to their own account
  // and transactions (row-level enforcement lives in privacy.util.ts /
  // service tests; this spec proves the CASL subject grants only).
  describe("dependant role (child)", () => {
    it("can create and read their own Transaction", () => {
      const ability = factory.createForMember({ role: Role.dependant });
      expect(ability.can("create", "Transaction")).toBe(true);
      expect(ability.can("read", "Transaction")).toBe(true);
    });

    it("cannot update or delete a Transaction — DENIAL", () => {
      const ability = factory.createForMember({ role: Role.dependant });
      expect(ability.can("update", "Transaction")).toBe(false);
      expect(ability.can("delete", "Transaction")).toBe(false);
    });

    it("can fully read Inheritance — explicit decision D4/C3, not an oversight", () => {
      const ability = factory.createForMember({ role: Role.dependant });
      expect(ability.can("read", "Inheritance")).toBe(true);
    });

    it("cannot read or manage Member, CoaAccount, Reconciliation, TaxRecord — DENIAL: no household ledger", () => {
      const ability = factory.createForMember({ role: Role.dependant });
      expect(ability.can("read", "Member")).toBe(false);
      expect(ability.can("read", "CoaAccount")).toBe(false);
      expect(ability.can("manage", "Reconciliation")).toBe(false);
      expect(ability.can("read", "TaxRecord")).toBe(false);
    });

    it("cannot read or manage SplitBill — DENIAL (EPIC-023 Task C retry)", () => {
      const ability = factory.createForMember({ role: Role.dependant });
      expect(ability.can("read", "SplitBill")).toBe(false);
      expect(ability.can("manage", "SplitBill")).toBe(false);
    });

    it("can create and read AllowanceRequest but cannot approve/reject it", () => {
      const ability = factory.createForMember({ role: Role.dependant });
      expect(ability.can("create", "AllowanceRequest")).toBe(true);
      expect(ability.can("read", "AllowanceRequest")).toBe(true);
      expect(ability.can("manage", "AllowanceRequest")).toBe(false);
    });

    it("can read FamilyGroup — harmless descriptive setting, same grant every role gets (EPIC-023 F2)", () => {
      const ability = factory.createForMember({ role: Role.dependant });
      expect(ability.can("read", "FamilyGroup")).toBe(true);
      expect(ability.can("manage", "FamilyGroup")).toBe(false);
    });
  });

  // EPIC-023 Task C (D5, US-FAM-13) — a driver/helper: own account+balance,
  // own transactions, nothing else.
  describe("operational role (helper/driver)", () => {
    it("can read their own Account (row-scoping applied in services)", () => {
      const ability = factory.createForMember({ role: Role.operational });
      expect(ability.can("read", "Account")).toBe(true);
    });

    it("can create and read their own Transaction", () => {
      const ability = factory.createForMember({ role: Role.operational });
      expect(ability.can("create", "Transaction")).toBe(true);
      expect(ability.can("read", "Transaction")).toBe(true);
    });

    it("cannot read Inheritance — DENIAL: unlike dependant, no D4 carve-out applies", () => {
      const ability = factory.createForMember({ role: Role.operational });
      expect(ability.can("read", "Inheritance")).toBe(false);
    });

    it("cannot read or manage Member, CoaAccount, Reconciliation, TaxRecord, Asset, Budget — DENIAL: nothing else", () => {
      const ability = factory.createForMember({ role: Role.operational });
      expect(ability.can("read", "Member")).toBe(false);
      expect(ability.can("read", "CoaAccount")).toBe(false);
      expect(ability.can("manage", "Reconciliation")).toBe(false);
      expect(ability.can("read", "TaxRecord")).toBe(false);
      expect(ability.can("read", "Asset")).toBe(false);
      expect(ability.can("read", "Budget")).toBe(false);
    });

    it("cannot read or manage SplitBill — DENIAL (EPIC-023 Task C retry)", () => {
      const ability = factory.createForMember({ role: Role.operational });
      expect(ability.can("read", "SplitBill")).toBe(false);
      expect(ability.can("manage", "SplitBill")).toBe(false);
    });

    it("can read FamilyGroup — harmless descriptive setting, same grant every role gets (EPIC-023 F2)", () => {
      const ability = factory.createForMember({ role: Role.operational });
      expect(ability.can("read", "FamilyGroup")).toBe(true);
      expect(ability.can("manage", "FamilyGroup")).toBe(false);
    });
  });
});
