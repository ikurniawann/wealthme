import { test, describe } from "node:test";
import assert from "node:assert/strict";

const mod = await import("../goals-utils.js").catch(() => ({}));
const { parseGoalFormValues } = mod;

describe("parseGoalFormValues", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof parseGoalFormValues,
      "function",
      "parseGoalFormValues must be exported from goals-utils",
    );
  });

  test("maps form field names to API field names", () => {
    const result = parseGoalFormValues({
      nama: "Dana Liburan",
      icon: "✈️",
      target: "10.000.000",
      terkumpul: "2.500.000",
      deadline: "2025-12-31",
      autodebit: "500.000",
    });
    assert.equal(result.name, "Dana Liburan");
    assert.equal(result.icon, "✈️");
    assert.equal(result.targetAmount, 10000000);
    assert.equal(result.currentAmount, 2500000);
    assert.equal(result.targetDate, "2025-12-31");
    assert.equal(result.autoDebitAmount, 500000);
  });

  test("strips thousand-separator dots from amount fields", () => {
    const result = parseGoalFormValues({
      nama: "Rumah",
      icon: "🏠",
      target: "1.500.000.000",
      terkumpul: "300.000.000",
      deadline: "",
      autodebit: "",
    });
    assert.equal(result.targetAmount, 1500000000);
    assert.equal(result.currentAmount, 300000000);
  });

  test("omits targetDate when deadline is empty string", () => {
    const result = parseGoalFormValues({
      nama: "Tabungan",
      icon: "🛡️",
      target: "5.000.000",
      terkumpul: "0",
      deadline: "",
      autodebit: "",
    });
    assert.ok(!("targetDate" in result) || result.targetDate === undefined);
  });

  test("omits autoDebitAmount when autodebit is empty string", () => {
    const result = parseGoalFormValues({
      nama: "Tabungan",
      icon: "🛡️",
      target: "5.000.000",
      terkumpul: "0",
      deadline: "",
      autodebit: "",
    });
    assert.ok(
      !("autoDebitAmount" in result) || result.autoDebitAmount === undefined,
    );
  });

  test("includes autoDebitAmount when autodebit is non-empty", () => {
    const result = parseGoalFormValues({
      nama: "X",
      icon: "🎯",
      target: "1.000.000",
      terkumpul: "0",
      deadline: "",
      autodebit: "200.000",
    });
    assert.equal(result.autoDebitAmount, 200000);
  });

  test("parses zero terkumpul as 0", () => {
    const result = parseGoalFormValues({
      nama: "X",
      icon: "🎯",
      target: "1.000.000",
      terkumpul: "0",
      deadline: "",
      autodebit: "",
    });
    assert.equal(result.currentAmount, 0);
  });

  test("omits icon when icon is empty string", () => {
    const result = parseGoalFormValues({
      nama: "X",
      icon: "",
      target: "1.000.000",
      terkumpul: "0",
      deadline: "",
      autodebit: "",
    });
    assert.ok(!("icon" in result) || result.icon === undefined);
  });
});
