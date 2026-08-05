/**
 * EPIC-020 Task A — clickable transaction rows → read-only detail view.
 *
 * `TxRow` (apps/web/src/app/(app)/transaksi/page.tsx) previously rendered a
 * plain, non-interactive row with only a `RowActions` (edit/delete) control
 * and no way to see a transaction's full detail. These tests verify:
 * 1. Clicking a row opens a read-only detail dialog showing amount/category/
 *    account (and the other `TransactionDto` fields).
 * 2. A null `description`/`categoryName` renders "—" in the detail view
 *    instead of crashing or showing "null"/"undefined".
 * 3. Clicking (or keyboard-activating) the row's `RowActions` (Edit/Hapus
 *    icons) does NOT also open the detail dialog. `RowActions` renders as a
 *    SIBLING of the row's `role="button"` detail-trigger element (not
 *    nested inside it) specifically so neither a click nor a keydown on
 *    those icon buttons can bubble into the row's own Enter/Space handler —
 *    a regression here would both hijack keyboard Edit/Hapus (WCAG 2.1.1)
 *    and reintroduce an axe "nested-interactive" violation.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TransactionDto } from "@wealthme/contracts";

// `./page` also defines `TransaksiPageInner`, which imports `auth-client`
// (via `auth-compat`) at module scope. `auth-client` re-exports the
// `better-auth` React client, which ships ESM `better-auth/dist/client/
// react/index.mjs` — jest can't parse that without a transform, so it must
// be mocked before `./page` is required, exactly like every other
// `(app)/**/*.test.tsx` in this repo (see akun/pengaturan-body.test.tsx).
// TxRow/TransactionDetailDialog (what this file actually renders) never
// call `useSession`, so the mock's shape doesn't matter here.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

import { TxRow } from "./page";

// jsdom doesn't implement PointerEvent — Base UI's Dialog primitives read
// pointer-event fields internally (same issue as the Base UI Switch in
// akun/notif-setting-body.test.tsx), so userEvent interactions inside an
// open dialog need this polyfilled or they throw.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

function render(ui: ReactElement) {
  return rtlRender(ui);
}

function buildTx(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: "tx-1",
    familyGroupId: "fg-1",
    accountId: "acc-1",
    categoryId: "cat-1",
    amount: "150000",
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

describe("TxRow — read-only transaction detail view (EPIC-020 Task A)", () => {
  const onEditClick = jest.fn();
  const onDeleteClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens a detail dialog showing amount, category, and account when the row is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx();
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    // Act
    await user.click(screen.getByRole("button", { name: /Detail transaksi/i }));

    // Assert — scope queries to the dialog since the underlying row (with
    // its own amount text) is still present in the DOM behind the modal.
    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Detail Transaksi" }),
    ).toBeInTheDocument();
    expect(
      dialog.getByText("Rp 150.000", { exact: false }),
    ).toBeInTheDocument();
    expect(dialog.getByText("Belanja")).toBeInTheDocument();
    expect(dialog.getByText("BCA Tabungan")).toBeInTheDocument();
  });

  it("opens the detail dialog when Enter is pressed on the focused row", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx();
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );
    const row = screen.getByRole("button", { name: /Detail transaksi/i });

    // Act
    row.focus();
    await user.keyboard("{Enter}");

    // Assert
    expect(
      screen.getByRole("heading", { name: "Detail Transaksi" }),
    ).toBeInTheDocument();
  });

  it("renders '—' for a null description in the detail view", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx({ description: null });
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    // Act
    await user.click(screen.getByRole("button", { name: /Detail transaksi/i }));

    // Assert — the Deskripsi row shows the em dash, not "null"/"undefined".
    expect(screen.getByText("Deskripsi")).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("renders '—' for a null category in the detail view", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx({ categoryName: null });
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    // Act
    await user.click(screen.getByRole("button", { name: /Detail transaksi/i }));

    // Assert
    expect(screen.getByText("Kategori")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("does NOT open the detail dialog when the Edit action is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx();
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    // Act
    await user.click(screen.getByRole("button", { name: "Edit" }));

    // Assert — onEditClick fired, but the detail heading never appeared.
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", { name: "Detail Transaksi" }),
    ).not.toBeInTheDocument();
  });

  it("does NOT open the detail dialog when the Hapus (delete) action is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx();
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    // Act
    await user.click(screen.getByRole("button", { name: "Hapus" }));

    // Assert
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", { name: "Detail Transaksi" }),
    ).not.toBeInTheDocument();
  });

  it("keyboard regression: pressing Enter on the focused RowActions Edit button only edits — it does NOT also open the detail dialog", async () => {
    // Arrange — this is the WCAG 2.1.1 regression the ARIA-nesting fix
    // addresses: RowActions must be a sibling of the role="button" row, not
    // nested inside it, or a keydown on this button bubbles up into the
    // row's own Enter/Space handler and hijacks keyboard Edit/Hapus.
    const user = userEvent.setup();
    const tx = buildTx();
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );
    const editIconButton = screen.getByRole("button", { name: "Edit" });

    // Act
    editIconButton.focus();
    await user.keyboard("{Enter}");

    // Assert — onEditClick fires exactly once, and no detail dialog opens.
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", { name: "Detail Transaksi" }),
    ).not.toBeInTheDocument();
  });

  it("closes the detail dialog and opens edit when Edit is clicked inside the detail view", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx();
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );
    await user.click(screen.getByRole("button", { name: /Detail transaksi/i }));
    expect(
      screen.getByRole("heading", { name: "Detail Transaksi" }),
    ).toBeInTheDocument();

    // Act — click the "Edit" button inside the detail footer (not the
    // RowActions icon — there are now two "Edit" buttons on screen).
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[editButtons.length - 1]!);

    // Assert
    expect(onEditClick).toHaveBeenCalledTimes(1);
  });

  it("closes the detail dialog and calls onDeleteClick when Hapus is clicked inside the detail footer", async () => {
    // Arrange
    const user = userEvent.setup();
    const tx = buildTx();
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );
    await user.click(screen.getByRole("button", { name: /Detail transaksi/i }));
    expect(
      screen.getByRole("heading", { name: "Detail Transaksi" }),
    ).toBeInTheDocument();

    // Act — click the "Hapus" button inside the detail footer (not the
    // RowActions icon — there are now two "Hapus" buttons on screen).
    const deleteButtons = screen.getAllByRole("button", { name: "Hapus" });
    await user.click(deleteButtons[deleteButtons.length - 1]!);

    // Assert — the callback fires and the detail dialog closes.
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", { name: "Detail Transaksi" }),
    ).not.toBeInTheDocument();
  });

  it("renders the exact 'Tanggal & Waktu' text for a fixed occurredAt timestamp", async () => {
    // Arrange — pins formatFullDate/formatTime's output for a fixed ISO
    // input, so a regression in either date-part-slicing helper (e.g. a
    // switch to `new Date(iso).toLocaleString()`, which shifts the
    // displayed calendar day under non-UTC timezones) is caught here.
    const user = userEvent.setup();
    const tx = buildTx({ occurredAt: "2026-07-20T09:30:00.000Z" });
    render(
      <TxRow tx={tx} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    // Act
    await user.click(screen.getByRole("button", { name: /Detail transaksi/i }));

    // Assert
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Tanggal & Waktu")).toBeInTheDocument();
    expect(dialog.getByText("20 Juli 2026, 09:30")).toBeInTheDocument();
  });
});
