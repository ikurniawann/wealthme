/**
 * EPIC-016 Task B2 — formatRupiah currency overload.
 *
 * Verifies that:
 * 1. `formatRupiah(value)` with ONE argument produces the exact same byte-for-byte output as
 *    before the currency overload was added (regression) — 18 call sites across the app
 *    depend on this staying 100% backward compatible.
 * 2. `formatRupiah(value, target)` with an optional currency target converts and formats
 *    correctly.
 * 3. Currency symbols and decimal precision per currency are correct (IDR/JPY -> 0 decimals,
 *    USD/SGD/EUR -> 2 decimals).
 *
 * A real, Jest-executed spec (imports directly from the protected `../format.ts`) — this
 * replaces a dead `format.test.mjs` that Jest's default testMatch never picked up.
 */

import {
  displayNotificationText,
  formatAxisCompact,
  formatAxisMoney,
  localizeMoneyText,
  withSign,
  formatPercent,
  formatRupiah,
  formatRupiahCompact,
} from "./format";

describe("formatRupiah", () => {
  it("single-arg call: regression — exact byte-for-byte output unchanged", () => {
    // This is CRITICAL: 18 call sites across the app depend on formatRupiah(value)
    // continuing to work identically. The new overload must be 100% backward compatible.
    expect(formatRupiah(0)).toBe("Rp\u00A00");
    expect(formatRupiah(1000)).toBe("Rp\u00A01.000");
    expect(formatRupiah(1256780000)).toBe("Rp\u00A01.256.780.000");
    expect(formatRupiah(25850000)).toBe("Rp\u00A025.850.000");
    expect(formatRupiah(1000000)).toBe("Rp\u00A01.000.000");
  });

  it("with target: USD conversion with 2 decimals", () => {
    // USD rate from /fx/rates is approximately 0.000063 (IDR to USD)
    // 1,000,000 IDR * 0.000063 = ~63 USD
    const target = { code: "USD", rate: 0.000063 };
    const result = formatRupiah(1000000, target);

    expect(result).toBe("US$\u00A063,00");
  });

  it("with target: JPY conversion with 0 decimals", () => {
    // JPY rate is approximately 0.0095 (IDR to JPY)
    // 1,000,000 IDR * 0.0095 = ~9,500 JPY
    const target = { code: "JPY", rate: 0.0095 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/¥|JPY/);
    expect(result).not.toMatch(/\.\d{2}$/);
  });

  it("with target: SGD conversion with 2 decimals", () => {
    // SGD rate is approximately 0.000085 (IDR to SGD)
    // 1,000,000 IDR * 0.000085 = ~85 SGD
    const target = { code: "SGD", rate: 0.000085 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/S\$|SGD/);
    expect(result).toMatch(/\d,\d{2}$/);
  });

  it("with target: EUR conversion with 2 decimals", () => {
    // EUR rate is approximately 0.000058 (IDR to EUR)
    // 1,000,000 IDR * 0.000058 = ~58 EUR
    const target = { code: "EUR", rate: 0.000058 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/€|EUR/);
    expect(result).toMatch(/\d,\d{2}$/);
  });

  // EPIC-021 Group F (#1) — AUD/CNY added to the supported currency list.
  it("with target: AUD conversion with 2 decimals", () => {
    // AUD rate is approximately 0.000097 (IDR to AUD)
    // 1,000,000 IDR * 0.000097 = ~97 AUD
    const target = { code: "AUD", rate: 0.000097 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/A\$|AUD/);
    expect(result).toMatch(/\d,\d{2}$/);
  });

  it("with target: CNY conversion with 2 decimals, distinguishable from JPY", () => {
    // CNY rate is approximately 0.000448 (IDR to CNY)
    // 1,000,000 IDR * 0.000448 = ~448 CNY
    const target = { code: "CNY", rate: 0.000448 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/CN¥|CNY/);
    expect(result).toMatch(/\d,\d{2}$/);
  });

  it("with target: IDR (should still work, 0 decimals)", () => {
    // Passing IDR as target should not break anything
    // (rate = 1 means no conversion, just display as Rp with 0 decimals)
    const target = { code: "IDR", rate: 1 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/Rp/);
    // IDR has 0 decimal places (it's an integer currency)
    expect(result).not.toMatch(/\.\d{2}$/);
  });

  it("with target: zero value formats correctly", () => {
    const target = { code: "USD", rate: 0.000063 };
    const result = formatRupiah(0, target);

    expect(result).toMatch(/\$|USD/);
  });

  it("with target: large value maintains decimal precision", () => {
    // 1 billion IDR * 0.000063 = ~63,000 USD
    const target = { code: "USD", rate: 0.000063 };
    const result = formatRupiah(1000000000, target);

    expect(result).toBe("US$\u00A063.000,00");
  });

  it("IDR never prints decimals", () => {
    expect(formatRupiah(25_850_000)).toBe("Rp\u00A025.850.000");
    expect(formatRupiah(1_234_567.89)).toBe("Rp\u00A01.234.568");
    expect(formatRupiah(5_000_000, { code: "IDR", rate: 1 })).toBe(
      "Rp\u00A05.000.000",
    );
    expect(formatRupiah(25_850_000)).not.toMatch(/,\d/);
  });

  it("puts the sign of a negative IDR before the symbol (ASCII hyphen)", () => {
    expect(formatRupiah(-4_200_000)).toBe("-Rp\u00A04.200.000");
    expect(formatRupiah(-10_700_000)).toBe("-Rp\u00A010.700.000");
    expect(formatRupiah(-4_200_000)).not.toContain("\u2212");
    expect(formatRupiah(-4_200_000, { code: "IDR", rate: 1 })).toBe(
      "-Rp\u00A04.200.000",
    );
  });

  it("never prints a negative zero", () => {
    expect(formatRupiah(-0.4)).toBe("Rp\u00A00");
    expect(formatRupiah(-0)).toBe("Rp\u00A00");
  });

  it("keeps two decimals and a leading sign for negative non-IDR", () => {
    expect(formatRupiah(-1_000_000, { code: "USD", rate: 0.000063 })).toBe(
      "-US$\u00A063,00",
    );
  });
});

