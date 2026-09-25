import { mergeReferenceOptions } from "./reference-options";

describe("mergeReferenceOptions", () => {
  it("lists Master Data labels first, then the static leftovers, without duplicates", () => {
    expect(
      mergeReferenceOptions(
        ["BCA", "Mandiri", "Bank Tes MD"],
        ["BCA", "Mandiri", "BRI", "Bank Lainnya"],
      ),
    ).toEqual(["BCA", "Mandiri", "Bank Tes MD", "BRI", "Bank Lainnya"]);
  });

  it("keeps a stored value that is in neither list selectable", () => {
    expect(mergeReferenceOptions(["BCA"], ["Bank Lainnya"], "Jenius")).toEqual([
      "BCA",
      "Jenius",
      "Bank Lainnya",
    ]);
  });

  it("falls back to the static list when Master Data returned nothing", () => {
    expect(mergeReferenceOptions([], ["GoPay", "OVO"], "GoPay")).toEqual([
      "GoPay",
      "OVO",
    ]);
  });

  it("ignores an empty current value", () => {
    expect(mergeReferenceOptions(["BCA"], [], "")).toEqual(["BCA"]);
  });
});
