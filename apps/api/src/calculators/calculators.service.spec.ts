import { CalculatorsService } from "./calculators.service";

// Golden-value tests for the shared BE calculators — these are the single
// source of truth for zakat maal + PPh21 math; the web app's /donation and
// /tax pages call these endpoints instead of duplicating the formulas.
describe("CalculatorsService", () => {
  let service: CalculatorsService;

  beforeEach(() => {
    service = new CalculatorsService();
  });

  // ──────────────────────────────────────────────────────────────
  // Zakat Maal — nisab = 85g gold × Rp 1.100.000/g = Rp 93.500.000
  // ──────────────────────────────────────────────────────────────

  describe("calculateZakat()", () => {
    it("is not obligated when zakatable assets are below nisab", () => {
      // Arrange
      const dto = {
        cash: 10_000_000,
        investments: 5_000_000,
        gold: 0,
        liabilities: 0,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(15_000_000);
      expect(result.nisab).toBe(93_500_000);
      expect(result.isObligated).toBe(false);
      expect(result.zakat).toBe(0);
    });

    it("is obligated and charges 2.5% when zakatable assets exceed nisab", () => {
      // Arrange
      const dto = {
        cash: 60_000_000,
        investments: 40_000_000,
        gold: 0,
        liabilities: 0,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(100_000_000);
      expect(result.isObligated).toBe(true);
      expect(result.zakat).toBe(2_500_000);
    });

    it("is obligated at exactly the nisab boundary (>=)", () => {
      // Arrange
      const dto = {
        cash: 93_500_000,
        investments: 0,
        gold: 0,
        liabilities: 0,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(93_500_000);
      expect(result.isObligated).toBe(true);
      expect(result.zakat).toBe(2_337_500);
    });

    it("subtracts liabilities and floors zakatable assets at zero", () => {
      // Arrange
      const dto = {
        cash: 10_000_000,
        investments: 0,
        gold: 0,
        liabilities: 25_000_000,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(0);
      expect(result.isObligated).toBe(false);
      expect(result.zakat).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // PPh 21 — PTKP TK/0 = Rp 54.000.000, biaya jabatan 5% capped at
  // Rp 6.000.000, progressive brackets per UU HPP 2021.
  // ──────────────────────────────────────────────────────────────

  describe("calculatePph21() — one golden value per bracket", () => {
    it("bracket 1 (5%, 0–60jt): pkp fully inside the first bracket", () => {
      // Arrange — gross 100jt: biayaJabatan=5jt (uncapped), pkp=41jt
      const dto = { grossIncome: 100_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.biayaJabatan).toBe(5_000_000);
      expect(result.ptkp).toBe(54_000_000);
      expect(result.pkp).toBe(41_000_000);
      expect(result.taxBreakdown).toHaveLength(1);
      expect(result.taxBreakdown[0].rate).toBe(0.05);
      expect(result.totalTax).toBe(2_050_000);
    });

    it("boundary: pkp exactly at the 60jt bracket-1/bracket-2 edge stays entirely in bracket 1", () => {
      // Arrange — gross 120jt: biayaJabatan capped at 6jt, pkp=60jt exactly
      const dto = { grossIncome: 120_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.biayaJabatan).toBe(6_000_000);
      expect(result.pkp).toBe(60_000_000);
      expect(result.taxBreakdown).toHaveLength(1);
      expect(result.totalTax).toBe(3_000_000);
    });

    it("bracket 2 (15%, 60–250jt): pkp reaches into the second bracket", () => {
      // Arrange — gross 300jt: biayaJabatan capped at 6jt, pkp=240jt
      const dto = { grossIncome: 300_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(240_000_000);
      expect(result.taxBreakdown).toHaveLength(2);
      expect(result.taxBreakdown[1].rate).toBe(0.15);
      // bracket 1: 60jt × 5% = 3jt · bracket 2: 180jt × 15% = 27jt
      expect(result.totalTax).toBe(30_000_000);
    });

    it("bracket 3 (25%, 250–500jt): pkp reaches into the third bracket", () => {
      // Arrange — gross 360jt: biayaJabatan capped at 6jt, pkp=300jt
      const dto = { grossIncome: 360_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(300_000_000);
      expect(result.taxBreakdown).toHaveLength(3);
      expect(result.taxBreakdown[2].rate).toBe(0.25);
      // 3jt + 28.5jt + (50jt × 25% = 12.5jt)
      expect(result.totalTax).toBe(44_000_000);
    });

    it("bracket 4 (30%, 500jt–5M): pkp reaches into the fourth bracket", () => {
      // Arrange — gross 1.06M: biayaJabatan capped at 6jt, pkp=1M
      const dto = { grossIncome: 1_060_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(1_000_000_000);
      expect(result.taxBreakdown).toHaveLength(4);
      expect(result.taxBreakdown[3].rate).toBe(0.3);
      // 3jt + 28.5jt + 62.5jt + (500jt × 30% = 150jt)
      expect(result.totalTax).toBe(244_000_000);
    });

    it("bracket 5 (35%, >5M): pkp exceeds the top bracket threshold", () => {
      // Arrange — gross 6.06M: biayaJabatan capped at 6jt, pkp=6M
      const dto = { grossIncome: 6_060_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(6_000_000_000);
      expect(result.taxBreakdown).toHaveLength(5);
      expect(result.taxBreakdown[4].rate).toBe(0.35);
      // 3jt + 28.5jt + 62.5jt + 1.35M + (1M × 35% = 350jt)
      expect(result.totalTax).toBe(1_794_000_000);
      expect(result.effectiveRate).toBeCloseTo(
        1_794_000_000 / 6_060_000_000,
        6,
      );
    });

    it("applies an explicit ptkp override instead of the TK/0 default", () => {
      // Arrange — K/3 PTKP (Rp 72.000.000) on gross 120jt
      const dto = { grossIncome: 120_000_000, ptkp: 72_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.ptkp).toBe(72_000_000);
      expect(result.pkp).toBe(42_000_000);
      expect(result.totalTax).toBe(2_100_000);
    });

    it("reduces pkp by zakatPaid", () => {
      // Arrange
      const dto = { grossIncome: 120_000_000, zakatPaid: 10_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.zakatDeduction).toBe(10_000_000);
      expect(result.pkp).toBe(50_000_000);
      expect(result.totalTax).toBe(2_500_000);
    });
  });
});
