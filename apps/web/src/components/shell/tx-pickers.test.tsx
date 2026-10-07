import { render, screen } from "@testing-library/react";

import {
  AmountHero,
  ChoiceTiles,
  readTxnMemory,
  recordTxnUsage,
  sortByUsage,
  txnMemoryKey,
  type Choice,
} from "./tx-pickers";
import type { MoneyField } from "../money/use-money-field";

jest.mock("../money/money-input", () => ({
  MoneyHint: () => null,
}));

const field = {
  raw: "10000",
  currency: "IDR",
  decimals: 0,
  allowNegative: false,
  idrScale: 0,
  setRaw: jest.fn(),
  setCurrency: jest.fn(),
  reset: jest.fn(),
  resolved: {
    canonical: "10000",
    idrPreview: BigInt(10000),
    isPending: false,
    fx: null,
  },
  rates: undefined,
  isRateError: false,
} as unknown as MoneyField;

describe("AmountHero currency picker", () => {
  it("keeps the currency trigger at least 44px tall for coarse pointers", () => {
    render(
      <AmountHero field={field} id="amount" label="Jumlah" placeholder="0" />,
    );

    expect(screen.getByRole("button", { name: "Mata uang" })).toHaveClass(
      "h-11",
    );
  });

  it("connects an inline validation error to the amount input", () => {
    render(
      <AmountHero
        field={field}
        id="amount-error"
        label="Jumlah"
        placeholder="0"
        error="Jumlah wajib diisi"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Jumlah" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "amount-error-error");
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      "amount-error-error",
    );
  });
});

function accountChoices(count: number): Choice[] {
  return Array.from({ length: count }, (_, index) => ({
    value: `acc-${index}`,
    name: `Rekening ${index}`,
    label: `Rekening ${index}`,
  }));
}

describe("ChoiceTiles account layout", () => {
  it("keeps even a few accounts in one swipeable row, nickname first, institution as caption", () => {
    render(
      <ChoiceTiles
        variant="account"
        label="Akun"
        value="acc-0"
        onChange={jest.fn()}
        choices={[
          {
            value: "acc-0",
            name: "Harian — BCA",
            label: "Harian",
            caption: "BCA",
          },
        ]}
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Akun" })).toHaveAttribute(
      "data-layout",
      "scroll",
    );
    const tile = screen.getByRole("radio", { name: "Harian — BCA" });
    expect(tile.firstElementChild).toHaveTextContent("Harian");
    expect(tile.firstElementChild?.tagName).toBe("B");
    expect(tile.lastElementChild).toHaveTextContent("BCA");
  });

  it("keeps the scroller for more than six accounts and states how many are fully visible", () => {
    // jsdom has no layout: tiles are 90px wide on a 100px pitch inside a 300px scroller.
    const rect = jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const box = (left: number, width: number): DOMRect => ({
          x: left,
          y: 0,
          left,
          top: 0,
          width,
          height: 80,
          right: left + width,
          bottom: 80,
          toJSON: () => ({}),
        });
        if (this.getAttribute("role") === "radiogroup") return box(0, 300);
        const index = Array.from(this.parentElement?.children ?? []).indexOf(
          this,
        );
        return box(index * 100, 90);
      });
    try {
      render(
        <ChoiceTiles
          variant="account"
          label="Akun"
          value="acc-0"
          onChange={jest.fn()}
          choices={accountChoices(7)}
          countLabel={(shown, total) => `${shown} dari ${total}`}
        />,
      );

      expect(screen.getByRole("radiogroup", { name: "Akun" })).toHaveAttribute(
        "data-layout",
        "scroll",
      );
      expect(screen.getByText("3 dari 7")).toBeInTheDocument();
    } finally {
      rect.mockRestore();
    }
  });
});

describe("transaction dialog memory", () => {
  beforeEach(() => window.localStorage.clear());

  it("is namespaced by family group and falls back to empty for missing, corrupt or mis-shaped entries", () => {
    expect(readTxnMemory("fg-1")).toEqual({
      accountId: null,
      categoryId: { income: null, expense: null },
      counts: {},
    });
    window.localStorage.setItem(txnMemoryKey("fg-1"), "{nope");
    expect(readTxnMemory("fg-1").accountId).toBeNull();
    window.localStorage.setItem(
      txnMemoryKey("fg-1"),
      JSON.stringify({
        accountId: 42,
        categoryId: "cat-1",
        counts: { good: 2, bad: "x", neg: -1 },
      }),
    );
    expect(readTxnMemory("fg-1")).toEqual({
      accountId: null,
      categoryId: { income: null, expense: null },
      counts: { good: 2 },
    });

    recordTxnUsage("fg-1", {
      accountId: "acc-1",
      categoryId: "cat-1",
      kind: "expense",
    });
    expect(readTxnMemory("fg-2").accountId).toBeNull();
    expect(readTxnMemory("fg-1").accountId).toBe("acc-1");
  });

  it("counts category use per id and remembers the last category per kind", () => {
    recordTxnUsage("fg-1", { categoryId: "cat-1", kind: "expense" });
    recordTxnUsage("fg-1", { categoryId: "cat-1", kind: "expense" });
    recordTxnUsage("fg-1", {
      accountId: "acc-2",
      categoryId: "cat-gaji",
      kind: "income",
    });
    // A transfer names an account but no category: counts stay put.
    recordTxnUsage("fg-1", { accountId: "acc-3", kind: "expense" });

    expect(readTxnMemory("fg-1")).toEqual({
      accountId: "acc-3",
      categoryId: { income: "cat-gaji", expense: "cat-1" },
      counts: { "cat-1": 2, "cat-gaji": 1 },
    });
  });

  it("sorts most-used first, then alphabetically, without mutating the input", () => {
    const categories = [
      { id: "c", name: "Transport" },
      { id: "a", name: "Belanja" },
      { id: "b", name: "Makan & Minum" },
    ];
    expect(
      sortByUsage(categories, { b: 5, c: 5 }).map((category) => category.name),
    ).toEqual(["Makan & Minum", "Transport", "Belanja"]);
    expect(categories.map((category) => category.id)).toEqual(["c", "a", "b"]);
  });
});
