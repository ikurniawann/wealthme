/**
 * EPIC-029 group 1 — reads a bank-statement PDF's TEXT LAYER in the browser.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why this runs client-side at all (E8 / E9 / E10)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Group 4 decrypts XLSX and ZIP in the tab and uploads the resulting
 * PLAINTEXT bytes, so the unchanged server parser runs. A PDF cannot do
 * that: `pdfjs-dist` decrypts a document for READING only — there is no
 * supported way to emit a decrypted PDF — so if the extraction happened on
 * the server the password would have to travel with the file.
 *
 * Indonesian e-statement passwords are date of birth, card or account
 * numbers, KTP digits: PII, and reused. So the file never leaves the tab
 * either. What travels to the API is the EXTRACTED TEXT, and the password
 * exists only as an argument to `extractStatementPdfText`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * E11 — try nothing before asking for something
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Real bank PDFs are frequently locked with an OWNER password only (a
 * permissions lock: no printing, no copying) and open with NO user password
 * at all. One of the two genuine statements this module was built against is
 * exactly that. So the empty password is always tried FIRST, and the user is
 * prompted only on a real `NEED_PASSWORD`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * E1c / E2 — text layer only, and honest about it
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A scanned statement has no text layer. Handing the model an empty string
 * and asking it for a table is how a confident, entirely invented set of
 * money rows gets produced — the exact failure the original PDF refusal
 * existed to prevent. So "no usable text layer" is DETECTED and refused with
 * its own reason (`pdf-no-text-layer`), never sent upstream.
 *
 * Page→image rendering for a vision fallback is deliberately NOT here; see
 * the epic's Automation Log for the reasoning and what it would take.
 */

import type { I18nDictionary } from "@/i18n/types";

/**
 * E6 — the family pays for the extraction call, and the whole statement text
 * goes into one prompt. 40 pages is far above any monthly personal-account
 * statement (the two real ones are 5 and 1) and well below a page count that
 * would produce a prompt nobody wants to be billed for.
 */
export const PDF_MAX_PAGES = 40;

/**
 * A second, independent bound on the same cost. Page count alone does not
 * bound the prompt: one page of a dense corporate statement can carry more
 * text than ten of a personal one.
 */
export const PDF_MAX_TEXT_CHARS = 200_000;

/**
 * Below this many non-whitespace characters across the whole document there
 * is nothing to read. A scanned statement typically yields 0; a few stray
 * characters from an embedded logo or a footer stamp is still nothing.
 */
export const PDF_MIN_TEXT_CHARS = 200;

/**
 * The two gap thresholds, both expressed as a MULTIPLE OF THE RUN'S FONT
 * SIZE rather than in absolute PDF units.
 *
 * This is not a refinement, it is a correctness requirement. PDF generators
 * routinely split one word — including one amount — across several runs at
 * effectively zero gap. A fixed absolute threshold that inserted a space
 * between any two runs turned `-37.000,00` into `-37.0 00,00`, which
 * `parseStatementAmount` cannot read: the row would be silently skipped, or
 * worse, read as a different number. Scaling by font size also means a 6pt
 * footnote and a 14pt heading get the same treatment rather than the small
 * one being collapsed into a single word.
 *
 *  - below `GLYPH_GAP_RATIO`  → the runs are contiguous; join with nothing.
 *  - above `COLUMN_GAP_RATIO` → a table column boundary; join with ` | `.
 *  - between the two          → an ordinary word space.
 *
 * The column separator matters more than it looks: a statement's value is
 * its table, and the text layer arrives as an unordered bag of positioned
 * runs. Rebuilding rows and columns here — deterministically, from
 * coordinates — is what lets the model transcribe a faithful table instead
 * of guessing at one from a wall of words.
 */
const GLYPH_GAP_RATIO = 0.08;
const COLUMN_GAP_RATIO = 1.2;
/** Used when a run carries no usable scale in its transform. */
const FALLBACK_FONT_SIZE = 10;

