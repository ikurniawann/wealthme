import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { PDFFont } from "pdf-lib";

/** One table inside a PDF report (e.g. "Tren Bulanan" or "Breakdown Pengeluaran"). */
export interface PdfTableSection {
  /** Optional sub-heading drawn above the table (bold). */
  heading?: string;
  /** Column headers — repeated at the top of every page the table spans. */
  header: string[];
  /** Data rows; each row must have the same column count as `header`. */
  rows: string[][];
}

/** Full content of one PDF report (title + metadata + one or more tables). */
export interface PdfReportContent {
  title: string;
  /** Extra lines drawn under the title (e.g. family group, period, generated-at). */
  meta: string[];
  sections: PdfTableSection[];
}

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const MAX_ROWS_PER_PAGE = 50;
const TITLE_SIZE = 16;
const META_SIZE = 9;
const HEADING_SIZE = 11;
const CELL_SIZE = 9;
const LINE_HEIGHT = 14;
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0, 0, 0);

/** Shrinks `text` with an ellipsis until it fits within `maxWidth` for `font`/`size`. */
function truncateToWidth(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/** Evenly distributes the usable page width across `columnCount` columns. */
function columnWidths(columnCount: number): number[] {
  const usable = PAGE_WIDTH - MARGIN * 2;
  const width = columnCount > 0 ? usable / columnCount : usable;
  return Array.from({ length: columnCount }, () => width);
}

/**
 * Renders a {@link PdfReportContent} into a real PDF document, paginating
 * every ~{@link MAX_ROWS_PER_PAGE} rows (or when the page runs out of
 * vertical space) and repeating the active table's header on each new page.
 */
export async function renderPdfReport(
  content: PdfReportContent,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  let rowsOnPage = 0;

  function newPage(): void {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    rowsOnPage = 0;
  }

  function drawLine(
    text: string,
    size: number,
    options: { bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ): void {
    const lineFont = options.bold ? boldFont : font;
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    page.drawText(truncateToWidth(lineFont, text, size, maxWidth), {
      x: MARGIN,
      y,
      size,
      font: lineFont,
      color: options.color ?? BLACK,
    });
    y -= LINE_HEIGHT;
  }

  function drawRow(
    cells: string[],
    widths: number[],
    options: { bold?: boolean } = {},
  ): void {
    const rowFont = options.bold ? boldFont : font;
    let x = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const width = widths[i] ?? PAGE_WIDTH - MARGIN * 2;
      const cell = cells[i] ?? "";
      page.drawText(truncateToWidth(rowFont, cell, CELL_SIZE, width - 4), {
        x,
        y,
        size: CELL_SIZE,
        font: rowFont,
      });
      x += width;
    }
    y -= LINE_HEIGHT;
  }

  /** Starts a new page (and re-draws `header` if given) when space runs out. */
  function ensureSpace(header: string[] | null, widths: number[] | null): void {
    const needsNewPage =
      y < MARGIN + LINE_HEIGHT || rowsOnPage >= MAX_ROWS_PER_PAGE;
    if (!needsNewPage) return;
    newPage();
    if (header && widths) {
      drawRow(header, widths, { bold: true });
    }
  }

  drawLine(content.title, TITLE_SIZE, { bold: true });
  for (const line of content.meta) {
    drawLine(line, META_SIZE, { color: GRAY });
  }
  y -= LINE_HEIGHT / 2;

  for (const section of content.sections) {
    ensureSpace(null, null);
    if (section.heading) {
      drawLine(section.heading, HEADING_SIZE, { bold: true });
    }
    const widths = columnWidths(section.header.length);
    drawRow(section.header, widths, { bold: true });

    if (section.rows.length === 0) {
      ensureSpace(section.header, widths);
      drawRow(["(tidak ada data)"], [PAGE_WIDTH - MARGIN * 2]);
      rowsOnPage += 1;
    }

    for (const row of section.rows) {
      ensureSpace(section.header, widths);
      drawRow(row, widths);
      rowsOnPage += 1;
    }
    y -= LINE_HEIGHT / 2;
  }

  return pdfDoc.save();
}
