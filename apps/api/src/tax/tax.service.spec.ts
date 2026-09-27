import { TaxService } from "./tax.service";

const FG = "fg-1";
const legacyRow = (o: Record<string, unknown> = {}) => ({
  id: "t1",
  familyGroupId: FG,
  taxYear: 2024,
  grossIncome: 120_000_000n,
  ptkp: 63_000_000n,
  zakatDeduction: 0n,
  netTax: 0n,
  sptStatus: "belum_lapor",
  documentUrl: null,
  notes: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
  calcMode: "legacy",
  maritalStatus: null,
  dependents: null,
  pensionContribution: null,
  freelanceGross: null,
  nppnRateBps: null,
  otherNetIncome: null,
  withheldPph21: null,
  sptFiledAt: null,
  ...o,
});

const prisma = {
  taxRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
const donations = { getTotalDeductibleAmount: jest.fn() };
const echo = ({ create, data }: { create?: object; data?: object }) =>
  Promise.resolve(legacyRow({ ...(create ?? data) }));

describe("TaxService — legacy rows are unchanged", () => {
  const svc = new TaxService(prisma as never, donations as never);
  beforeEach(() => {
    jest.resetAllMocks();
    donations.getTotalDeductibleAmount.mockResolvedValue(2_500_000n);
  });

  it("reads a legacy row with the same netTax as before (2.425.000) and legacy defaults", async () => {
    prisma.taxRecord.findMany.mockResolvedValue([legacyRow()]);
    const [r] = await svc.findAll(FG);
    expect(r).toMatchObject({
      netTax: "2425000",
      calcMode: "legacy",
      maritalStatus: null,
      balance: "2425000",
      sptFiledAt: null,
    });
    expect(r!.rules.map((x) => x.key)).toContain("pph.pasal17");
  });

  it("PATCH sptStatus only keeps the row legacy, keeps netTax, stamps sptFiledAt", async () => {
    prisma.taxRecord.findUnique.mockResolvedValue(legacyRow());
    prisma.taxRecord.update.mockImplementation(echo);
    await svc.update(FG, "t1", { sptStatus: "sudah_lapor" });
    const data = prisma.taxRecord.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      calcMode: "legacy",
      netTax: 2_425_000n,
      sptStatus: "sudah_lapor",
    });
    expect(data.sptFiledAt).toBeInstanceOf(Date);
  });

  // Opus review fix round 1 (Important #1) — maritalStatus: null must not be
  // treated as "maritalStatus is set": POST with an explicit null stays legacy.
  it("POST with maritalStatus: null and ptkp given stays legacy (netTax 2.425.000)", async () => {
    prisma.taxRecord.findUnique.mockResolvedValue(null);
    prisma.taxRecord.upsert.mockImplementation(echo);
    const r = await svc.upsertByYear(FG, {
      taxYear: 2024,
      grossIncome: "120000000",
      ptkp: "63000000",
      maritalStatus: null as never,
    });
    const create = prisma.taxRecord.upsert.mock.calls[0][0].create;
    expect(create).toMatchObject({ calcMode: "legacy", netTax: 2_425_000n });
    expect(r).toMatchObject({ calcMode: "legacy", netTax: "2425000" });
  });

  it("PATCH with maritalStatus: null keeps a legacy row legacy", async () => {
    prisma.taxRecord.findUnique.mockResolvedValue(legacyRow());
    prisma.taxRecord.update.mockImplementation(echo);
    await svc.update(FG, "t1", { maritalStatus: null as never });
    expect(prisma.taxRecord.update.mock.calls[0][0].data).toMatchObject({
      calcMode: "legacy",
      netTax: 2_425_000n,
    });
  });
});

