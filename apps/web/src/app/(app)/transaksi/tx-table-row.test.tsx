/**
 * Batch 2 (#1) — `TxTableRow`'s JUMLAH `<td>` had no `whitespace-nowrap`, so
 * a large amount string could wrap under width pressure and ragged the row
 * height. This asserts the class is present rather than screenshotting
 * every width.
 */

// Same mock-before-import as txrow-detail.test.tsx — `./page` imports
// `auth-client` at module scope, which jest can't parse unmocked.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

import { render, screen } from "@testing-library/react";
import type { TransactionDto } from "@wealthme/contracts";

import { TxTableRow } from "./page";

function buildTx(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: "tx-1",
    familyGroupId: "fg-1",
    accountId: "acc-1",
    categoryId: "cat-1",
    amount: "145000000",
    type: "expense",
    description: "Belanja bulanan",
    categoryName: "Belanja",
    accountName: "BCA Tabungan",
    occurredAt: "2026-07-20T09:30:00.000Z",
    createdAt: "2026-07-20T09:31:00.000Z",
    toAccountId: null,
    toAccountName: null,
    liabilityId: null,
    insuranceId: null,
    ...overrides,
  };
}

describe("TxTableRow — JUMLAH column (batch-2 #1)", () => {
  it("renders the amount cell with whitespace-nowrap so a large figure stays single-line", () => {
    const tx = buildTx();
    render(
      <table>
        <tbody>
          <TxTableRow
            tx={tx}
            onEditClick={jest.fn()}
            onDeleteClick={jest.fn()}
          />
        </tbody>
      </table>,
    );

    const amountCell = screen.getByText("-Rp 145.000.000");
    expect(amountCell).toHaveClass("whitespace-nowrap");
  });
});
