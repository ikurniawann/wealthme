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
    canModify: true,
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

// EPIC-036 (edit-rights, "Pembuat + pemilik rekening") — a row the viewer
// can see but is neither its creator nor an owned-leg's account owner must
// show the same honest lock the obligation-linked guard already uses,
// including for Master/Co-Master.
describe("TxTableRow — edit-rights lock (EPIC-036)", () => {
  it("disables Edit/Hapus and shows the locked badge when canModify is false", () => {
    const tx = buildTx({ canModify: false });
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

    expect(screen.getByText("Terkunci")).toBeInTheDocument();
    const lockedButtons = screen.getAllByRole("button", {
      name: "Transaksi ini hanya bisa diubah oleh pencatatnya atau pemilik rekening.",
    });
    expect(lockedButtons).toHaveLength(2);
    for (const button of lockedButtons) expect(button).toBeDisabled();
  });

  it("leaves Edit/Hapus enabled and shows no lock badge when canModify is true", () => {
    const tx = buildTx({ canModify: true });
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

    expect(screen.queryByText("Terkunci")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).not.toBeDisabled();
  });
});
