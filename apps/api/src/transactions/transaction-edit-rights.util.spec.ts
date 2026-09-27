import { Role } from "@prisma/client";

import { canModifyTransaction } from "./transaction-edit-rights.util";

const USER_AYAH = "user-ayah";
const USER_ISTRI = "user-istri";
const USER_ANAK = "user-anak";

describe("canModifyTransaction", () => {
  it("allows the creator regardless of account ownership", () => {
    const tx = {
      createdByUserId: USER_AYAH,
      account: { ownerUserId: null },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, { userId: USER_AYAH, role: Role.member }),
    ).toBe(true);
  });

  it("allows the private-account owner even when someone else created it", () => {
    // istri owns a private account, ayah recorded a transaction on it
    const tx = {
      createdByUserId: USER_AYAH,
      account: { ownerUserId: USER_ISTRI },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, { userId: USER_ISTRI, role: Role.spouse }),
    ).toBe(true);
  });

  it("allows the owner of only the toAccount leg (transfer destination)", () => {
    const tx = {
      createdByUserId: USER_AYAH,
      account: { ownerUserId: null },
      toAccount: { ownerUserId: USER_ANAK },
    };
    expect(
      canModifyTransaction(tx, { userId: USER_ANAK, role: Role.dependant }),
    ).toBe(true);
  });

  it("denies Master (owner) on someone else's private/shared-created transaction", () => {
    const tx = {
      createdByUserId: USER_AYAH,
      account: { ownerUserId: USER_ISTRI },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, { userId: "user-master", role: Role.owner }),
    ).toBe(false);
  });

  it("denies anak (not creator, no owned leg)", () => {
    const tx = {
      createdByUserId: USER_AYAH,
      account: { ownerUserId: null },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, { userId: USER_ANAK, role: Role.dependant }),
    ).toBe(false);
  });

  it("legacy null-creator, shared-account row: allows Master (owner)", () => {
    const tx = {
      createdByUserId: null,
      account: { ownerUserId: null },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, { userId: "user-master", role: Role.owner }),
    ).toBe(true);
  });

  it("legacy null-creator, shared-account row: allows Co-Master (spouse)", () => {
    const tx = {
      createdByUserId: null,
      account: { ownerUserId: null },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, {
        userId: "user-costralmaster",
        role: Role.spouse,
      }),
    ).toBe(true);
  });

  it("legacy null-creator, shared-account row: denies a plain member", () => {
    const tx = {
      createdByUserId: null,
      account: { ownerUserId: null },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, { userId: "user-x", role: Role.member }),
    ).toBe(false);
  });

  it("legacy null-creator row with an owned leg still honors the owner-of-a-leg rule", () => {
    const tx = {
      createdByUserId: null,
      account: { ownerUserId: USER_ISTRI },
      toAccount: null,
    };
    expect(
      canModifyTransaction(tx, { userId: USER_ISTRI, role: Role.spouse }),
    ).toBe(true);
    // Master must NOT get the legacy shared-row carve-out here — one leg IS owned.
    expect(
      canModifyTransaction(tx, { userId: "user-master", role: Role.owner }),
    ).toBe(false);
  });

  it("treats an absent member (internal/non-member-facing caller) as unrestricted", () => {
    const tx = {
      createdByUserId: USER_AYAH,
      account: { ownerUserId: USER_ISTRI },
      toAccount: null,
    };
    expect(canModifyTransaction(tx, null)).toBe(true);
    expect(canModifyTransaction(tx, undefined)).toBe(true);
  });
});
