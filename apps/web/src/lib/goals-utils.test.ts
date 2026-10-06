/**
 * EPIC-022 A4 — "every newly created goal is permanently un-editable".
 * `parseGoalFormValues`/`buildGoalBody` used to always send `currentAmount`
 * (parsed from the form's "Sudah Terkumpul" field), even when the user never
 * touched it. Combined with the API's old `@IsPositive()` check (0 fails
 * "positive"), every edit of a freshly-created goal (currentAmount is 0)
 * 400'd. The fix on the client is independent of the API DTO fix (which now
 * accepts 0 too, see update-goal.dto.spec.ts): only send `currentAmount`
 * when it actually differs from what the form was seeded with.
 */

import { buildGoalBody, goalPace, parseGoalFormValues } from "./goals-utils";

describe("parseGoalFormValues", () => {
  it("maps form field names to API field names", () => {
    const result = parseGoalFormValues({
      nama: "Dana Liburan",
      icon: "✈️",
      target: "10.000.000",
      terkumpul: "2.500.000",
      deadline: "2025-12-31",
      autodebit: "500.000",
    });
    expect(result.name).toBe("Dana Liburan");
    expect(result.icon).toBe("✈️");
    expect(result.targetAmount).toBe(10000000);
    expect(result.currentAmount).toBe(2500000);
    expect(result.targetDate).toBe("2025-12-31");
    expect(result.autoDebitAmount).toBe(500000);
  });

  it("strips thousand-separator dots from amount fields", () => {
    const result = parseGoalFormValues({
      nama: "Rumah",
      target: "1.500.000.000",
      terkumpul: "300.000.000",
    });
    expect(result.targetAmount).toBe(1500000000);
    expect(result.currentAmount).toBe(300000000);
  });

  it("omits targetDate/autoDebitAmount/icon when their fields are empty", () => {
    const result = parseGoalFormValues({
      nama: "Tabungan",
      icon: "",
      target: "5.000.000",
      terkumpul: "0",
      deadline: "",
      autodebit: "",
    });
    expect(result.targetDate).toBeUndefined();
    expect(result.autoDebitAmount).toBeUndefined();
    expect(result.icon).toBeUndefined();
  });

  describe("currentAmount omission (EPIC-022 A4)", () => {
    it("includes currentAmount when originalCurrentAmount is not passed (create mode)", () => {
      const result = parseGoalFormValues({
        nama: "X",
        target: "1.000.000",
        terkumpul: "0",
      });
      expect(result.currentAmount).toBe(0);
    });

    it("omits currentAmount on an edit when the parsed value equals the original (untouched field)", () => {
      const result = parseGoalFormValues(
        {
          nama: "Dana Liburan (renamed)",
          target: "10.000.000",
          terkumpul: "0",
        },
        0,
      );
      expect("currentAmount" in result).toBe(false);
    });

    it("includes currentAmount on an edit when the user changed it (e.g. clearing a goal back to 0 — C9)", () => {
      const result = parseGoalFormValues(
        {
          nama: "Dana Liburan",
          target: "10.000.000",
          terkumpul: "0",
        },
        2_500_000,
      );
      expect(result.currentAmount).toBe(0);
    });

    it("includes currentAmount on an edit when the user increased it", () => {
      const result = parseGoalFormValues(
        {
          nama: "Dana Liburan",
          target: "10.000.000",
          terkumpul: "5.000.000",
        },
        2_500_000,
      );
      expect(result.currentAmount).toBe(5000000);
    });
  });
});

describe("buildGoalBody", () => {
  it("returns valid JSON with the correct field values", () => {
    const body = buildGoalBody({
      nama: "Beli Mobil",
      icon: "🚗",
      target: "200.000.000",
      terkumpul: "50.000.000",
      deadline: "2026-06-01",
      autodebit: "2.000.000",
    });
    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect(parsed.name).toBe("Beli Mobil");
    expect(parsed.targetAmount).toBe(200000000);
    expect(parsed.currentAmount).toBe(50000000);
  });

  it("omits currentAmount from the serialized body on an untouched edit", () => {
    const body = buildGoalBody(
      { nama: "Renamed only", target: "10.000.000", terkumpul: "0" },
      0,
    );
    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect("currentAmount" in parsed).toBe(false);
    expect(parsed.name).toBe("Renamed only");
  });
});

describe("goalPace", () => {
  it("reads on_track as on plan", () => {
    expect(goalPace({ status: "on_track", progressPercent: 40 })).toBe(
      "onTrack",
    );
  });

  it("reads both behind-plan statuses as late", () => {
    expect(goalPace({ status: "needs_boost", progressPercent: 30 })).toBe(
      "late",
    );
    expect(goalPace({ status: "at_risk", progressPercent: 5 })).toBe("late");
  });

  it("reads an achieved goal or a full bar as done", () => {
    expect(goalPace({ status: "achieved", progressPercent: 100 })).toBe("done");
    expect(goalPace({ status: "needs_boost", progressPercent: 100 })).toBe(
      "done",
    );
  });
});