describe("TaxService — detailed rows", () => {
  const svc = new TaxService(prisma as never, donations as never);
  beforeEach(() => {
    jest.resetAllMocks();
    donations.getTotalDeductibleAmount.mockResolvedValue(2_500_000n);
    prisma.taxRecord.upsert.mockImplementation(echo);
  });

  it("POST with maritalStatus → detailed K/1: ptkp derived 63jt, netTax 2.245.000, balance 245.000", async () => {
    const r = await svc.upsertByYear(FG, {
      taxYear: 2026,
      grossIncome: "120000000",
      maritalStatus: "K",
      dependents: 1,
      pensionContribution: "3600000",
      withheldPph21: "2000000",
      ptkp: "1",
    });
    const create = prisma.taxRecord.upsert.mock.calls[0][0].create;
    expect(create).toMatchObject({
      calcMode: "detailed",
      ptkp: 63_000_000n,
      netTax: 2_245_000n,
      maritalStatus: "K",
      dependents: 1,
    });
    expect(r).toMatchObject({
      netTax: "2245000",
      balance: "245000",
      calcMode: "detailed",
    });
  });

  it("NPPN freelancer: grossIncome 0, 600jt × 50% → netTax 30.900.000 (zakat 0)", async () => {
    donations.getTotalDeductibleAmount.mockResolvedValue(0n);
    await svc.upsertByYear(FG, {
      taxYear: 2026,
      grossIncome: "0",
      maritalStatus: "TK",
      dependents: 0,
      freelanceGross: "600000000",
      nppnRateBps: 5000,
    });
    expect(prisma.taxRecord.upsert.mock.calls[0][0].create).toMatchObject({
      netTax: 30_900_000n,
      freelanceGross: 600_000_000n,
      nppnRateBps: 5000,
    });
  });

  it("PATCH a legacy row with maritalStatus switches it to detailed", async () => {
    prisma.taxRecord.findUnique.mockResolvedValue(legacyRow({ taxYear: 2026 }));
    prisma.taxRecord.update.mockImplementation(echo);
    await svc.update(FG, "t1", {
      maritalStatus: "K",
      dependents: 1,
      pensionContribution: "3600000",
    });
    expect(prisma.taxRecord.update.mock.calls[0][0].data).toMatchObject({
      calcMode: "detailed",
      ptkp: 63_000_000n,
      netTax: 2_245_000n,
    });
  });

  it("moving away from sudah_lapor clears sptFiledAt", async () => {
    prisma.taxRecord.findUnique.mockResolvedValue(
      legacyRow({ sptStatus: "sudah_lapor", sptFiledAt: new Date() }),
    );
    prisma.taxRecord.update.mockImplementation(echo);
    await svc.update(FG, "t1", { sptStatus: "terlambat" });
    expect(prisma.taxRecord.update.mock.calls[0][0].data.sptFiledAt).toBeNull();
  });
});

describe("TaxService — fix round 1 minor fold-ins", () => {
  const svc = new TaxService(prisma as never, donations as never);
  beforeEach(() => {
    jest.resetAllMocks();
    donations.getTotalDeductibleAmount.mockResolvedValue(2_500_000n);
  });

  it("POST without maritalStatus onto an existing detailed row reverts it to legacy (full replace)", async () => {
    prisma.taxRecord.findUnique.mockResolvedValue(
      legacyRow({
        taxYear: 2026,
        calcMode: "detailed",
        maritalStatus: "K",
        dependents: 1,
        pensionContribution: 3_600_000n,
        freelanceGross: 1_000_000n,
        nppnRateBps: 5000,
        otherNetIncome: 500_000n,
        withheldPph21: 2_000_000n,
      }),
    );
    prisma.taxRecord.upsert.mockImplementation(echo);
    const r = await svc.upsertByYear(FG, {
      taxYear: 2026,
      grossIncome: "120000000",
      ptkp: "63000000",
    });
    const update = prisma.taxRecord.upsert.mock.calls[0][0].update;
    expect(update).toMatchObject({
      calcMode: "legacy",
      maritalStatus: null,
      dependents: null,
      pensionContribution: null,
      freelanceGross: null,
      nppnRateBps: null,
      otherNetIncome: null,
      withheldPph21: null,
    });
    expect(r.calcMode).toBe("legacy");
  });

  it("a pre-2022 legacy record's response carries rules[].outOfRange: true for pph.pasal17", async () => {
    prisma.taxRecord.findMany.mockResolvedValue([legacyRow({ taxYear: 2019 })]);
    const [r] = await svc.findAll(FG);
    const p17 = r!.rules.find((x) => x.key === "pph.pasal17");
    expect(p17).toMatchObject({ outOfRange: true });
  });
});
