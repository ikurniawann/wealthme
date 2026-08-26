/**
 * ValidationPipe only validates a body if Nest can see the DTO CLASS.
 *
 * Nest reads it from `design:paramtypes` on the handler. If the DTO import is
 * ever rewritten to `import type { ... }` — which
 * `@typescript-eslint/consistent-type-imports --fix` actively wants to do,
 * and has already done once in this codebase, taking the whole API down —
 * the metadata degrades to `Object` and every `class-validator` bound on the
 * DTO silently stops applying. No error, no failing test: just an endpoint
 * that accepts anything.
 *
 * On these routes that would mean unbounded statement text, an unbounded page
 * count and unbounded row arrays reaching the family's paid AI key.
 *
 * So the metadata is asserted directly. The eslint-disable comments in the
 * controller are the fix; this is what notices when one goes missing.
 */

import "reflect-metadata";

import { PreviewStatementDraftDto } from "./dto/preview-statement-draft.dto";
import { ReadStatementPdfPageDto } from "./dto/read-statement-pdf-page.dto";
import { ReadStatementPdfDto } from "./dto/read-statement-pdf.dto";
import { ReconciliationController } from "./reconciliation.controller";

function paramTypesOf(method: string): unknown[] {
  const types = Reflect.getMetadata(
    "design:paramtypes",
    ReconciliationController.prototype,
    method,
  ) as unknown[] | undefined;
  if (!types) throw new Error(`no design:paramtypes for ${method}()`);
  return types;
}

describe("ReconciliationController — statement DTOs survive to runtime", () => {
  it.each([
    ["readStatementPdf", ReadStatementPdfDto],
    ["readStatementPdfPage", ReadStatementPdfPageDto],
    ["previewStatementDraft", PreviewStatementDraftDto],
  ])("%s() still receives its DTO class", (method, dto) => {
    const types = paramTypesOf(method as string);
    expect(types).toContain(dto);
    // And nothing degraded to the bare `Object` a type-only import leaves
    // behind — that is the exact shape of the failure being guarded.
    expect(types).not.toContain(Object);
  });
});
