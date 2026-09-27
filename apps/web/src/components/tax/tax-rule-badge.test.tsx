import { render, screen } from "@testing-library/react";

import { TaxRuleBadge } from "./tax-rule-badge";

import type { TaxRuleRefDto } from "@wealthme/contracts";

jest.mock("../../hooks/use-locale", () => ({
  useLocale: () => ({
    t: (jest.requireActual("../../i18n/id") as typeof import("../../i18n/id"))
      .id,
  }),
}));

const ref = (o: Partial<TaxRuleRefDto>): TaxRuleRefDto => ({
  key: "pph.pasal17",
  legalBasis: "UU 7/2021",
  source: null,
  verified: true,
  effectiveFrom: "2022-01-01",
  effectiveTo: null,
  outOfRange: false,
  note: null,
  ...o,
});

it("renders nothing when every rule is verified and in range", () => {
  const { container } = render(<TaxRuleBadge rules={[ref({})]} />);
  expect(container).toBeEmptyDOMElement();
});

it("labels unverified rules and links their source", () => {
  render(
    <TaxRuleBadge
      rules={[
        ref({
          verified: false,
          key: "final.cryptoDomestic",
          legalBasis: "PMK 50/2025",
          source: "https://www.pajak.go.id/en/node/117234",
        }),
      ]}
    />,
  );
  expect(screen.getByText("Perkiraan")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /PMK 50\/2025/ })).toHaveAttribute(
    "href",
    "https://www.pajak.go.id/en/node/117234",
  );
});

it("flags an out-of-range (older year) rule even if verified", () => {
  render(<TaxRuleBadge rules={[ref({ outOfRange: true })]} />);
  expect(screen.getByText("Perkiraan")).toBeInTheDocument();
});
