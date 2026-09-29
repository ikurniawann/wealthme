/**
 * Hardening batch G5 (Goal-gradient) — the liability due-date notice used
 * to show only the due date; it now also shows "Cicilan ke-N dari tenor"
 * when tenorMonths/startDate are available, reusing data already fetched.
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { render, screen } from "@testing-library/react";
import type { LiabilityDto } from "@wealthme/contracts";

import { AttentionCard } from "./attention-card";

function buildLiability(overrides: Partial<LiabilityDto> = {}): LiabilityDto {
  return {
    id: "l-1",
    familyGroupId: "fg-1",
    name: "KPR Rumah",
    institution: "BCA",
    type: "kpr",
    totalDebt: "500000000",
    remainingBalance: "400000000",
    minimumPayment: "5000000",
    interestRate: "8.5",
    dueDate: null,
    nextDueDate: "2026-10-24",
    autoAdvanceDueDate: true,
    paymentRatio: 0.2,
    paidThisPeriod: false,
    notes: null,
    currency: "IDR",
    interestMethod: "flat",
    tenorMonths: 180,
    startDate: "2025-10-24",
    installmentAmount: "5000000",
    currentInstallmentAmount: "5000000",
    fixedRateMonths: null,
    floatingRate: null,
    kprScheme: null,
    ratePeriods: [],
    currentRatePercent: "8.5",
    currentInstallmentLate: false,
    createdAt: "2025-10-24T00:00:00.000Z",
    ...overrides,
  } as LiabilityDto;
}

describe("AttentionCard — liability installment progress", () => {
  it("shows 'Cicilan ke-N dari tenor' when startDate/tenorMonths are available", () => {
    render(
      <AttentionCard
        isLoading={false}
        pendingApprovalsCount={0}
        nearestDueLiability={buildLiability()}
      />,
    );
    // ~12 months elapsed since startDate a year ago.
    expect(screen.getByText(/Cicilan ke-\d+ dari 180/)).toBeInTheDocument();
  });

  it("omits the progress parenthetical when tenorMonths is missing", () => {
    render(
      <AttentionCard
        isLoading={false}
        pendingApprovalsCount={0}
        nearestDueLiability={buildLiability({ tenorMonths: null })}
      />,
    );
    expect(screen.queryByText(/Cicilan ke-/)).not.toBeInTheDocument();
  });

  it("gives the card a warning accent only when there is something to flag", () => {
    const { container, rerender } = render(
      <AttentionCard
        isLoading={false}
        pendingApprovalsCount={0}
        nearestDueLiability={undefined}
      />,
    );
    expect(container.querySelector(".border-warning\\/50")).toBeNull();

    rerender(
      <AttentionCard
        isLoading={false}
        pendingApprovalsCount={2}
        nearestDueLiability={undefined}
      />,
    );
    expect(container.querySelector(".border-warning\\/50")).not.toBeNull();
  });
});
