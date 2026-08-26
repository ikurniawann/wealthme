/**
 * EPIC-023 G2 (D17) — regression coverage for the two data-corruption bugs
 * named in the task: the naive `split(",")` CSV parser breaking on a
 * quoted description containing a comma, and the ×100 multiplication that
 * desynced imported amounts from the app's whole-rupiah storage. Both
 * tests fail against the pre-fix client-side parser (which this file
 * replaces) — see rekonsiliasi/page.tsx's former `uploadMutation`.
 *
 * EPIC-023 Task G retry — additional coverage for the CRITICAL findings the
 * first attempt reintroduced/missed: a decimal "," or "." reintroducing the
 * ×100 bug, CR/DR sign markers being discarded, and ambiguous/garbage dates
 * being silently accepted instead of refused.
 */
import ExcelJS from "exceljs";

import {
  detectMapping,
  ExcelLimitExceededError,
  findColumnIndex,
  inferDateFormatFromValues,
  mapTableToRows,
  MAX_XLSX_CELLS,
  MAX_XLSX_ROWS,
  parseCsv,
  parseCsvLine,
  parseExcelBuffer,
  parseStatementAmount,
  parseStatementDate,
} from "./reconciliation-parsers";

describe("parseCsvLine / parseCsv — quoted fields containing commas", () => {
  it("keeps a quoted description with an embedded comma as one field", () => {
    const line = '2026-08-01,"Belanja, Toko A",150000';
    const fields = parseCsvLine(line);
    expect(fields).toEqual(["2026-08-01", "Belanja, Toko A", "150000"]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    const line = '2026-08-01,"Restoran ""Enak Sekali""",75000';
    const fields = parseCsvLine(line);
    expect(fields[1]).toBe('Restoran "Enak Sekali"');
  });

  it("parses a full CSV with a header and a quoted-comma row", () => {
    const text =
      "tanggal,keterangan,jumlah\n" +
      '2026-08-01,"Belanja, Toko A",150000\n' +
      "2026-08-02,Transfer Masuk,500000\n";
    const table = parseCsv(text);
    expect(table).toHaveLength(3);
    expect(table[1]).toEqual(["2026-08-01", "Belanja, Toko A", "150000"]);
  });
});

describe("parseStatementAmount — no ×100 multiplication (whole rupiah, exact)", () => {
  // EPIC-029 — the shapes a real Mandiri e-statement actually prints. Before
  // these were accepted, every INCOMING row on that statement ("+4.350.000,00")
  // was skipped as unparseable, and its "Dana Masuk : + 15.630.000,00" summary
  // could not be read either — so the totals gate had nothing to check.
  it("accepts an explicit leading plus as positive", () => {
    expect(parseStatementAmount("+4.350.000,00")).toBe(4_350_000n);
  });

  it("accepts a space between the sign and the digits, on both signs", () => {
    expect(parseStatementAmount("+ 15.630.000,00")).toBe(15_630_000n);
    expect(parseStatementAmount("- 15.849.448,00")).toBe(-15_849_448n);
  });

  it("still refuses a bare sign with no digits", () => {
    expect(() => parseStatementAmount("+")).toThrow();
    expect(() => parseStatementAmount("+ ")).toThrow();
  });

  it("still refuses a doubled sign", () => {
    expect(() => parseStatementAmount("++1000")).toThrow();
    expect(() => parseStatementAmount("+-1000")).toThrow();
  });

  it("parses a plain whole-rupiah amount unchanged", () => {
    expect(parseStatementAmount("150000")).toBe(150_000n);
  });

  it("strips thousand-separator dots without scaling the value", () => {
    // This is the exact regression: the old web parser did
    // `Math.round(parseFloat(amount) * 100)`, turning "150.000" (already
    // whole rupiah) into 15_000_000 — a 100x inflation. The fixed parser
    // must read the file's amount back unchanged.
    expect(parseStatementAmount("150.000")).toBe(150_000n);
  });

  it("treats a leading minus as negative", () => {
    expect(parseStatementAmount("-250.000")).toBe(-250_000n);
  });

  it("treats parenthesised amounts as negative", () => {
    expect(parseStatementAmount("(50.000)")).toBe(-50_000n);
  });

  it("throws on an empty amount", () => {
    expect(() => parseStatementAmount("")).toThrow();
  });

  // ── CRITICAL retry regression — the reintroduced ×100 bug ──
  // The first retry stripped every "." and "," unconditionally, treating
  // BOTH as thousands separators — so a conventional ",00"/".00" cents
  // suffix (standard on both Indonesian and English bank exports) inflated
  // the amount 100x with no error. These are the exact repro values from
  // the finding.
  it("reads Indonesian-style thousands + decimal cents exactly (150.000,00 -> 150000)", () => {
    expect(parseStatementAmount("150.000,00")).toBe(150_000n);
  });

  it("reads English-style thousands + decimal cents exactly (1,500,000.00 -> 1500000)", () => {
    expect(parseStatementAmount("1,500,000.00")).toBe(1_500_000n);
  });

  it("reads a plain unseparated whole amount (1500000 -> 1500000)", () => {
    expect(parseStatementAmount("1500000")).toBe(1_500_000n);
  });

  it("reads multiple thousands separators with no decimal part (1.500.000 -> 1500000)", () => {
    expect(parseStatementAmount("1.500.000")).toBe(1_500_000n);
  });

  it("rounds a half-rupiah decimal cents value half-up (150000,50 -> 150001)", () => {
    expect(parseStatementAmount("150000,50")).toBe(150_001n);
  });

  it("rounds a near-whole decimal cents value half-up (0,99 -> 1)", () => {
    expect(parseStatementAmount("0,99")).toBe(1n);
  });

  // ── CRITICAL retry — CR/DR sign markers ──
  it("treats a trailing DR marker as negative (debit = money out)", () => {
    expect(parseStatementAmount("100000 DR")).toBe(-100_000n);
  });

  it("treats a trailing CR marker as positive (credit = money in)", () => {
    expect(parseStatementAmount("100000 CR")).toBe(100_000n);
  });

  it("matches DR/CR case-insensitively and without a separating space", () => {
    expect(parseStatementAmount("100000dr")).toBe(-100_000n);
    expect(parseStatementAmount("100000cr")).toBe(100_000n);
  });

  it("matches a leading marker too", () => {
    expect(parseStatementAmount("DR 100000")).toBe(-100_000n);
    expect(parseStatementAmount("CR 100000")).toBe(100_000n);
  });

  it("does not double-apply when the number is already signed AND carries a marker", () => {
    // The marker is authoritative — an explicit "-" alongside a marker must
    // not ALSO flip the sign (which would cancel back to positive).
    expect(parseStatementAmount("-100000 DR")).toBe(-100_000n);
  });

  // ── MEDIUM retry — "Rp" prefix regression ──
  it("strips a leading 'Rp' currency symbol before validating (150.000,00 -> 150000)", () => {
    // A prior retry's stricter validation started rejecting this common
    // Indonesian bank-export format outright — a regression against the
    // pre-existing behaviour.
    expect(parseStatementAmount("Rp 150.000,00")).toBe(150_000n);
    expect(parseStatementAmount("Rp150.000")).toBe(150_000n);
  });

  // ── MEDIUM retry — malformed separator runs must be refused, not silently
  //    digit-stripped as if they were harmless grouping ──
  it("refuses a doubled separator instead of silently treating it as 1000", () => {
    expect(() => parseStatementAmount("1,,000")).toThrow();
  });

  it("refuses a trailing separator with nothing after it", () => {
    expect(() => parseStatementAmount("1.000,")).toThrow();
  });
});

describe("parseStatementDate", () => {
  it("parses ISO dates by default", () => {
    const d = parseStatementDate("2026-08-05");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7); // 0-indexed August
    expect(d.getUTCDate()).toBe(5);
  });

  it("parses DD/MM/YYYY per an explicit template dateFormat", () => {
    const d = parseStatementDate("05/08/2026", "DD/MM/YYYY");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(5);
  });

  it("parses MM/DD/YYYY per an explicit template dateFormat", () => {
    const d = parseStatementDate("08/05/2026", "MM/DD/YYYY");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(5);
  });

  it("throws on an unparseable date", () => {
    expect(() => parseStatementDate("not-a-date")).toThrow();
  });

  // ── CRITICAL retry — ambiguous dates must be refused, never guessed ──
  it("refuses an ambiguous DD/MM vs MM/DD date with no explicit format (the transposition bug)", () => {
    // new Date("03/04/2026") silently read this as March 4th (MM/DD) —
    // exactly the bug this fix eliminates. Both parts are ≤12, so neither
    // interpretation can be ruled out without an explicit format.
    expect(() => parseStatementDate("03/04/2026")).toThrow();
  });

  it("resolves an unambiguous date (day part >12) without needing an explicit format", () => {
    const d = parseStatementDate("13/04/2026");
    expect(d.getUTCMonth()).toBe(3); // April
    expect(d.getUTCDate()).toBe(13);
  });

  it("resolves an unambiguous date via the other part being >12 too", () => {
    const d = parseStatementDate("04/13/2026");
    expect(d.getUTCMonth()).toBe(3); // April
    expect(d.getUTCDate()).toBe(13);
  });

  it("refuses a slash date where neither part can be a valid month", () => {
    expect(() => parseStatementDate("13/13/2026")).toThrow();
  });

  // ── CRITICAL retry — Excel serial dates and garbage numerics ──
  it("converts a bare Excel serial number left un-normalised into the real date", () => {
    const d = parseStatementDate("45700");
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(1); // February
    expect(d.getUTCDate()).toBe(12);
  });

  it("refuses a too-small numeric value instead of importing a bizarre year", () => {
    expect(() => parseStatementDate("5")).toThrow();
  });

  it("refuses a too-large numeric value instead of importing a bizarre year", () => {
    expect(() => parseStatementDate("202608")).toThrow();
  });

  // ── MEDIUM retry — a negative bare integer must reach the serial-date
  //    range check, not the native Date() fallback ──
  it("refuses a negative bare integer instead of letting native Date() parse it as a plausible year", () => {
    // `new Date("-1")` parses as a plausible-looking 2000-12-31 under JS's
    // native date-string algorithm — this must be refused via
    // parseExcelSerialDate's range check instead, since the old regex
    // (`/^\d+$/`) excluded the sign and fell through to that native parse.
    expect(() => parseStatementDate("-1")).toThrow();
  });
});

