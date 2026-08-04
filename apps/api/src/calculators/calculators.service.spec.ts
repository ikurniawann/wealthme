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
        haulConfirmed: true,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(15_000_000);
      expect(result.nisab).toBe(93_500_000);
      expect(result.meetsNisab).toBe(false);
      expect(result.isObligated).toBe(false);
      expect(result.zakat).toBe(0);
      expect(result.nisabSource).toBe("indicative");
    });

    it("is obligated and charges 2.5% when zakatable assets exceed nisab AND haul is confirmed", () => {
      // Arrange
      const dto = {
        cash: 60_000_000,
        investments: 40_000_000,
        gold: 0,
        liabilities: 0,
        haulConfirmed: true,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(100_000_000);
      expect(result.meetsNisab).toBe(true);
      expect(result.isObligated).toBe(true);
      expect(result.zakat).toBe(2_500_000);
    });

    it("E1: meets nisab but is NOT obligated when haul is not confirmed — zakat stays an estimate", () => {
      // Arrange — same wealth as the previous case, haul unconfirmed
      const dto = {
        cash: 60_000_000,
        investments: 40_000_000,
        gold: 0,
        liabilities: 0,
        haulConfirmed: false,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert — the estimated amount is still reported...
      expect(result.meetsNisab).toBe(true);
      expect(result.zakat).toBe(2_500_000);
      // ...but obligation is never asserted from a snapshot alone.
      expect(result.isObligated).toBe(false);
    });

    it("is obligated at exactly the nisab boundary (>=) with haul confirmed", () => {
      // Arrange
      const dto = {
        cash: 93_500_000,
        investments: 0,
        gold: 0,
        liabilities: 0,
        haulConfirmed: true,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(93_500_000);
      expect(result.meetsNisab).toBe(true);
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
        haulConfirmed: true,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.zakatable).toBe(0);
      expect(result.meetsNisab).toBe(false);
      expect(result.isObligated).toBe(false);
      expect(result.zakat).toBe(0);
    });

    // ────────────────────────────────────────────────────────────
    // E2 — nisab derives from the family's own gold price when
    // supplied, and falls back to the indicative constant otherwise.
    // ────────────────────────────────────────────────────────────

    it("E2: derives nisab from the family's own gold price when provided", () => {
      // Arrange — family set Rp 1.500.000/g → nisab = 85 × 1.500.000
      const dto = {
        cash: 130_000_000,
        investments: 0,
        gold: 0,
        liabilities: 0,
        haulConfirmed: true,
        goldPricePerGram: 1_500_000,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.nisab).toBe(127_500_000);
      expect(result.nisabSource).toBe("family");
      expect(result.meetsNisab).toBe(true);
    });

    it("E2: falls back to the indicative nisab constant when no family gold price is set", () => {
      // Arrange
      const dto = {
        cash: 10_000_000,
        investments: 0,
        gold: 0,
        liabilities: 0,
        haulConfirmed: true,
      };

      // Act
      const result = service.calculateZakat(dto);

      // Assert
      expect(result.nisab).toBe(93_500_000);
      expect(result.nisabSource).toBe("indicative");
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

    it("boundary: pkp exactly at the 250jt bracket-2/bracket-3 edge stays entirely in brackets 1–2", () => {
      // Arrange — gross 310jt: biayaJabatan capped at 6jt, pkp=250jt exactly
      const dto = { grossIncome: 310_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(250_000_000);
      expect(result.taxBreakdown).toHaveLength(2);
      // bracket 1: 60jt × 5% = 3jt · bracket 2: 190jt × 15% = 28.5jt
      expect(result.totalTax).toBe(31_500_000);
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

    it("boundary: pkp exactly at the 500jt bracket-3/bracket-4 edge stays entirely in brackets 1–3", () => {
      // Arrange — gross 560jt: biayaJabatan capped at 6jt, pkp=500jt exactly
      const dto = { grossIncome: 560_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(500_000_000);
      expect(result.taxBreakdown).toHaveLength(3);
      // 3jt + 28.5jt + (250jt × 25% = 62.5jt)
      expect(result.totalTax).toBe(94_000_000);
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

    it("boundary: pkp exactly at the 5M bracket-4/bracket-5 edge stays entirely in brackets 1–4 (below top rate)", () => {
      // Arrange — gross 5.06M: biayaJabatan capped at 6jt, pkp=5M exactly
      const dto = { grossIncome: 5_060_000_000 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(5_000_000_000);
      expect(result.taxBreakdown).toHaveLength(4);
      // 3jt + 28.5jt + 62.5jt + (4,5M × 30% = 1.35M)
      expect(result.totalTax).toBe(1_444_000_000);
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

    it("floors a non-round pkp down to the nearest Rp 1.000 (DJP rounding rule)", () => {
      // Arrange — gross 100jt + zakatPaid 999 forces an unrounded raw pkp of
      // 40.999.001 (100jt - 5jt biayaJabatan - 54jt PTKP - 999 zakat).
      const dto = { grossIncome: 100_000_000, zakatPaid: 999 };

      // Act
      const result = service.calculatePph21(dto);

      // Assert
      expect(result.pkp).toBe(40_999_000); // floored, not 40_999_001
      expect(result.pkp % 1000).toBe(0);
      // 40.999.000 × 5% = 2.049.950
      expect(result.totalTax).toBe(2_049_950);
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

  // ──────────────────────────────────────────────────────────────
  // E3 — retirement calculator: sinking-fund PMT, not loan
  // amortisation. Golden case from the epic: age 30→55 (25 years),
  // 10%/yr, Rp 10jt/month current expense (target = 20 years of that
  // expense) → required saving ≈ Rp 1.808.818/month, NOT the
  // ~Rp 21.808.818/month a loan-amortisation formula would produce.
  // ──────────────────────────────────────────────────────────────

  describe("calculateRetirement() — sinking-fund PMT, not loan amortisation", () => {
    it("age 30→55, 10%/yr, Rp 10jt/month expense → ≈ Rp 1.808.818/month, not ~12× that", () => {
      // Arrange
      const dto = {
        targetAmount: 10_000_000 * 12 * 20, // Rp 2.4B — 20 years of expense
        years: 25, // 55 − 30
        annualRate: 0.1,
      };

      // Act
      const result = service.calculateRetirement(dto);

      // Assert — the correct sinking-fund answer, and nowhere near the
      // ~12× overstatement a loan-amortisation formula would produce
      // (that formula gives ≈ Rp 21.808.818/month for the same inputs).
      expect(result.monthlyContribution).toBeCloseTo(1_808_818, 0);
      expect(result.monthlyContribution).toBeLessThan(2_000_000);

      // The API's own projectedValue must equal the target it was asked
      // to reach — not compound the whole contribution stream as if
      // every instalment were deposited at t=0.
      expect(result.projectedValue).toBe(dto.targetAmount);
    });

    it("projectedValue still equals the target when existing savings are supplied", () => {
      // Arrange — some savings already accumulated, still reachable
      const dto = {
        targetAmount: 2_400_000_000,
        years: 25,
        annualRate: 0.1,
        existingAmount: 100_000_000,
      };

      // Act
      const result = service.calculateRetirement(dto);

      // Assert
      expect(result.projectedValue).toBeCloseTo(dto.targetAmount, 4);
    });

    it("handles a zero interest rate without dividing by zero", () => {
      // Arrange
      const dto = { targetAmount: 120_000_000, years: 10, annualRate: 0 };

      // Act
      const result = service.calculateRetirement(dto);

      // Assert — with 0% return, PMT × n must equal the target exactly
      expect(result.monthlyContribution).toBeCloseTo(1_000_000, 6);
      expect(result.projectedValue).toBeCloseTo(dto.targetAmount, 6);
    });
  });
});
