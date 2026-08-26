/**
 * EPIC-029 group 1 — client-side PDF text extraction.
 *
 * Two different things need testing here, and only one of them can be tested
 * in jsdom:
 *
 *  1. **The table reconstruction and the failure taxonomy.** Pure, and fully
 *     covered below. `linesFromTextItems` is where a statement's rows and
 *     columns are either preserved or destroyed, and every failure reason is
 *     asserted to produce its own distinct message — collapsing "this is a
 *     scan" into "this file is broken" sends the user to fix the wrong thing.
 *
 *  2. **pdfjs itself.** NOT covered here and deliberately not faked into
 *     looking covered: `pdfjs-dist` needs a Worker, `DOMMatrix` and a real
 *     browser, none of which jsdom has. The loader is a thin seam, injected
 *     below, and the real one was verified by hand against two genuine
 *     Indonesian bank e-statements (a 1-page BCA that opens with an EMPTY
 *     password, and a 5-page password-protected Mandiri). See the epic's
 *     Automation Log for those numbers.
 */

import { id as dictionary } from "../i18n/id";
import { en as enDictionary } from "../i18n/en";

import {
  PDF_MAX_PAGES,
  StatementPdfError,
  extractStatementPdfText,
  linesFromTextItems,
  statementPdfErrorMessage,
  type PdfDocumentLike,
  type PdfDocumentLoader,
  type StatementPdfFailure,
} from "./statement-pdf";

/* ─────────────────────────── helpers ─────────────────────────── */

/** A pdfjs text item: `transform[4]` is x, `transform[5]` the baseline y. */
function item(
  text: string,
  x: number,
  y: number,
  width = text.length * 5,
  size = 10,
) {
  return { str: text, transform: [size, 0, 0, size, x, y], width };
}

