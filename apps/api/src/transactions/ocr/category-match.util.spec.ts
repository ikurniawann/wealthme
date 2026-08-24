import { matchCategoryId } from "./category-match.util";

const CATEGORIES = [
  { id: "cat-food", name: "Makanan & Minuman" },
  { id: "cat-transport", name: "Transportasi" },
  { id: "cat-misc", name: "Lainnya" },
];

describe("matchCategoryId (EPIC-027 D13)", () => {
  it("matches an exact category name", () => {
    expect(matchCategoryId("Makanan & Minuman", CATEGORIES)).toBe("cat-food");
  });

  it("ignores case and surrounding/inner whitespace differences", () => {
    expect(matchCategoryId("  makanan &   minuman ", CATEGORIES)).toBe(
      "cat-food",
    );
    expect(matchCategoryId("TRANSPORTASI", CATEGORIES)).toBe("cat-transport");
  });

  it("matches a hint that contains a category name, preferring the longest", () => {
    const categories = [
      { id: "cat-food", name: "Makanan" },
      { id: "cat-food-drink", name: "Makanan & Minuman" },
    ];
    expect(matchCategoryId("Belanja Makanan & Minuman", categories)).toBe(
      "cat-food-drink",
    );
  });

  it("returns null when nothing matches — never a guess, never a new category", () => {
    expect(matchCategoryId("Asuransi Jiwa", CATEGORIES)).toBeNull();
  });

  it("returns null for a blank hint", () => {
    expect(matchCategoryId("   ", CATEGORIES)).toBeNull();
  });

  it("never matches against an empty (other-family-only) candidate list", () => {
    // The tenant boundary lives in the caller's query: this matcher only ever
    // sees the caller's own family rows, so another family's identically
    // named category simply is not a candidate.
    expect(matchCategoryId("Makanan & Minuman", [])).toBeNull();
  });
});
