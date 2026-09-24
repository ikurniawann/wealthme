// EPIC-033 R1 — the five family religions plus "none". Kept apart from the
// hook so pages can import the list without pulling in TanStack Query (and
// so tests that mock the hook module keep these values).
export type FamilyReligion =
  | "islam"
  | "kristen"
  | "katolik"
  | "hindu"
  | "buddha"
  | "none";

export const FAMILY_RELIGION_OPTIONS = [
  "islam",
  "kristen",
  "katolik",
  "hindu",
  "buddha",
  "none",
] as const;

/** Religions that use the tithe (persepuluhan) calculator. */
export const TITHE_RELIGIONS: ReadonlySet<FamilyReligion> = new Set([
  "kristen",
  "katolik",
]);