describe("formatRupiahCompact", () => {
  it("formats the common magnitudes", () => {
    expect(formatRupiahCompact(25_850_000)).toBe("Rp\u00A025,85 jt");
    expect(formatRupiahCompact(1_256_780_000)).toBe("Rp\u00A01,26 M");
    expect(formatRupiahCompact(45_000)).toBe("Rp\u00A045 rb");
    expect(formatRupiahCompact(750)).toBe("Rp\u00A0750");
    expect(formatRupiahCompact(0)).toBe("Rp\u00A00");
  });

  it("promotes a value whose smaller unit would round to four digits", () => {
    // 999.999.999 / 1e6 is 1000,00 — that belongs in "M", not "jt".
    expect(formatRupiahCompact(999_999_999)).toBe("Rp\u00A01 M");
    // 999.999 / 1e3 is 1000 — that belongs in "jt", not "rb".
    expect(formatRupiahCompact(999_999)).toBe("Rp\u00A01 jt");
    // Just below each boundary the smaller unit still fits.
    expect(formatRupiahCompact(994_999_999)).toBe("Rp\u00A0995 jt");
    expect(formatRupiahCompact(999_499)).toBe("Rp\u00A0999 rb");
  });

  it("keeps the sign and the unit for negatives", () => {
    expect(formatRupiahCompact(-1_256_780_000)).toBe("-Rp\u00A01,26 M");
    expect(formatRupiahCompact(-25_850_000)).toBe("-Rp\u00A025,85 jt");
    expect(formatRupiahCompact(-45_000)).toBe("-Rp\u00A045 rb");
    expect(formatRupiahCompact(-750)).toBe("-Rp\u00A0750");
  });
});

describe("formatAxisCompact", () => {
  it("drops the currency and uses Indonesian units", () => {
    expect(formatAxisCompact(25_000_000)).toBe("25 jt");
    expect(formatAxisCompact(1_500_000_000)).toBe("1,5 M");
    expect(formatAxisCompact(45_000)).toBe("45 rb");
    expect(formatAxisCompact(0)).toBe("0");
  });

  it("signs a negative tick with an ASCII hyphen", () => {
    expect(formatAxisCompact(-2_500_000)).toBe("-2,5 jt");
  });
});