describe("inferDateFormatFromValues", () => {
  it("infers DD/MM/YYYY when some value's first part is unambiguously >12", () => {
    expect(
      inferDateFormatFromValues(["03/04/2026", "25/04/2026", "01/01/2026"]),
    ).toBe("DD/MM/YYYY");
  });

  it("infers MM/DD/YYYY when some value's second part is unambiguously >12", () => {
    expect(
      inferDateFormatFromValues(["04/03/2026", "04/25/2026", "01/01/2026"]),
    ).toBe("MM/DD/YYYY");
  });

  it("returns null when every value is ambiguous on its own", () => {
    expect(inferDateFormatFromValues(["03/04/2026", "01/02/2026"])).toBeNull();
  });

  it("returns null on conflicting evidence rather than guessing", () => {
    expect(
      inferDateFormatFromValues([
        "25/04/2026" /* DD/MM */,
        "04/25/2026" /* MM/DD */,
      ]),
    ).toBeNull();
  });
});

describe("findColumnIndex", () => {
  const header = ["Tanggal", "Keterangan", "Jumlah"];

  it("matches by header name case-insensitively", () => {
    expect(findColumnIndex(header, "jumlah")).toBe(2);
    expect(findColumnIndex(header, "TANGGAL")).toBe(0);
  });

  it("falls back to a numeric index when no header matches", () => {
    expect(findColumnIndex(header, "1")).toBe(1);
  });

  it("returns -1 when nothing matches", () => {
    expect(findColumnIndex(header, "tidak_ada")).toBe(-1);
  });
});

