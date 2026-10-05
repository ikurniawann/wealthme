import { render, screen } from "@testing-library/react";

import { AmountHero } from "./tx-pickers";
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
      "[@media(pointer:coarse)]:min-h-11",
    );
  });
});
