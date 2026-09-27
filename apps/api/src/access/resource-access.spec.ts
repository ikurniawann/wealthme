import { resolveEffectiveAccess } from "@wealthme/contracts";

import { resourceAllows } from "./resource-access";

const legacy = (role: Parameters<typeof resolveEffectiveAccess>[0]["role"]) =>
  resolveEffectiveAccess({ role });

describe("resourceAllows", () => {
  it("lets the Master through everywhere", () => {
    expect(resourceAllows(legacy("owner"), "tax", "DELETE")).toBe(true);
  });

  it("keeps a legacy dependant's old reach: own transactions + account list", () => {
    const a = legacy("dependant");
    expect(resourceAllows(a, "transactions", "POST")).toBe(true);
    expect(resourceAllows(a, "accounts", "GET")).toBe(true);
    expect(resourceAllows(a, "categories", "GET")).toBe(true);
    expect(resourceAllows(a, "allowance-requests", "POST")).toBe(true);
    expect(resourceAllows(a, "investments", "GET")).toBe(false);
    expect(resourceAllows(a, "accounts", "POST")).toBe(false);
    expect(resourceAllows(a, "allowance-requests.decide", "PATCH")).toBe(false);
  });

  it("view allows reads only; manage allows writes", () => {
    const viewOnly = resolveEffectiveAccess({
      role: "member",
      accessRole: { dataScope: "all", permissions: { investasi: "view" } },
    });
    expect(resourceAllows(viewOnly, "investments", "GET")).toBe(true);
    expect(resourceAllows(viewOnly, "investments", "POST")).toBe(false);
    expect(resourceAllows(viewOnly, "investments", "DELETE")).toBe(false);

    const manage = resolveEffectiveAccess({
      role: "member",
      accessRole: { dataScope: "all", permissions: { investasi: "manage" } },
    });
    expect(resourceAllows(manage, "investments", "PATCH")).toBe(true);
  });

  it("a page with no grant closes its API", () => {
    const a = resolveEffectiveAccess({
      role: "spouse",
      accessRole: { dataScope: "all", permissions: { tujuan: "manage" } },
    });
    expect(resourceAllows(a, "goals", "POST")).toBe(true);
    expect(resourceAllows(a, "tax", "GET")).toBe(false);
    expect(resourceAllows(a, "reports", "GET")).toBe(false);
  });

  it("AI chat is usable with view (POST forced to view level)", () => {
    const a = resolveEffectiveAccess({
      role: "member",
      accessRole: { dataScope: "all", permissions: { ai: "view" } },
    });
    expect(resourceAllows(a, "ai-advisor", "POST")).toBe(true);
    expect(resourceAllows(a, "ai-key", "PUT")).toBe(false);
  });

  it("overrides beat the role", () => {
    const a = resolveEffectiveAccess({
      role: "dependant",
      overrides: { investasi: "view", transaksi: "none" },
    });
    expect(resourceAllows(a, "investments", "GET")).toBe(true);
    expect(resourceAllows(a, "transactions", "POST")).toBe(false);
  });
});
