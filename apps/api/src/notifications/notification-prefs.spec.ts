import {
  DEFAULT_NOTIF_PREFS,
  NOTIF_PREF_KEYS,
  resolveNotifPrefs,
} from "./notification-prefs";

describe("resolveNotifPrefs", () => {
  it("returns all 9 keys true when stored is null", () => {
    // Arrange & Act
    const result = resolveNotifPrefs(null);

    // Assert
    expect(result).toEqual(DEFAULT_NOTIF_PREFS);
    expect(Object.keys(result)).toHaveLength(9);
  });

  it("merges a partial stored value over the defaults", () => {
    // Arrange & Act
    const result = resolveNotifPrefs({ budget80: false });

    // Assert — only budget80 flips, every other key stays at its default
    expect(result).toEqual({ ...DEFAULT_NOTIF_PREFS, budget80: false });
  });

  it("drops unknown keys from the stored value", () => {
    // Arrange & Act
    const result = resolveNotifPrefs({ budget80: false, bogus: true });

    // Assert
    expect(result).not.toHaveProperty("bogus");
    expect(result).toEqual({ ...DEFAULT_NOTIF_PREFS, budget80: false });
  });

  it("ignores non-boolean values and keeps the default for that key", () => {
    // Arrange & Act
    const result = resolveNotifPrefs({
      txnIn: "yes",
      txnOut: 1,
      txnBig: null,
      budget80: false,
    });

    // Assert — non-boolean values fall back to the default (true); budget80
    // is a genuine boolean so it applies.
    expect(result).toEqual({ ...DEFAULT_NOTIF_PREFS, budget80: false });
  });

  it("always returns exactly the 9 known keys, regardless of input shape", () => {
    // Arrange & Act
    const fromNull = resolveNotifPrefs(null);
    const fromEmpty = resolveNotifPrefs({});
    const fromExtra = resolveNotifPrefs({ dividend: false, extra: "nope" });
    const fromNonObject = resolveNotifPrefs("not an object");
    const fromArray = resolveNotifPrefs(["array", "not", "object"]);

    // Assert
    for (const result of [
      fromNull,
      fromEmpty,
      fromExtra,
      fromNonObject,
      fromArray,
    ]) {
      expect(Object.keys(result).sort()).toEqual([...NOTIF_PREF_KEYS].sort());
    }
  });
});