describe("detectMapping", () => {
  it("detects common Indonesian header aliases", () => {
    const mapping = detectMapping(["Tanggal", "Keterangan", "Jumlah"]);
    expect(mapping).toEqual({
      dateColumn: "Tanggal",
      descriptionColumn: "Keterangan",
      amountColumn: "Jumlah",
      dateFormat: null,
    });
  });

  it("returns null when a required column cannot be detected", () => {
    expect(detectMapping(["Kolom A", "Kolom B", "Kolom C"])).toBeNull();
  });
});

describe("mapTableToRows", () => {
  const mapping = {
    dateColumn: "tanggal",
    descriptionColumn: "keterangan",
    amountColumn: "jumlah",
  };

  it("maps every well-formed row and preserves the exact amount", () => {
    const table = [
      ["tanggal", "keterangan", "jumlah"],
      ["2026-08-01", "Belanja, Toko A", "150.000"],
      ["2026-08-02", "Transfer Masuk", "500000"],
    ];

    const { rows, skipped } = mapTableToRows(table, mapping);

    expect(rows).toHaveLength(2);
    expect(skipped).toHaveLength(0);
    expect(rows[0]?.amount).toBe(150_000n);
    expect(rows[0]?.description).toBe("Belanja, Toko A");
    expect(rows[1]?.amount).toBe(500_000n);
  });

  it("skips a row with a missing amount instead of failing the whole import, and reports why", () => {
    const table = [
      ["tanggal", "keterangan", "jumlah"],
      ["2026-08-01", "Baris rusak", ""],
      ["2026-08-02", "Baris valid", "100000"],
    ];

    const { rows, skipped } = mapTableToRows(table, mapping);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("Baris valid");
    // EPIC-023 Task G retry (HIGH finding) — the skip is reported with its
    // line number (2 = first data row, header is line 1) and a reason,
    // never silently dropped.
    expect(skipped).toEqual([
      expect.objectContaining({ line: 2, reason: expect.any(String) }),
    ]);
  });

  it("skips an ambiguous-date row with a reason instead of silently transposing it", () => {
    const table = [
      ["tanggal", "keterangan", "jumlah"],
      ["03/04/2026", "Baris ambigu", "100000"],
    ];

    const { rows, skipped } = mapTableToRows(table, mapping);

    expect(rows).toHaveLength(0);
    expect(skipped).toEqual([expect.objectContaining({ line: 2 })]);
  });

  // EPIC-023 Task G retry (CRITICAL five-reviewer finding) — a prior retry
  // inferred the WHOLE column's day/month order from a single unambiguous
  // row and silently applied that guess to every other ambiguous row. A
  // reviewer proved this is unsafe by execution with exactly the values
  // below: with the old (now-removed) inference, row 1 "03/04/2026" got
  // silently transposed to 2026-04-03 and row 2 "01/05/2026" to 2026-05-01
  // — both WRONG — driven entirely by row 3's unrelated "25/04/2026". The
  // fix refuses every ambiguous row (never guesses) unless an explicit
  // template `dateFormat` is set; only a row that is unambiguous ON ITS OWN
  // (row 3 here, day=25) still resolves without one.
  it("refuses every ambiguous row instead of letting one unambiguous row in the column decide for the rest", () => {
    const table = [
      ["tanggal", "keterangan", "jumlah"],
      ["03/04/2026", "Baris ambigu 1", "100000"],
      ["01/05/2026", "Baris ambigu 2", "200000"],
      ["25/04/2026", "Baris unambigu (hari=25)", "300000"],
    ];

    const { rows, skipped } = mapTableToRows(table, mapping);

    // Only the unambiguous row (line 4, day=25) imports on its own merits;
    // the two ambiguous rows are refused with a reason, never silently
    // imported under a format borrowed from row 4.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.date.getUTCMonth()).toBe(3); // April
    expect(rows[0]?.date.getUTCDate()).toBe(25);
    expect(skipped).toEqual([
      expect.objectContaining({ line: 2 }),
      expect.objectContaining({ line: 3 }),
    ]);
  });

  it("imports every row once an explicit template dateFormat is set, even though the column is otherwise ambiguous", () => {
    const table = [
      ["tanggal", "keterangan", "jumlah"],
      ["03/04/2026", "Baris ambigu 1", "100000"],
      ["01/05/2026", "Baris ambigu 2", "200000"],
    ];

    const { rows, skipped } = mapTableToRows(table, {
      ...mapping,
      dateFormat: "DD/MM/YYYY",
    });

    expect(skipped).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.date.getUTCMonth()).toBe(3); // April 3rd
    expect(rows[0]?.date.getUTCDate()).toBe(3);
    expect(rows[1]?.date.getUTCMonth()).toBe(4); // May 1st
    expect(rows[1]?.date.getUTCDate()).toBe(1);
  });

  it("skips a row whose amount contains a non-zero digit but rounds down to zero whole rupiah", () => {
    const table = [
      ["tanggal", "keterangan", "jumlah"],
      ["2026-08-01", "Baris pecahan", "0,49"],
      ["2026-08-02", "Baris valid", "100000"],
    ];

    const { rows, skipped } = mapTableToRows(table, mapping);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("Baris valid");
    expect(skipped).toEqual([
      expect.objectContaining({ line: 2, reason: expect.any(String) }),
    ]);
  });

  it("throws when the mapping does not match the file's header", () => {
    const table = [
      ["kolom_a", "kolom_b", "kolom_c"],
      ["2026-08-01", "x", "100"],
    ];

    expect(() => mapTableToRows(table, mapping)).toThrow();
  });

  it("throws when a numeric-index mapping resolves two fields to the same column", () => {
    const table = [
      ["Kolom1", "Kolom2", "Kolom3"],
      ["2026-08-01", "x", "100"],
    ];

    expect(() =>
      mapTableToRows(table, {
        dateColumn: "0",
        descriptionColumn: "0",
        amountColumn: "2",
      }),
    ).toThrow();
  });
});

