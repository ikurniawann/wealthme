/**
 * Batch 2 (#4) — the "Alokasi Kekayaan" legend's label and Rupiah spans are
 * CSS-truncated (`overflow:hidden; text-overflow:ellipsis; white-space:
 * nowrap`) with no `title`, so a long category name or a large amount had
 * no way to be read in full. This asserts the missing `title` attributes,
 * matching the pattern already used by the compact value span.
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../components/charts/apex-base", () => ({
  chartPalette: () => ["#111111", "#222222"],
  useThemeRebuildToken: () => 0,
}));

jest.mock("../../../../components/charts/apex-presets", () => ({
  DonutChart: () => <div data-testid="donut-stub" />,
}));

// useMoney() otherwise pulls in useProfile -> useSession -> the real
// better-auth ESM client, which jest can't transform in this test file.
// IDR-passthrough stub matches this suite's pre-Batch-C behavior (no
// display-currency preference set).
jest.mock("../../../../hooks/use-money", () => {
  const {
    formatRupiah,
    formatRupiahCompact,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require("../../../../lib/format");
  return {
    useMoney: () => ({
      currency: "IDR",
      isIndicative: false,
      isReady: true,
      format: formatRupiah,
      formatCompact: formatRupiahCompact,
    }),
  };
});

import { render, screen } from "@testing-library/react";

import { AllocationCard } from "./allocation-card";
import type { AllocationItem } from "./use-beranda-data";

function buildItem(overrides: Partial<AllocationItem> = {}): AllocationItem {
  return {
    label: "Rekening Bank & E-Wallet Gabungan",
    amount: 125_000_000,
    percent: 42,
    apiColor: "#06B6D4",
    ...overrides,
  };
}

describe("AllocationCard — legend title attributes (batch-2 #4)", () => {
  it("gives the truncated label span a title with the full label text", () => {
    const item = buildItem();
    render(<AllocationCard isLoading={false} allocation={[item]} />);

    const label = screen.getByText(item.label);
    expect(label).toHaveAttribute("title", item.label);
  });

  it("gives the truncated meta Rupiah span a title with the formatted amount", () => {
    const item = buildItem();
    render(<AllocationCard isLoading={false} allocation={[item]} />);

    const metaRp = screen.getByText("Rp 125.000.000");
    expect(metaRp).toHaveAttribute("title", "Rp 125.000.000");
  });
});
