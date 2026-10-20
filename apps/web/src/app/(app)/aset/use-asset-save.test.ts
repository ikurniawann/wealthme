jest.mock("../../../lib/auth-client", () => ({
  useSession: () => ({ data: null }),
}));

import { rejectedField } from "./use-asset-save";

const LABELS = { ownerUserId: "Pemilik", acquisitionCost: "Harga perolehan" };

// Client bug 2026-10-21 — a class-validator 400 on Pemilik surfaced only as
// the generic "coba lagi" toast, so the user retried blindly.
describe("rejectedField", () => {
  it("names a known field from a class-validator message array", () => {
    const err = { status: 400, message: ["ownerUserId must be a UUID"] };
    expect(rejectedField(err, LABELS)).toBe("Pemilik");
  });

  it("ignores unknown fields, prototype keys and non-400s", () => {
    expect(
      rejectedField(
        { status: 400, message: ["name should not be empty"] },
        LABELS,
      ),
    ).toBeNull();
    expect(
      rejectedField({ status: 400, message: "constructor x" }, LABELS),
    ).toBeNull();
    expect(
      rejectedField({ status: 409, message: ["ownerUserId x"] }, LABELS),
    ).toBeNull();
    expect(rejectedField(null, LABELS)).toBeNull();
  });
});
