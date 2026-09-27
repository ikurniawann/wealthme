import { TaxSummaryService } from "./tax-summary.service";

const tax = { findByYear: jest.fn() };
const finalTax = { estimate: jest.fn() };
const umkm = { get: jest.fn() };

describe("TaxSummaryService", () => {
  const svc = new TaxSummaryService(
    tax as never,
    finalTax as never,
    umkm as never,
  );
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("sums PPh OP + final + UMKM and reports SPT timing for tax year 2025 on 2026-09-26", async () => {
    tax.findByYear.mockResolvedValue({
      id: "t1",
      calcMode: "legacy",
      netTax: "2425000",
      withheldPph21: null,
      balance: "2425000",
      sptStatus: "belum_lapor",
      sptFiledAt: null,
      rules: [],
    });
    finalTax.estimate.mockResolvedValue({
      taxYear: 2025,
      lines: [],
      totalTax: "712603",
      missingRateCount: 0,
      skippedForeign: 0,
    });
    umkm.get.mockResolvedValue({
      totalTax: "1700000",
      exceedsCeiling: false,
      ineligibleReason: null,
      rules: [],
    });
    const r = await svc.summary("fg-1", 2025, "2026-09-26");
    expect(r.totalEstimatedTax).toBe("4837603");
    expect(r.spt).toEqual({
      status: "belum_lapor",
      deadline: "2026-03-31",
      graceUntil: "2026-04-30",
      daysToDeadline: -179,
      pastDeadline: true,
      withinGrace: false,
      filedAt: null,
    });
  });

  it("no record, no UMKM → pphOp null, umkm null, status null", async () => {
    tax.findByYear.mockResolvedValue(null);
    finalTax.estimate.mockResolvedValue({
      taxYear: 2026,
      lines: [],
      totalTax: "0",
      missingRateCount: 0,
      skippedForeign: 0,
    });
    umkm.get.mockResolvedValue(null);
    const r = await svc.summary("fg-1", 2026, "2026-09-26");
    expect(r).toMatchObject({
      pphOp: null,
      umkm: null,
      totalEstimatedTax: "0",
      spt: { status: null, daysToDeadline: 186, graceUntil: null },
    });
  });
});
