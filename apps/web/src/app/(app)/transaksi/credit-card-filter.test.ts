/**
 * EPIC-023 Task E retry (HIGH 4) — `isCreditCard` used to substring-match
 * `tx.accountName`, which is `""` for every real card purchase (E3's
 * `accountId` is null on those rows), so the "Kartu Kredit" filter matched
 * zero of the very transactions it exists to show. It now keys off
 * `Transaction.liabilityId` cross-referenced against the credit-card
 * liability ids fetched separately (mirroring `transaction-dialog.tsx`'s
 * own `creditCards` filter).
 */

import type { TransactionDto } from "@wealthme/contracts";

// `./page` also defines `TransaksiPageInner`, which imports `auth-client`
// (via `auth-compat`) at module scope. `auth-client` re-exports the
// `better-auth` React client, which ships ESM that jest can't parse without
// a transform, so it must be mocked before `./page` is required — same
// precedent as `txrow-detail.test.tsx` in this same directory.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

import { isCreditCard } from "./page";

function buildTx(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: "tx-1",
    familyGroupId: "fg-1",
    accountId: "acc-1",
    categoryId: "cat-1",
    amount: "150000",
    type: "expense",
    description: "Belanja",
    categoryName: "Belanja",
    accountName: "BCA Tabungan",
    occurredAt: "2026-07-20T09:30:00.000Z",
    createdAt: "2026-07-20T09:31:00.000Z",
    toAccountId: null,
    toAccountName: null,
    liabilityId: null,
    insuranceId: null,
    canModify: true,
    ...overrides,
  };
}

describe("isCreditCard (EPIC-023 Task E retry, HIGH 4)", () => {
  it("matches a real card-purchase row (accountId null, accountName '', liabilityId set to a credit-card liability)", () => {
    const tx = buildTx({
      accountId: null,
      accountName: "",
      liabilityId: "liab-card-1",
    });
    expect(isCreditCard(tx, new Set(["liab-card-1"]))).toBe(true);
  });

  it("does NOT match a liability payment against a non-card liability (e.g. KPR)", () => {
    const tx = buildTx({
      liabilityId: "liab-kpr-1",
    });
    expect(isCreditCard(tx, new Set(["liab-card-1"]))).toBe(false);
  });

  it("does NOT match an ordinary expense with no liabilityId, regardless of its account name", () => {
    const tx = buildTx({
      accountName: "Kartu Kredit BCA",
      liabilityId: null,
    });
    expect(isCreditCard(tx, new Set(["liab-card-1"]))).toBe(false);
  });
});
