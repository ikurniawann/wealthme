import {
  addMonthsUtc,
  nextMaturityDate,
  type AccountDto,
} from "@wealthme/contracts";

import {
  OTHER,
  applyBank,
  applyCountry,
  createBodies,
  editBody,
  initialFormState,
  validateForm,
} from "./account-form-state";

const MASTER = { myUserId: "me", isMasterLike: true, today: "2026-10-19" };
const MEMBER = { myUserId: "me", isMasterLike: false, today: "2026-10-19" };

describe("deposit maturity (contracts helpers)", () => {
  it("clamps month ends: 31 Jan + 1 month is the last day of February", () => {
    expect(addMonthsUtc("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("rolls an ARO deposit forward to the next future maturity", () => {
    expect(nextMaturityDate("2026-01-15", 3, "aro", "2026-10-19")).toBe(
      "2027-01-15",
    );
  });

  it("keeps a non-ARO maturity fixed even once it has passed", () => {
    expect(nextMaturityDate("2026-01-15", 3, "non_aro", "2026-10-19")).toBe(
      "2026-04-15",
    );
  });
});

describe("applyBank / applyCountry", () => {
  it("fills kind, clearing code and SWIFT from the directory", () => {
    const s = applyBank(initialFormState(null, MASTER), "Bank Central Asia");
    expect(s).toMatchObject({
      bank: "BCA",
      institutionKind: "commercial",
      bankCode: "014",
      swiftCode: "CENAIDJA",
      isSharia: false,
    });
  });

  it("marks a sharia bank and defaults the contract", () => {
    const s = applyBank(initialFormState(null, MASTER), "BSI");
    expect(s.isSharia).toBe(true);
    expect(s.shariaContract).toBe("mudharabah");
  });

  it("keeps a typed unknown bank as-is", () => {
    const s = applyBank(initialFormState(null, MASTER), "BPR Sukamaju");
    expect(s.bank).toBe("BPR Sukamaju");
    expect(s.bankCode).toBe("");
  });

  it("switching abroad resets the bank, sets the currency and flags the SPT report", () => {
    const s = applyCountry(
      applyBank(initialFormState(null, MASTER), "BCA"),
      "SG",
    );
    expect(s).toMatchObject({
      country: "SG",
      bank: "",
      institutionKind: "foreign",
      reportInTaxReturn: true,
    });
    expect(s.balances[0].currency).toBe("SGD");
  });
});

describe("validateForm", () => {
  it("requires a bank and a typed holder name", () => {
    const s = { ...initialFormState(null, MASTER), holder: OTHER };
    expect(validateForm(s)).toMatchObject({
      bank: "required",
      holderName: "required",
    });
  });

  it("checks the SWIFT shape, the rate range and the deposit terms", () => {
    const s = {
      ...applyBank(initialFormState(null, MASTER), "BCA"),
      swiftCode: "BCA1",
      interestRate: "120",
      productKind: "time_deposit" as const,
      tenorMonths: "0",
    };
    expect(validateForm(s)).toEqual({
      swiftCode: "invalid",
      interestRate: "invalid",
      tenorMonths: "invalid",
    });
  });
});

describe("request bodies", () => {
  const base = {
    ...applyBank(initialFormState(null, MASTER), "BCA"),
    productName: "Tahapan Xpresi",
    maskedNumber: "0087366463",
    interestRate: "0,75",
  };

  it("creates a family-shared account without an ownerUserId and with shares", () => {
    const [body] = createBodies(
      {
        ...base,
        familyShared: true,
        shares: { rina: "post", budi: "view", ani: "none" },
      },
      MASTER,
      [{ currency: "IDR", idr: 10_000_000, fxAmount: null }],
      "Tabungan",
    );
    expect(body).toMatchObject({
      type: "bank",
      name: "BCA Tahapan Xpresi",
      institution: "BCA",
      balance: 10_000_000,
      currency: "IDR",
      interestRate: 0.75,
      holderUserId: "me",
      shares: [
        { userId: "rina", canPost: true },
        { userId: "budi", canPost: false },
      ],
    });
    expect(body).not.toHaveProperty("ownerUserId");
    expect(body).not.toHaveProperty("depositNumber");
  });

  it("a private account is shared with nobody", () => {
    const [body] = createBodies(
      { ...base, isPrivate: true, shares: { rina: "post" } },
      MASTER,
      [{ currency: "IDR", idr: 1, fxAmount: null }],
      "Tabungan",
    );
    expect(body.shares).toEqual([]);
  });

  it("a personal account belongs to its member holder", () => {
    const [body] = createBodies(
      { ...base, familyShared: false, holder: "irfan" },
      MASTER,
      [{ currency: "IDR", idr: 1, fxAmount: null }],
      "Tabungan",
    );
    expect(body.ownerUserId).toBe("irfan");
  });

  it("a non-Master never sends owner or shares", () => {
    const [body] = createBodies(
      { ...base, shares: { rina: "post" } },
      MEMBER,
      [{ currency: "IDR", idr: 1, fxAmount: null }],
      "Tabungan",
    );
    expect(body).not.toHaveProperty("ownerUserId");
    expect(body).not.toHaveProperty("shares");
  });

  it("a multi-currency account becomes one row per currency with fxInputs", () => {
    const bodies = createBodies(
      {
        ...applyCountry(base, "SG"),
        bank: "DBS Bank",
        productKind: "multi_currency",
      },
      MASTER,
      [
        { currency: "SGD", idr: 52_875_000, fxAmount: "4230" },
        { currency: "USD", idr: 13_366_000, fxAmount: "815" },
      ],
      "Multi-currency",
    );
    expect(bodies.map((b) => [b.name, b.currency])).toEqual([
      ["DBS Bank Tahapan Xpresi (SGD)", "SGD"],
      ["DBS Bank Tahapan Xpresi (USD)", "USD"],
    ]);
    expect(bodies[0].fxInputs).toEqual([
      { field: "balance", currency: "SGD", amount: "4230" },
    ]);
  });

  it("a deposit sends its terms and uses the placement date as opening date", () => {
    const [body] = createBodies(
      {
        ...base,
        productKind: "time_deposit",
        depositNumber: "AA 221047",
        placementDate: "2026-09-15",
        tenorMonths: "3",
        maturityInstruction: "aro_plus",
        payoutAccountId: "acc-payout",
      },
      MASTER,
      [{ currency: "IDR", idr: 500_000_000, fxAmount: null }],
      "Deposito",
    );
    expect(body).toMatchObject({
      productKind: "time_deposit",
      depositNumber: "AA 221047",
      placementDate: "2026-09-15",
      openingBalanceDate: "2026-09-15",
      tenorMonths: 3,
      maturityInstruction: "aro_plus",
      payoutAccountId: "acc-payout",
      maturityReminder: true,
    });
  });

  it("editing never sends a balance and clears deposit terms off a savings account", () => {
    const account = {
      id: "a",
      familyGroupId: "fg",
      name: "BCA Tahapan",
      type: "bank",
      institution: "BCA",
      maskedNumber: "123",
      balance: "5",
      currency: "IDR",
      isPrivate: false,
      ownerUserId: null,
      ownerName: null,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      holderName: "Anak",
      shares: [{ userId: "rina", name: "Rina", canPost: true }],
    } satisfies AccountDto;
    const state = initialFormState(account, MASTER);
    expect(state.holder).toBe(OTHER);
    expect(state.shares).toEqual({ rina: "post" });
    const body = editBody(state, MASTER, "Tabungan");
    expect(body).not.toHaveProperty("balance");
    expect(body).toMatchObject({
      name: "BCA Tahapan",
      holderUserId: null,
      holderName: "Anak",
      depositNumber: null,
      tenorMonths: null,
    });
    // Ownership is untouched unless the family-shared control changed.
    expect(body).not.toHaveProperty("ownerUserId");
    expect(
      editBody(
        { ...state, familyShared: false, ownerTouched: true },
        MASTER,
        "Tabungan",
      ).ownerUserId,
    ).toBe("me");
  });
});
