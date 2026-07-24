import {
  DEFAULT_SECURITY_PREFS,
  SECURITY_PREF_KEYS,
  resolveSecurityPrefs,
} from "./security-prefs";

describe("resolveSecurityPrefs", () => {
  it("returns all known keys true when stored is null", () => {
    // Arrange & Act
    const result = resolveSecurityPrefs(null);

    // Assert
    expect(result).toEqual(DEFAULT_SECURITY_PREFS);
    expect(Object.keys(result)).toHaveLength(SECURITY_PREF_KEYS.length);
  });

  it("merges a partial stored value over the defaults", () => {
    // Arrange & Act
    const result = resolveSecurityPrefs({ confirmLargeTxn: false });

    // Assert
    expect(result).toEqual({
      ...DEFAULT_SECURITY_PREFS,
      confirmLargeTxn: false,
    });
  });

  it("drops unknown keys from the stored value", () => {
    // Arrange & Act
    const result = resolveSecurityPrefs({
      confirmLargeTxn: false,
      bogus: true,
    });

    // Assert
    expect(result).not.toHaveProperty("bogus");
    expect(result).toEqual({
      ...DEFAULT_SECURITY_PREFS,
      confirmLargeTxn: false,
    });
  });

  it("ignores non-boolean values and keeps the default for that key", () => {
    // Arrange & Act
    const result = resolveSecurityPrefs({ confirmLargeTxn: "yes" });

    // Assert
    expect(result).toEqual(DEFAULT_SECURITY_PREFS);
  });

  it("always returns exactly the known keys, regardless of input shape", () => {
    // Arrange & Act
    const fromNull = resolveSecurityPrefs(null);
    const fromEmpty = resolveSecurityPrefs({});
    const fromExtra = resolveSecurityPrefs({ extra: "nope" });
    const fromNonObject = resolveSecurityPrefs("not an object");
    const fromArray = resolveSecurityPrefs(["array", "not", "object"]);

    // Assert
    for (const result of [
      fromNull,
      fromEmpty,
      fromExtra,
      fromNonObject,
      fromArray,
    ]) {
      expect(Object.keys(result).sort()).toEqual(
        [...SECURITY_PREF_KEYS].sort(),
      );
    }
  });
});