function fakeFile(byteLength = 1024): File {
  const bytes = new Uint8Array(byteLength);
  return {
    name: "statement.pdf",
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as unknown as File;
}

/** A document whose pages return the given text items. */
function docWith(pages: unknown[][]): PdfDocumentLike {
  return {
    numPages: pages.length,
    getPage: async (n: number) => ({
      getTextContent: async () => ({ items: pages[n - 1] ?? [] }),
    }),
  };
}

/** Enough characters that `PDF_MIN_TEXT_CHARS` is comfortably cleared. */
const FILLER = Array.from({ length: 30 }, (_, i) =>
  item(`baris-transaksi-${i}`, 10, 700 - i * 12),
);

/* ─────────────────── line + column reconstruction ─────────────────── */

describe("linesFromTextItems", () => {
  it("rebuilds visual rows from content-stream order, top line first", () => {
    // Deliberately shuffled: pdfjs hands runs back in content-stream order,
    // which for a table is neither row order nor column order.
    const lines = linesFromTextItems([
      item("bawah", 10, 100),
      item("atas", 10, 200),
      item("tengah", 10, 150),
    ]);
    expect(lines).toEqual(["atas", "tengah", "bawah"]);
  });

  it("groups runs whose baselines differ by less than a line onto one line", () => {
    // Sub-pixel baseline jitter within a single rendered line is normal.
    const lines = linesFromTextItems([
      item("01 Jul 2026", 10, 500),
      item("Pembayaran", 12, 501.4),
    ]);
    expect(lines).toHaveLength(1);
  });

  it("separates two runs of the same sentence with an ordinary space", () => {
    const lines = linesFromTextItems([
      item("Pembayaran", 10, 500, 40),
      item("QR", 53, 500, 10),
    ]);
    expect(lines).toEqual(["Pembayaran QR"]);
  });

  it("scales both thresholds to the run's font size, not absolute units", () => {
    // The same 3-unit gap is a word space at 10pt and a column break at 2pt.
    expect(
      linesFromTextItems([item("a", 0, 0, 5, 10), item("b", 8, 0, 5, 10)]),
    ).toEqual(["a b"]);
    expect(
      linesFromTextItems([item("a", 0, 0, 5, 2), item("b", 8, 0, 5, 2)]),
    ).toEqual(["a | b"]);
  });

  it("separates columns with ' | ' when the horizontal gap is wide", () => {
    const lines = linesFromTextItems([
      item("01 Jul 2026", 10, 500, 40),
      item("Pembayaran QR", 200, 500, 50),
      item("-37.000,00", 400, 500, 30),
    ]);
    expect(lines).toEqual(["01 Jul 2026 | Pembayaran QR | -37.000,00"]);
  });

  it("keeps adjacent runs of one word together, without a column break", () => {
    // Fonts split a single word across runs constantly; a column separator
    // inside a word would corrupt an amount into two unparseable halves.
    const lines = linesFromTextItems([
      item("-37.0", 10, 500, 20),
      item("00,00", 30, 500, 20),
    ]);
    expect(lines).toEqual(["-37.000,00"]);
  });

  it("ignores runs with no text, no transform, or a non-finite position", () => {
    const lines = linesFromTextItems([
      { str: "", transform: [1, 0, 0, 1, 10, 500] },
      { str: "no transform" },
      { str: "nan", transform: [1, 0, 0, 1, Number.NaN, 500] },
      item("real", 10, 500),
      null,
      "not an item",
    ]);
    expect(lines).toEqual(["real"]);
  });

  it("returns no lines for a page with no text items at all", () => {
    expect(linesFromTextItems([])).toEqual([]);
  });
});

/* ─────────────────── password handling (E11) ─────────────────── */

describe("extractStatementPdfText — passwords", () => {
  it("tries the EMPTY password first and never prompts when it opens", async () => {
    // The real BCA statement is exactly this shape: an owner/permissions
    // lock only, which opens with no user password at all.
    const seen: string[] = [];
    const load: PdfDocumentLoader = async (_bytes, password) => {
      seen.push(password);
      return docWith([FILLER]);
    };

    await extractStatementPdfText(fakeFile(), undefined, {
      loadDocument: load,
    });

    expect(seen).toEqual([""]);
  });

  it("reports password-required, not corrupt-file, when one is genuinely needed", async () => {
    const load: PdfDocumentLoader = async () => {
      throw new StatementPdfError("pdf-password-required");
    };
    await expect(
      extractStatementPdfText(fakeFile(), undefined, { loadDocument: load }),
    ).rejects.toMatchObject({ reason: "pdf-password-required" });
  });

  it("passes a supplied password through unchanged", async () => {
    const seen: string[] = [];
    const load: PdfDocumentLoader = async (_bytes, password) => {
      seen.push(password);
      return docWith([FILLER]);
    };
    await extractStatementPdfText(fakeFile(), "s3cret", {
      loadDocument: load,
    });
    expect(seen).toEqual(["s3cret"]);
  });

  it("hands each attempt its own buffer, so a retry is not reading a detached one", async () => {
    // pdfjs takes ownership of (and detaches) the array it is given. Without
    // a per-attempt copy the retry after a wrong password would read zero
    // bytes and report a corrupt file.
    const lengths: number[] = [];
    const load: PdfDocumentLoader = async (bytes) => {
      lengths.push(bytes.byteLength);
      return docWith([FILLER]);
    };
    const file = fakeFile(2048);
    await extractStatementPdfText(file, undefined, { loadDocument: load });
    await extractStatementPdfText(file, "again", { loadDocument: load });
    expect(lengths).toEqual([2048, 2048]);
  });
});

/* ─────────────────── caps + honesty (E1c / E6) ─────────────────── */

describe("extractStatementPdfText — bounds and refusals", () => {
  it("refuses a document above the page cap BEFORE reading any page", async () => {
    let pagesRead = 0;
    const doc: PdfDocumentLike = {
      numPages: PDF_MAX_PAGES + 1,
      getPage: async () => {
        pagesRead++;
        return { getTextContent: async () => ({ items: FILLER }) };
      },
    };
    await expect(
      extractStatementPdfText(fakeFile(), undefined, {
        loadDocument: async () => doc,
      }),
    ).rejects.toMatchObject({ reason: "pdf-too-many-pages" });
    // The point of a cap is not spending; assert nothing was read.
    expect(pagesRead).toBe(0);
  });

  it("refuses text above the character cap", async () => {
    const huge = [item("x".repeat(5000), 10, 500)];
    await expect(
      extractStatementPdfText(fakeFile(), undefined, {
        loadDocument: async () => docWith([huge, huge]),
        maxTextChars: 6000,
      }),
    ).rejects.toMatchObject({ reason: "pdf-text-too-large" });
  });

  it("calls a scanned statement a scan, not a corrupt file", async () => {
    // E1c — the failure this refusal exists for is NOT a crash. It is a paid
    // model being handed an empty prompt and answering with a confident,
    // entirely invented table of money rows.
    await expect(
      extractStatementPdfText(fakeFile(), undefined, {
        loadDocument: async () => docWith([[], []]),
      }),
    ).rejects.toMatchObject({ reason: "pdf-no-text-layer" });
  });

  it("treats a page carrying only a stray logo stamp as having no text layer", async () => {
    await expect(
      extractStatementPdfText(fakeFile(), undefined, {
        loadDocument: async () => docWith([[item("BANK", 10, 700)]]),
      }),
    ).rejects.toMatchObject({ reason: "pdf-no-text-layer" });
  });

  it("refuses a document reporting a nonsense page count", async () => {
    await expect(
      extractStatementPdfText(fakeFile(), undefined, {
        loadDocument: async () => ({
          numPages: 0,
          getPage: async () => ({
            getTextContent: async () => ({ items: [] }),
          }),
        }),
      }),
    ).rejects.toMatchObject({ reason: "pdf-corrupt" });
  });

  it("returns one entry per page, in page order, and always destroys the document", async () => {
    let destroyed = false;
    const base = docWith([
      [item("halaman satu baris", 10, 700), ...FILLER],
      [item("halaman dua baris", 10, 700)],
    ]);
    const result = await extractStatementPdfText(fakeFile(), undefined, {
      loadDocument: async () => ({
        ...base,
        destroy: () => {
          destroyed = true;
        },
      }),
    });
    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toContain("halaman satu baris");
    expect(result.pages[1]).toBe("halaman dua baris");
    expect(destroyed).toBe(true);
  });

  it("destroys the document even when a page read throws", async () => {
    let destroyed = false;
    await expect(
      extractStatementPdfText(fakeFile(), undefined, {
        loadDocument: async () => ({
          numPages: 1,
          getPage: async () => {
            throw new Error("boom");
          },
          destroy: () => {
            destroyed = true;
          },
        }),
      }),
    ).rejects.toThrow();
    expect(destroyed).toBe(true);
  });
});

/* ─────────────────── the message taxonomy ─────────────────── */

describe("statementPdfErrorMessage", () => {
  /**
   * The compile-time `never` check in `statementPdfErrorMessage` proves every
   * reason is HANDLED; it cannot prove each one says something different.
   * This list closes that gap — it is a type error the moment a reason is
   * added, and a test failure the moment two reasons share a message.
   */
  const ALL_REASONS = Object.keys({
    "pdf-password-required": true,
    "pdf-wrong-password": true,
    "pdf-too-many-pages": true,
    "pdf-text-too-large": true,
    "pdf-no-text-layer": true,
    "pdf-corrupt": true,
  } satisfies Record<StatementPdfFailure, true>) as StatementPdfFailure[];

  it("gives every reason its own distinct, non-empty message in both locales", () => {
    for (const dict of [dictionary, enDictionary]) {
      const messages = ALL_REASONS.map((reason) =>
        statementPdfErrorMessage(new StatementPdfError(reason), dict),
      );
      messages.forEach((m) => expect(m.length).toBeGreaterThan(0));
      expect(new Set(messages).size).toBe(ALL_REASONS.length);
    }
  });

  it("never reports a wrong password as a corrupt file", () => {
    // A user told their perfectly good statement is "damaged" re-downloads it
    // forever instead of retyping the one thing that would work.
    const wrong = statementPdfErrorMessage(
      new StatementPdfError("pdf-wrong-password"),
      dictionary,
    );
    expect(wrong).toBe(dictionary.rekonsiliasi.pdfErrorWrongPassword);
    expect(wrong).not.toBe(dictionary.rekonsiliasi.pdfErrorCorrupt);
  });

  it("falls back to corrupt-file for an error from outside this module", () => {
    expect(
      statementPdfErrorMessage(new Error("something else"), dictionary),
    ).toBe(dictionary.rekonsiliasi.pdfErrorCorrupt);
  });

  it("never puts anything password-shaped into a thrown message", () => {
    // E10 — the reason is the whole message, by construction.
    const err = new StatementPdfError("pdf-wrong-password");
    expect(err.message).toBe("statement pdf rejected: pdf-wrong-password");
  });
});
