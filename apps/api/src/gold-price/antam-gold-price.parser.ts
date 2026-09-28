// B9 (client revision round 2, polish-j) — pure HTML parser for
// emasantam.id's "harga-emas-antam-harian" page. logammulia.com (the
// "harga dasar non-PPh" figure the brief originally asked for) is behind
// Cloudflare and returns 403 to every server request, from both the dev
// host and the staging host (verified 2026-09-28) — see the B9
// source-update note. emasantam.id lists Antam's own SELLING prices per
// bar size instead; there is no non-PPh adjustment to apply, and this
// module does not invent one.
//
// The page's `#goldpricetable` table has one row per bar size ("Gramasi"),
// e.g. `<td class="ar">1000</td>` followed by `<td class="ar">Rp
// 2.537.600.000</td>` — the 1000-gram (1 kg) bar's price, which IS the
// per-kg price directly (no further ×1000 needed). Parsing is regex-based
// on the normalized text rather than a full DOM parser (no new HTML-parser
// dependency for one page), and is defensive: any unexpected shape returns
// `null` rather than throwing, so a page redesign degrades to "no live
// price" (falls back to the last cached value) instead of a 500.

/** Matches the "1000" Gramasi row, capturing the very next Rupiah cell — the
 * 1 kg bar's price, tolerant of the page's inconsistent inter-tag whitespace. */
const KG_ROW_RE =
  /<td[^>]*>\s*1000\s*<\/td>\s*<td[^>]*>\s*Rp\.?\s*([\d.,]+)\s*<\/td>/i;

/**
 * Parses the emasantam.id "harga-emas-antam-harian" page HTML and returns
 * the Antam 1 kg bar price in IDR (integer, no decimals — the page never
 * shows fractional Rupiah), or `null` if the expected row cannot be found
 * (page redesign, empty response, etc.) — never throws.
 */
export function parseAntamGoldPricePerKg(html: string): bigint | null {
  const match = KG_ROW_RE.exec(html);
  if (!match?.[1]) return null;
  // "2.537.600.000" -> "2537600000" — id-ID thousands separators only,
  // never a decimal point (Rupiah has no sub-unit on this page).
  const digits = match[1].replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits) || digits.length === 0) return null;
  try {
    const value = BigInt(digits);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}
