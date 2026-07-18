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

  it("advances a quarterly renewal that lands exactly today into the next future cycle", async () => {
    prisma.liability.findMany.mockResolvedValue([]);
    prisma.insurance.findMany.mockResolvedValue([
      {
        id: "insurance-1",
        renewalDate: new Date("2026-09-15T12:00:00.000Z"),
        premiumPeriod: "quarterly",
      },
    ]);

    await processor.process({} as never);

    expect(prisma.insurance.update).toHaveBeenCalledWith({
      where: { id: "insurance-1" },
      data: { renewalDate: new Date("2027-03-15T12:00:00.000Z") },
    });
  });
});
