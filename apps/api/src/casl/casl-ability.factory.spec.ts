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

    it("cannot manage Reconciliation (EPIC-021 #29 — bookkeeping action reserved for owner/admin_staff)", () => {
      const ability = factory.createForMember({ role: Role.member });
      expect(ability.can("manage", "Reconciliation")).toBe(false);
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
  });
});