/** Two runs whose baselines are within this many units are the same line. */
const LINE_TOLERANCE_UNITS = 2.5;

export type StatementPdfFailure =
  /** Encrypted with a real user password, and none has been given yet. */
  | "pdf-password-required"
  /** A password was given and it does not open the document. Retryable. */
  | "pdf-wrong-password"
  /** Above `PDF_MAX_PAGES`. Refused before any text is read. */
  | "pdf-too-many-pages"
  /** Above `PDF_MAX_TEXT_CHARS` once read. */
  | "pdf-text-too-large"
  /** A scan: no text layer to extract. Explicitly NOT `pdf-corrupt`. */
  | "pdf-no-text-layer"
  /** Structurally unreadable. Explicitly NOT the answer for a bad password. */
  | "pdf-corrupt";

export class StatementPdfError extends Error {
  constructor(readonly reason: StatementPdfFailure) {
    // Reason only — a password must never be reachable from a stack trace,
    // a console, a toast or an error-reporting SDK (E10).
    super(`statement pdf rejected: ${reason}`);
    this.name = "StatementPdfError";
  }
}

export type StatementPdfText = {
  pageCount: number;
  /** One entry per page, in document order, lines already reconstructed. */
  pages: string[];
};

/* ─────────────────── the seam ───────────────────
   pdfjs cannot run in jsdom (no worker, no canvas), and the real loader is
   dynamically imported anyway. Everything below the loader is pure and
   tested directly; the loader itself is replaced wholesale in tests, the
   same posture as `statement-file.ts`'s decryptor seams. */

export type PdfTextItemLike = {
  str?: string;
  /** `[a, b, c, d, e, f]` — `e` is x, `f` is the baseline y. */
  transform?: readonly number[];
  width?: number;
};

export type PdfPageLike = {
  getTextContent(): Promise<{ items: readonly unknown[] }>;
};

export type PdfDocumentLike = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  destroy?(): Promise<void> | void;
};

/**
 * Opens a document. MUST throw a `StatementPdfError` with
 * `pdf-password-required` / `pdf-wrong-password` / `pdf-corrupt` — never a
 * pdfjs exception, whose message we do not control.
 */
export type PdfDocumentLoader = (
  bytes: Uint8Array,
  password: string,
) => Promise<PdfDocumentLike>;

export type StatementPdfSeams = {
  loadDocument?: PdfDocumentLoader;
  maxPages?: number;
  maxTextChars?: number;
};

/* ─────────────────── pure text reconstruction ─────────────────── */

type PositionedRun = {
  x: number;
  y: number;
  width: number;
  /** `|transform[3]|` — the run's vertical scale, i.e. its rendered size. */
  size: number;
  text: string;
};

function toRun(item: unknown): PositionedRun | null {
  const candidate = item as PdfTextItemLike | null;
  const text = typeof candidate?.str === "string" ? candidate.str : "";
  if (!text) return null;
  const transform = candidate?.transform;
  if (!Array.isArray(transform) || transform.length < 6) return null;
  const x = transform[4];
  const y = transform[5];
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const width =
    typeof candidate?.width === "number" && Number.isFinite(candidate.width)
      ? candidate.width
      : 0;
  const scale = transform[3];
  const size =
    typeof scale === "number" && Number.isFinite(scale) && Math.abs(scale) > 0
      ? Math.abs(scale)
      : FALLBACK_FONT_SIZE;
  return { x, y, width, size, text };
}

/**
 * Rebuilds a page's visual lines and columns from positioned text runs.
 *
 * pdfjs hands back runs in content-stream order, which for a table is
 * neither row order nor column order. Grouping by baseline and sorting by x
 * recovers the rows; a wide horizontal gap between two runs on the same row
 * is a column boundary and becomes ` | `.
 *
 * Exported (and pure) because this — not the pdfjs call — is where a
 * statement's table is either preserved or destroyed, so it is the part that
 * needs tests.
 */
