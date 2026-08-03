import { BillingCycleProcessor } from "./billing-cycle.processor";

function makePrisma() {
  return {
    liability: { findMany: jest.fn(), update: jest.fn() },
    insurance: { findMany: jest.fn(), update: jest.fn() },
  };
}

describe("BillingCycleProcessor", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let processor: BillingCycleProcessor;

  beforeEach(() => {
    prisma = makePrisma();
    processor = new BillingCycleProcessor(prisma as never);
    jest.useFakeTimers().setSystemTime(new Date("2026-12-15T12:00:00.000Z"));
  });

  afterEach(() => jest.useRealTimers());

  it("advances a quarterly renewal that lands exactly at the worker tick into the next future cycle", async () => {
    // The fake "now" the worker runs at (see jest.useFakeTimers above).
    const now = new Date("2026-12-15T12:00:00.000Z");
    prisma.liability.findMany.mockResolvedValue([]);
    prisma.insurance.findMany.mockResolvedValue([
      {
        id: "insurance-1",
        // renewalDate === now: must be picked up by this tick (`lte`), not
        // skipped until the next one (`lt` would miss it).
        renewalDate: now,
        premiumPeriod: "quarterly",
      },
    ]);

    await processor.process({} as never);

    // The query boundary must be `lte`, not `lt`, so an exact match isn't
    // skipped.
    expect(prisma.liability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dueDate: { lte: now } }),
      }),
    );
    expect(prisma.insurance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ renewalDate: { lte: now } }),
      }),
    );

    // And the row landing exactly at "now" is still correctly advanced.
    expect(prisma.insurance.update).toHaveBeenCalledWith({
      where: { id: "insurance-1" },
      data: { renewalDate: new Date("2027-03-15T12:00:00.000Z") },
    });
  });
});
