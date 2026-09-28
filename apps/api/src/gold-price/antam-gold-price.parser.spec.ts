import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAntamGoldPricePerKg } from "./antam-gold-price.parser";

const FIXTURE_PATH = join(
  __dirname,
  "__fixtures__",
  "emasantam-harga-emas.html",
);

describe("parseAntamGoldPricePerKg", () => {
  it("parses the 1000-gram (1 kg) row from a real trimmed emasantam.id fixture", () => {
    const html = readFileSync(FIXTURE_PATH, "utf-8");
    expect(parseAntamGoldPricePerKg(html)).toBe(2_537_600_000n);
  });

  it("does not confuse the 500g or 1g rows with the 1000g (1 kg) row", () => {
    const html = readFileSync(FIXTURE_PATH, "utf-8");
    const value = parseAntamGoldPricePerKg(html);
    expect(value).not.toBe(1_268_820_000n); // the 500g row
    expect(value).not.toBe(2_597_000n); // the 1g row
  });

  it("tolerates a dot-thousands price with no whitespace quirks", () => {
    const html = `<td class="ar">1000</td><td class="ar">Rp 1.000.000</td>`;
    expect(parseAntamGoldPricePerKg(html)).toBe(1_000_000n);
  });

  it("returns null when the 1000-gram row is missing entirely (page redesign)", () => {
    expect(
      parseAntamGoldPricePerKg("<html><body>no table here</body></html>"),
    ).toBeNull();
  });

  it("returns null on an empty response instead of throwing", () => {
    expect(parseAntamGoldPricePerKg("")).toBeNull();
  });

  it("returns null when the captured cell has no digits", () => {
    const html = `<td class="ar">1000</td><td class="ar">Rp N/A</td>`;
    expect(parseAntamGoldPricePerKg(html)).toBeNull();
  });

  it("returns null for a zero price rather than treating it as valid", () => {
    const html = `<td class="ar">1000</td><td class="ar">Rp 0</td>`;
    expect(parseAntamGoldPricePerKg(html)).toBeNull();
  });
});