export function linesFromTextItems(items: readonly unknown[]): string[] {
  const runs = items
    .map(toRun)
    .filter((run): run is PositionedRun => run !== null);
  if (runs.length === 0) return [];

  // Descending y: PDF space puts the origin at the BOTTOM-left, so the
  // largest y is the topmost line.
  const byLine: PositionedRun[][] = [];
  for (const run of [...runs].sort((a, b) => b.y - a.y)) {
    const current = byLine[byLine.length - 1];
    const anchor = current?.[0];
    if (anchor && Math.abs(anchor.y - run.y) <= LINE_TOLERANCE_UNITS) {
      current.push(run);
    } else {
      byLine.push([run]);
    }
  }

  return byLine
    .map((line) => joinLine([...line].sort((a, b) => a.x - b.x)))
    .filter((line) => line.length > 0);
}

function joinLine(sorted: readonly PositionedRun[]): string {
  let out = "";
  let cursor: number | null = null;
  for (const run of sorted) {
    if (cursor === null) {
      out = run.text;
    } else {
      const gap = run.x - cursor;
      if (gap >= COLUMN_GAP_RATIO * run.size) {
        out += " | ";
      } else if (
        gap <= GLYPH_GAP_RATIO * run.size ||
        // A run that already ends (or starts) with whitespace has its own
        // spacing; adding more would only widen it. The column separator
        // above still wins over this, because it carries structure rather
        // than spacing.
        /\s$/.test(out) ||
        /^\s/.test(run.text)
      ) {
        out += "";
      } else {
        out += " ";
      }
      out += run.text;
    }
    cursor = run.x + run.width;
  }
  return out.trim();
}

/* ─────────────────── extraction ─────────────────── */

function nonWhitespaceLength(text: string): number {
  return text.replace(/\s+/g, "").length;
}

/**
 * Extracts the text layer of every page, page-capped.
 *
 * `password` is `undefined` on the first attempt: the empty password is
 * tried, and only a genuine `NEED_PASSWORD` raises `pdf-password-required`
 * (E11). The same file is then re-run WITH the password, so a wrong password
 * is retryable without re-picking the file.
 */
export async function extractStatementPdfText(
  file: File,
  password: string | undefined,
  seams: StatementPdfSeams = {},
): Promise<StatementPdfText> {
  const maxPages = seams.maxPages ?? PDF_MAX_PAGES;
  const maxTextChars = seams.maxTextChars ?? PDF_MAX_TEXT_CHARS;
  const load = seams.loadDocument ?? (await loadPdfjsDocument());

  const bytes = new Uint8Array(await file.arrayBuffer());
  // pdfjs takes ownership of (and detaches) the buffer it is handed, so each
  // attempt gets its own copy — otherwise the retry after a wrong password
  // would be reading a zero-length array and reporting a corrupt file.
  const doc = await load(new Uint8Array(bytes), password ?? "");

  try {
    if (!Number.isInteger(doc.numPages) || doc.numPages < 1) {
      throw new StatementPdfError("pdf-corrupt");
    }
    if (doc.numPages > maxPages) {
      throw new StatementPdfError("pdf-too-many-pages");
    }

    const pages: string[] = [];
    let charCount = 0;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = linesFromTextItems(content.items ?? []).join("\n");
      charCount += text.length;
      if (charCount > maxTextChars) {
        throw new StatementPdfError("pdf-text-too-large");
      }
      pages.push(text);
    }

    // E1c — a scan reaches here with every page empty. Refuse it by name
    // rather than sending an empty prompt to a paid model that will happily
    // answer with invented rows.
    const usable = pages.reduce(
      (total, page) => total + nonWhitespaceLength(page),
      0,
    );
    if (usable < PDF_MIN_TEXT_CHARS) {
      throw new StatementPdfError("pdf-no-text-layer");
    }

    return { pageCount: doc.numPages, pages };
  } finally {
    await doc.destroy?.();
  }
}

