import { StatementReaderParseError } from "./statement-reader-parse.error";
import {
  STATEMENT_SYSTEM_PROMPT,
  parseStatementResponseText,
} from "./statement-reader-prompt.util";

/**
 * EPIC-029 E1 — the single most important assertion in this group:
 *
 *   **a model that returns a NUMBER for an amount is rejected.**
 *
 * The schema is what stops a model's own arithmetic from becoming a
 * `BankSyncEntry` without passing `parseStatementAmount`. A schema that
 * quietly coerced `37000` into `"37000"` would look identical in every other
 * test and would have thrown the guarantee away.
 */

const VALID = {
  rows: [
    { date: "2026-07-01", description: "Pembayaran QR", amount: "-37.000,00" },
  ],
  totals: {
    openingBalance: "1.517.061,00",
    closingBalance: "1.297.613,00",
    totalCredit: null,
    totalDebit: null,
  },
};

describe("parseStatementResponseText", () => {
  it("accepts the contract the prompt asks for", () => {
    const parsed = parseStatementResponseText(JSON.stringify(VALID));
    expect(parsed.rows[0]!.amount).toBe("-37.000,00");
    expect(parsed.totals.openingBalance).toBe("1.517.061,00");
  });

  it("REJECTS a numeric amount rather than coercing it to a string", () => {
    const numeric = {
      ...VALID,
      rows: [{ date: "2026-07-01", description: "x", amount: -37000 }],
    };
    expect(() => parseStatementResponseText(JSON.stringify(numeric))).toThrow(
      StatementReaderParseError,
    );
  });

  it("REJECTS a numeric total for the same reason", () => {
    // The totals are what the rows are CHECKED against. A model allowed to
    // hand back a typed number here could satisfy its own cross-check.
    const numeric = {
      ...VALID,
      totals: { ...VALID.totals, closingBalance: 1297613 },
    };
    expect(() => parseStatementResponseText(JSON.stringify(numeric))).toThrow(
      StatementReaderParseError,
    );
  });

  it("names the offending field without echoing the model's output", () => {
    const numeric = {
      ...VALID,
      rows: [{ date: "2026-07-01", description: "SECRET NASABAH", amount: 1 }],
    };
    try {
      parseStatementResponseText(JSON.stringify(numeric));
      throw new Error("expected a parse error");
    } catch (err) {
      expect(err).toBeInstanceOf(StatementReaderParseError);
      expect((err as Error).message).toContain("rows.0.amount");
      // The model's answer is echoed to the client; the statement's own text
      // must not ride along inside an error message.
      expect((err as Error).message).not.toContain("SECRET NASABAH");
    }
  });

  it("unwraps JSON from a markdown fence and from surrounding prose", () => {
    const fenced = "Here you go:\n```json\n" + JSON.stringify(VALID) + "\n```";
    expect(parseStatementResponseText(fenced).rows).toHaveLength(1);
  });

  it("raises its own error for prose with no JSON at all", () => {
    expect(() => parseStatementResponseText("I cannot read this.")).toThrow(
      StatementReaderParseError,
    );
  });

  it("raises its own error for truncated JSON", () => {
    expect(() => parseStatementResponseText('{"rows": [')).toThrow(
      StatementReaderParseError,
    );
  });

  it("requires every totals field to be present, even as null", () => {
    // An omitted field and a null field are different claims: "the statement
    // does not print this" versus "the model forgot to answer".
    const missing = { rows: VALID.rows, totals: { openingBalance: null } };
    expect(() => parseStatementResponseText(JSON.stringify(missing))).toThrow(
      StatementReaderParseError,
    );
  });

  it("accepts a statement with no transactions, leaving the policy to the caller", () => {
    const empty = { rows: [], totals: VALID.totals };
    expect(parseStatementResponseText(JSON.stringify(empty)).rows).toEqual([]);
  });
});

describe("STATEMENT_SYSTEM_PROMPT", () => {
  it("tells the model, in the prompt itself, never to do arithmetic", () => {
    // The schema is the enforcement; the prompt is what makes compliance the
    // likely outcome rather than a coin flip. Both are load-bearing.
    expect(STATEMENT_SYSTEM_PROMPT).toContain("Do NOT do arithmetic");
    expect(STATEMENT_SYSTEM_PROMPT).toContain("Never compute a total");
  });

  it("carries no bank name, so there is no per-bank code path to rot", () => {
    // E4 — per-bank normalisation belongs to the column-mapping template
    // system, not to a prompt that quietly drifts from it.
    for (const bank of ["BCA", "Mandiri", "BNI", "BRI"]) {
      expect(STATEMENT_SYSTEM_PROMPT).not.toContain(bank);
    }
  });
});