describe("parseExcelBuffer — real .xlsx parsing (D17)", () => {
  async function buildXlsxBuffer(rows: (string | number | Date)[][]) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Mutasi");
    rows.forEach((row) => sheet.addRow(row));
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  it("reads header + data rows from a real workbook, preserving exact amounts", async () => {
    const buffer = await buildXlsxBuffer([
      ["Tanggal", "Keterangan", "Jumlah"],
      ["2026-08-01", "Belanja, Toko A", 150000],
      ["2026-08-02", "Transfer Masuk", 500000],
    ]);

    const table = await parseExcelBuffer(buffer);

    expect(table[0]).toEqual(["Tanggal", "Keterangan", "Jumlah"]);
    expect(table[1]).toEqual(["2026-08-01", "Belanja, Toko A", "150000"]);
    expect(table[2]).toEqual(["2026-08-02", "Transfer Masuk", "500000"]);
  });

  // A real Date cell now arrives as its bare Excel serial, because the reader
  // runs with `styles: "ignore"` — caching styles reopened a memory-exhaustion
  // hole (an 18.6 MiB file with a 3-cell worksheet and a ~2.5M-entry
  // styles.xml drove peak RSS to 696 MiB, past both row and cell caps, which
  // count data rather than styles). That costs nothing: the serial resolves
  // to the identical instant one step later. This test asserts BOTH halves,
  // so the end-to-end contract stays pinned even though the intermediate
  // representation changed.
  it("emits a real Date cell as an Excel serial that resolves to the same date", async () => {
    const buffer = await buildXlsxBuffer([
      ["Tanggal", "Keterangan", "Jumlah"],
      [new Date(Date.UTC(2026, 7, 1)), "Setoran", 250000],
    ]);

    const table = await parseExcelBuffer(buffer);

    // Intermediate form: the bare serial, not a pre-resolved ISO string.
    expect(table[1]?.[0]).toBe("46235");

    // What actually matters — the pipeline resolves it to the same instant
    // the cached-styles path used to produce directly.
    expect(parseStatementDate("46235", null).toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("drops fully-empty rows", async () => {
    const buffer = await buildXlsxBuffer([
      ["Tanggal", "Keterangan", "Jumlah"],
      ["2026-08-01", "Baris 1", 1000],
    ]);
    // Insert a genuinely empty row via the worksheet API directly, since
    // addRow([]) with includeEmpty:false in the reader already filters it.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    sheet?.addRow([]);
    const rebuilt = Buffer.from(await workbook.xlsx.writeBuffer());

    const table = await parseExcelBuffer(rebuilt);

    expect(table.every((row) => row.some((cell) => cell !== ""))).toBe(true);
  });

  it("rejects a buffer that is not a real .xlsx file", async () => {
    await expect(
      parseExcelBuffer(Buffer.from("not an xlsx file")),
    ).rejects.toThrow();
  });

  // EPIC-023 Task G retry (HIGH finding) — zip-bomb bound: a workbook whose
  // in-memory row/cell count exceeds the processing cap is refused with a
  // distinct, clear error rather than silently consumed.
  it("refuses a workbook exceeding the row cap", async () => {
    const header = ["Tanggal", "Keterangan", "Jumlah"];
    const rows: (string | number)[][] = [header];
    for (let i = 0; i <= MAX_XLSX_ROWS; i++) {
      rows.push(["2026-08-01", `Baris ${i}`, 1000]);
    }
    const buffer = await buildXlsxBuffer(rows);

    await expect(parseExcelBuffer(buffer)).rejects.toThrow(
      ExcelLimitExceededError,
    );
    // 90s, not 30s: this builds a real MAX_XLSX_ROWS+1-row workbook and
    // parses it for real — CI's shared runner measured >4x slower than a
    // local dev machine for this CPU-bound work (7.3s local, timed out at
    // 30s on CI). The fixture must stay genuinely oversized (shrinking it
    // would stop proving the guard catches a real breach — see the epic's
    // "Closed finding" postmortem on why a declared-size check was
    // insufficient), so the timeout gets the margin instead.
  }, 90_000);

  it("refuses a workbook exceeding the cell cap", async () => {
    // 100 columns is comfortably under Excel's 16,384-column limit; enough
    // rows to cross MAX_XLSX_CELLS without also tripping MAX_XLSX_ROWS.
    const columnCount = 100;
    const rowCount = Math.ceil(MAX_XLSX_CELLS / columnCount) + 1;
    const header = Array.from({ length: columnCount }, (_, i) => `Col${i}`);
    const rows: (string | number)[][] = [header];
    for (let i = 0; i < rowCount; i++) {
      rows.push(header.map((_, j) => `${i}-${j}`));
    }
    const buffer = await buildXlsxBuffer(rows);

    await expect(parseExcelBuffer(buffer)).rejects.toThrow(
      ExcelLimitExceededError,
    );
    // 90s — see the row-cap test above for why this needs more than 30s.
  }, 90_000);
});
