import { FxMockService } from "./fx-mock.service";

// EPIC-021 Group F (#1) — AUD + CNY added to the same indicative mock rate
// table as the pre-existing currencies (Open Design Decision #6: no live
// rate feed exists or may be invented).
describe("FxMockService", () => {
  let service: FxMockService;

  beforeEach(() => {
    service = new FxMockService();
  });

  it("includes AUD and CNY in the base-IDR rates table", async () => {
    const rates = await service.getRates("IDR");

    expect(rates["AUD"]).toBeGreaterThan(0);
    expect(rates["CNY"]).toBeGreaterThan(0);
    // Pre-existing currencies remain untouched.
    expect(rates["USD"]).toBeGreaterThan(0);
    expect(rates["SGD"]).toBeGreaterThan(0);
    expect(rates["EUR"]).toBeGreaterThan(0);
    expect(rates["JPY"]).toBeGreaterThan(0);
  });

  it("getRate resolves IDR -> AUD and IDR -> CNY conversions", async () => {
    const aud = await service.getRate("IDR", "AUD");
    const cny = await service.getRate("IDR", "CNY");

    expect(aud).toBeGreaterThan(0);
    expect(cny).toBeGreaterThan(0);
  });

  it("getRate is symmetric for AUD/CNY (from->to is the inverse of to->from)", async () => {
    const audToIdr = await service.getRate("AUD", "IDR");
    const idrToAud = await service.getRate("IDR", "AUD");
    expect(audToIdr).toBeCloseTo(1 / idrToAud, 6);

    const cnyToIdr = await service.getRate("CNY", "IDR");
    const idrToCny = await service.getRate("IDR", "CNY");
    expect(cnyToIdr).toBeCloseTo(1 / idrToCny, 6);
  });

  it("getRate(from, from) is always 1, including for the new currencies", async () => {
    expect(await service.getRate("AUD", "AUD")).toBe(1);
    expect(await service.getRate("CNY", "CNY")).toBe(1);
  });

  it("revisi I — getSnapshot exposes the table as indicative IDR-per-unit strings", async () => {
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({ source: "indicative", stale: true });
    expect(snap.idrPerUnit).toEqual({
      IDR: "1.000000",
      USD: "15873.015873",
      SGD: "11764.705882",
      EUR: "17241.379310",
      JPY: "105.263158",
      AUD: "10309.278351",
      CNY: "2232.142857",
    });
  });
});
