import {
  TAX_RULES,
  listRuleRefs,
  monthStartDate,
  ruleAt,
  wibDateString,
  yearEndDate,
} from "./tax-rules.registry";

import type { TaxRuleKey } from "./tax-rule.types";

const nextDay = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

describe("tax rule registry integrity", () => {
  const byKey = new Map<TaxRuleKey, (typeof TAX_RULES)[number][]>();
  for (const e of TAX_RULES) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e]);

  it("every key's entries are contiguous, non-overlapping and end open-ended", () => {
    for (const [key, entries] of byKey) {
      const sorted = [...entries].sort((a, b) =>
        a.effectiveFrom.localeCompare(b.effectiveFrom),
      );
      sorted.forEach((e, i) => {
        const next = sorted[i + 1];
        if (next)
          expect({ key, gapFree: nextDay(e.effectiveTo ?? "") }).toEqual({
            key,
            gapFree: next.effectiveFrom,
          });
        else expect({ key, open: e.effectiveTo }).toEqual({ key, open: null });
      });
    }
  });

  it("every entry names a legal basis", () => {
    for (const e of TAX_RULES) expect(e.legalBasis.length).toBeGreaterThan(0);
  });

  it("TER tables ascend strictly and end with an open band; A/B/C have 44/40/41 bands", () => {
    const { value } = ruleAt("pph21.terTables", "2026-01-01");
    for (const cat of ["A", "B", "C"] as const) {
      const t = value[cat];
      t.slice(0, -1).forEach((b, i) => {
        expect(b.upTo).not.toBeNull();
        if (i > 0) expect(b.upTo! > t[i - 1]!.upTo!).toBe(true);
        expect(t[i + 1]!.rateBps).toBeGreaterThanOrEqual(b.rateBps);
      });
      expect(t[t.length - 1]!.upTo).toBeNull();
    }
    expect([value.A.length, value.B.length, value.C.length]).toEqual([
      44, 40, 41,
    ]);
  });
});

describe("ruleAt effective-date switching", () => {
  it("crypto domestic 10 bps until 2025-07-31, 21 bps from 2025-08-01", () => {
    expect(ruleAt("final.cryptoDomestic", "2025-07-31").value.rateBps).toBe(10);
    expect(ruleAt("final.cryptoDomestic", "2025-08-01").value.rateBps).toBe(21);
    expect(ruleAt("final.cryptoForeign", "2025-08-01").value.rateBps).toBe(100);
  });

  it("PPN: 2024 DPP 1/1 @11%, Jan-2025 luxury 11/12, Feb-2025 luxury 12/12", () => {
    expect(ruleAt("ppn.rate", "2024-12-31").value.nominalBps).toBe(1100);
    expect(ruleAt("ppn.rate", "2025-01-15").value.luxuryDpp).toEqual({
      num: 11n,
      den: 12n,
    });
    expect(ruleAt("ppn.rate", "2025-02-01").value.luxuryDpp).toEqual({
      num: 12n,
      den: 12n,
    });
  });

  it("DTP: 2024 none, pariwisata only from 2025-10-01, 2026 requires validated NIK", () => {
    expect(ruleAt("pph21.dtp", "2024-06-01").value.sectors).toEqual([]);
    expect(ruleAt("pph21.dtp", "2025-09-01").value.sectors).not.toContain(
      "pariwisata",
    );
    expect(ruleAt("pph21.dtp", "2025-10-01").value.sectors).toContain(
      "pariwisata",
    );
    expect(ruleAt("pph21.dtp", "2026-03-01").value.requiresValidatedNik).toBe(
      true,
    );
    expect(ruleAt("pph21.dtp", "2027-01-01").value.sectors).toEqual([]);
  });

  it("UMKM time limit 7 until 2026-04-21, none from 2026-04-22", () => {
    expect(
      ruleAt("umkm.final", "2026-04-21").value.individualTimeLimitYears,
    ).toBe(7);
    expect(
      ruleAt("umkm.final", "2026-04-22").value.individualTimeLimitYears,
    ).toBeNull();
  });

  it("a date before the earliest entry resolves to it with outOfRange", () => {
    const r = ruleAt("pph.pasal17", yearEndDate(2019));
    expect(r.ref.outOfRange).toBe(true);
    expect(r.value[0]!.upTo).toBe(60_000_000n);
    expect(ruleAt("pph.pasal17", yearEndDate(2022)).ref.outOfRange).toBe(false);
  });

  it("SPT grace 2026-04-30 only for the 2026 filing season", () => {
    expect(
      ruleAt("filing.sptGrace", "2026-03-31").value.penaltyWaivedUntil,
    ).toBe("2026-04-30");
    expect(
      ruleAt("filing.sptGrace", "2025-03-31").value.penaltyWaivedUntil,
    ).toBeNull();
    expect(
      ruleAt("filing.sptGrace", "2027-03-31").value.penaltyWaivedUntil,
    ).toBeNull();
  });

  it("rejects malformed dates", () => {
    expect(() => ruleAt("ppn.rate", "2025-1-1")).toThrow(RangeError);
  });
});

describe("date helpers and refs", () => {
  it("wibDateString uses the Asia/Jakarta calendar day", () => {
    expect(wibDateString(new Date("2025-07-31T17:00:00Z"))).toBe("2025-08-01");
    expect(wibDateString(new Date("2025-07-31T16:59:59Z"))).toBe("2025-07-31");
  });
  it("monthStartDate pads", () =>
    expect(monthStartDate(2026, 4)).toBe("2026-04-01"));
  it("listRuleRefs returns one ref per requested key", () => {
    const refs = listRuleRefs("2026-09-26", [
      "ppn.rate",
      "final.cryptoDomestic",
    ]);
    expect(refs.map((r) => r.key)).toEqual([
      "ppn.rate",
      "final.cryptoDomestic",
    ]);
    expect(refs[1]).toMatchObject({
      verified: true,
      source: "https://www.pajak.go.id/en/node/117234",
    });
  });
});
