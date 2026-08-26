/**
 * The API shipped unable to boot while 1379 tests were green.
 *
 * `eslint --fix` (rule `@typescript-eslint/consistent-type-imports`) rewrote
 * one line in `reconciliation.service.ts` during a commit hook:
 *
 *     import { PrismaService }        →   import { type PrismaService }
 *
 * A `type` import is erased at runtime, so the emitted `design:paramtypes`
 * entry for that constructor parameter degrades to the bare `Function`, and
 * Nest fails at startup with "Nest can't resolve dependencies of the
 * ReconciliationService (?, ...)". Nothing caught it: every reconciliation
 * spec builds the service with `new ReconciliationService(...)`, which
 * bypasses the injector entirely, and no spec boots a real module.
 *
 * `ai-advisor.service.ts` already carried a comment saying this had happened
 * once before — a comment is not a test, and it did not stop the recurrence.
 *
 * So this walks every injectable in the codebase and asserts that no
 * constructor parameter has been erased. It is deliberately reflection-based
 * rather than a module-boot test: booting one module proves one module, while
 * this covers services added later, by anyone, for free.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import "reflect-metadata";

const SRC_ROOT = join(__dirname, "..");
/** Files whose default export shape is a Nest-managed class. */
const INJECTABLE_FILE_RE =
  /\.(service|factory|guard|interceptor|strategy)\.ts$/;

/** Directories that hold no runtime injectables worth reflecting over. */
const SKIP_DIRS = new Set(["node_modules", "dist", "prisma", "__mocks__"]);

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, out);
    } else if (INJECTABLE_FILE_RE.test(entry) && !entry.includes(".spec.")) {
      out.push(full);
    }
  }
  return out;
}

const files = collect(SRC_ROOT);

describe("Nest DI — no constructor parameter is erased at runtime", () => {
  it("finds injectable source files to check (guards against a vacuous sweep)", () => {
    expect(existsSync(SRC_ROOT)).toBe(true);
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.slice(SRC_ROOT.length + 1), f]))(
    "%s",
    (_label, file) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(file) as Record<string, unknown>;

      for (const [name, exported] of Object.entries(mod)) {
        if (typeof exported !== "function" || !exported.prototype) continue;
        // Only classes Nest actually manages. The watermark is what
        // `@Injectable()` stamps on; plain classes that happen to carry
        // `design:paramtypes` (any decorated class does) are not our business,
        // and their non-class parameter types would be false positives.
        if (!Reflect.getMetadata("__injectable__", exported)) continue;
        if (!Reflect.hasMetadata("design:paramtypes", exported)) continue;

        const params = Reflect.getMetadata("design:paramtypes", exported) as
          | unknown[]
          | undefined;
        if (!params) continue;

        // A parameter resolved by an explicit @Inject(TOKEN) is allowed to
        // reflect as Function/Object — the token, not the type, resolves it.
        const explicit = new Set<number>(
          (
            (Reflect.getMetadata("self:paramtypes", exported) as
              | { index: number }[]
              | undefined) ?? []
          ).map((p) => p.index),
        );

        params.forEach((param, index) => {
          if (explicit.has(index)) return;
          // What an erased parameter reflects as depends on the emitter:
          // production `tsc` produced `Function` here (that is what Nest
          // printed when the API died), while ts-jest emits `Object` for the
          // same source. Checking only for `Function` made an earlier version
          // of this spec pass against the very bug it was written for — so
          // both are treated as erased, along with the undefined a
          // circular import yields.
          const erased =
            param === undefined ||
            param === null ||
            param === Function ||
            param === Object;
          expect({ class: name, index, erased }).toEqual({
            class: name,
            index,
            erased: false,
          });
        });
      }
    },
  );
});