/* ─────────────────── the real pdfjs loader ─────────────────── */

/**
 * `pdfjs-dist` is ~1 MB of JS. It is reached ONLY through `await import(...)`
 * — never a static import — so `/rekonsiliasi` pays nothing for it until
 * somebody actually picks a PDF, exactly like the group-4 decryptors (E4e).
 *
 * The worker is wired with `new URL(..., import.meta.url)`, which the
 * bundler rewrites to the emitted asset's real URL at build time. The two
 * ways this classically breaks in Next are both avoided: a hardcoded
 * `/pdf.worker.js` path (nothing copies it into `public/`, so it 404s in
 * production), and a CDN URL (a third-party script executing on the page,
 * version-skewed against the bundled library).
 */
let workerConfigured = false;

async function loadPdfjsDocument(): Promise<PdfDocumentLoader> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  return async (bytes, password) => {
    const task = pdfjs.getDocument({
      data: bytes,
      password,
      // Untrusted input from a third party. None of these are needed to read
      // a text layer, and each is a network or font-loading surface.
      disableAutoFetch: true,
      disableFontFace: true,
      // A statement never references an external resource; refusing to
      // resolve one keeps a malicious PDF from making the browser fetch.
      useWorkerFetch: false,
    });
    try {
      return (await task.promise) as unknown as PdfDocumentLike;
    } catch (err) {
      void task.destroy();
      throw toPdfError(err, password);
    }
  };
}

/**
 * Maps a pdfjs exception onto the closed taxonomy above. Nothing pdfjs said
 * survives: its messages quote document internals and are not something we
 * can vouch for in a toast.
 */
function toPdfError(err: unknown, password: string): StatementPdfError {
  const name = (err as { name?: unknown } | null)?.name;
  if (name === "PasswordException") {
    const code = (err as { code?: unknown }).code;
    // 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD (pdfjs `PasswordResponses`).
    // A NEED_PASSWORD raised while a password WAS supplied still means that
    // password was not accepted — reporting "please enter a password" to
    // somebody who just entered one is how a user concludes the app is
    // broken.
    if (code === 2 || password)
      return new StatementPdfError("pdf-wrong-password");
    return new StatementPdfError("pdf-password-required");
  }
  return new StatementPdfError("pdf-corrupt");
}

/**
 * One message per reason — the same bar as `statementFileErrorMessage`: a
 * control that fails must tell the user what to do next.
 *
 * `pdf-wrong-password` says so explicitly and invites a retry, and is never
 * collapsed into `pdf-corrupt`; `pdf-no-text-layer` tells a user with a
 * scanned statement the one thing that will actually work, instead of
 * implying their file is broken.
 */
export function statementPdfErrorMessage(
  err: unknown,
  t: I18nDictionary,
): string {
  const dict = t.rekonsiliasi;
  const reason: StatementPdfFailure =
    err instanceof StatementPdfError ? err.reason : "pdf-corrupt";
  switch (reason) {
    case "pdf-password-required":
      return dict.pdfErrorPasswordRequired;
    case "pdf-wrong-password":
      return dict.pdfErrorWrongPassword;
    case "pdf-too-many-pages":
      return dict.pdfErrorTooManyPages;
    case "pdf-text-too-large":
      return dict.pdfErrorTextTooLarge;
    case "pdf-no-text-layer":
      return dict.pdfErrorNoTextLayer;
    case "pdf-corrupt":
      return dict.pdfErrorCorrupt;
    default: {
      // Compile-time exhaustiveness: a `default` that silently swallows a
      // newly-added reason keeps the build green while telling the user the
      // wrong thing to do. `never` makes it a type error instead.
      const _exhaustive: never = reason;
      void _exhaustive;
      return dict.pdfErrorCorrupt;
    }
  }
}