describe("formatAxisMoney", () => {
  it("prefixes the display-currency symbol to the compact tick", () => {
    expect(formatAxisMoney(2_359.56, "EUR")).toBe("€\u00A02,4 rb");
    expect(formatAxisMoney(25_000_000, "IDR")).toBe("Rp\u00A025 jt");
    expect(formatAxisMoney(549, "EUR")).toBe("€\u00A0549");
  });

  it("keeps zero bare and signs a negative before the symbol", () => {
    expect(formatAxisMoney(0, "EUR")).toBe("0");
    expect(formatAxisMoney(-261.43, "EUR")).toBe("-€\u00A0261");
  });
});

describe("localizeMoneyText", () => {
  const eur = (idr: number) => `≈ €${idr / 20_000}`;
  it("rewrites every embedded IDR amount through the display formatter", () => {
    expect(
      localizeMoneyText(
        "Tagihan Rp 60.000.000 jatuh tempo, minimal Rp 2.000.000.",
        eur,
      ),
    ).toBe("Tagihan ≈ €3000 jatuh tempo, minimal ≈ €100.");
  });
  it("handles a no-break space and a legacy ungrouped amount", () => {
    expect(localizeMoneyText("Saldo Rp\u00A04.200.000", eur)).toBe(
      "Saldo ≈ €210",
    );
    expect(localizeMoneyText("Bayar Rp5000000", eur)).toBe("Bayar ≈ €250");
  });
  it("leaves text without amounts untouched", () => {
    expect(localizeMoneyText("Target tercapai", eur)).toBe("Target tercapai");
  });
});

describe("withSign", () => {
  it("puts the sign after the approximation mark", () => {
    expect(withSign("≈ €\u00A045,22", "-")).toBe("≈ -€\u00A045,22");
    expect(withSign("≈ €\u00A045,22", "+")).toBe("≈ +€\u00A045,22");
  });
  it("prefixes an exact amount and ignores an empty sign", () => {
    expect(withSign("Rp\u00A05.000", "-")).toBe("-Rp\u00A05.000");
    expect(withSign("Rp\u00A05.000", "")).toBe("Rp\u00A05.000");
  });
});

describe("formatPercent", () => {
  it("uses a decimal comma and at most two decimals", () => {
    expect(formatPercent(6.333)).toBe("6,33%");
    expect(formatPercent(12)).toBe("12%");
    expect(formatPercent(2.5)).toBe("2,5%");
  });

  it("adds an explicit + only to positive deltas when signed", () => {
    expect(formatPercent(6.33, { signed: true })).toBe("+6,33%");
    expect(formatPercent(-1.5, { signed: true })).toBe("-1,5%");
    expect(formatPercent(6.33)).toBe("6,33%");
  });

  it("never renders a signed or dotted zero", () => {
    expect(formatPercent(0, { signed: true })).toBe("0%");
    expect(formatPercent(-0.001, { signed: true })).toBe("0%");
  });
});

describe("displayNotificationText", () => {
  it("decodes leftover HTML entities for display", () => {
    expect(displayNotificationText("Tabungan &amp; Investasi")).toBe(
      "Tabungan & Investasi",
    );
    expect(displayNotificationText("&lt;b&gt; &quot;x&quot; &#39;y&#39;")).toBe(
      "<b> \"x\" 'y'",
    );
  });

  it("re-formats legacy ungrouped amounts but leaves canonical ones", () => {
    expect(
      displayNotificationText("bertambah Rp5000000 dari auto-debit."),
    ).toBe("bertambah Rp\u00A05.000.000 dari auto-debit.");
    expect(displayNotificationText("Rp\u00A02000000 untuk Kas.")).toBe(
      "Rp\u00A02.000.000 untuk Kas.",
    );
    expect(displayNotificationText("Rp\u00A04.200.000 jatuh tempo")).toBe(
      "Rp\u00A04.200.000 jatuh tempo",
    );
    expect(displayNotificationText("Rp\u00A0500 · Makan")).toBe(
      "Rp\u00A0500 · Makan",
    );
  });
});
