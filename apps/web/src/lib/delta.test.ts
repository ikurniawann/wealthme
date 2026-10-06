import {
  DELTA_ARROW,
  deltaDirection,
  deltaSrText,
  deltaTone,
  describeDelta,
  percentChange,
} from "./delta";

const LABELS = {
  up: "naik",
  down: "turun",
  flat: "tetap",
  good: "baik",
  bad: "buruk",
};

describe("describeDelta", () => {
  it("expense that fell 4.525.000 → 1.450.000 is a down arrow in the GOOD tone", () => {
    const d = describeDelta(4_525_000, 1_450_000, "lower-better");
    expect(d?.dir).toBe("down");
    expect(d?.tone).toBe("good");
    expect(Math.round(d?.pct ?? 0)).toBe(-68);
  });

  it("income that fell is a down arrow in the BAD tone", () => {
    const d = describeDelta(1_000_000, 400_000, "higher-better");
    expect(d).toMatchObject({ dir: "down", tone: "bad" });
  });

  it("expense that rose is an up arrow in the BAD tone; income that rose is GOOD", () => {
    expect(describeDelta(100, 150, "lower-better")).toMatchObject({
      dir: "up",
      tone: "bad",
    });
    expect(describeDelta(100, 150, "higher-better")).toMatchObject({
      dir: "up",
      tone: "good",
    });
  });

  it("measures a negative base against its magnitude (a shrinking deficit improves)", () => {
    expect(describeDelta(-200, -100, "higher-better")).toMatchObject({
      dir: "up",
      tone: "good",
      pct: 50,
    });
  });

  it("refuses a zero or non-finite base", () => {
    expect(percentChange(0, 100)).toBeNull();
    expect(describeDelta(0, 100)).toBeNull();
    expect(describeDelta(Number.NaN, 1)).toBeNull();
  });

  it("treats a change that rounds to 0% as flat and neutral", () => {
    expect(deltaDirection(0.4)).toBe("flat");
    expect(deltaDirection(-0.4)).toBe("flat");
    expect(deltaDirection(0.6)).toBe("up");
    expect(deltaTone("flat", "lower-better")).toBe("neutral");
    expect(describeDelta(1000, 1002)).toMatchObject({
      dir: "flat",
      tone: "neutral",
    });
  });
});

describe("deltaSrText", () => {
  it("speaks direction then valence", () => {
    expect(deltaSrText("down", "good", LABELS)).toBe("turun, baik");
    expect(deltaSrText("up", "bad", LABELS)).toBe("naik, buruk");
    expect(deltaSrText("flat", "neutral", LABELS)).toBe("tetap");
  });

  it("arrow glyph follows direction only", () => {
    expect(DELTA_ARROW.up).toBe("↑");
    expect(DELTA_ARROW.down).toBe("↓");
  });
});
