/** Minimal shape needed to match — deliberately not the Prisma model, so the
 *  matcher stays a pure, directly testable function. */
export type MatchableCategory = { id: string; name: string };

/** Shortest normalised name allowed to win on a substring match. "Lain"
 *  (4 chars) or shorter fragments match almost any merchant string, which is
 *  how a guess turns into a wrong category. */
const MIN_SUBSTRING_LENGTH = 5;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * EPIC-027 D13 — maps the model's free-text `categoryHint` onto a REAL
 * Category of the caller's family.
 *
 * Deliberately conservative and single-pass: exact (case/whitespace
 * insensitive) name match first, then a substring match in either direction,
 * preferring the longest name so "Makanan & Minuman" beats "Makanan". No
 * match returns `null` — the client then shows a blank category rather than
 * a plausible-looking wrong one, and no second AI call is made and no
 * Category is ever auto-created.
 *
 * `categories` MUST already be scoped to the caller's familyGroupId — the
 * tenant boundary lives in the query, not here.
 */
export function matchCategoryId(
  categoryHint: string,
  categories: readonly MatchableCategory[],
): string | null {
  const hint = normalize(categoryHint);
  if (!hint) return null;

  const normalized = categories.map((category) => ({
    id: category.id,
    name: normalize(category.name),
  }));

  const exact = normalized.find((category) => category.name === hint);
  if (exact) return exact.id;

  const partial = normalized
    .filter(
      (category) =>
        category.name.length >= MIN_SUBSTRING_LENGTH &&
        (hint.includes(category.name) || category.name.includes(hint)),
    )
    .sort((a, b) => b.name.length - a.name.length)[0];

  return partial?.id ?? null;
}
