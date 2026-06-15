"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGoalFormValues = parseGoalFormValues;

function parseAmount(raw) {
  return parseInt(raw.replace(/\./g, "").replace(/\D/g, "") || "0", 10);
}

function parseGoalFormValues(values) {
  const payload = {
    name: values.nama ?? "",
    targetAmount: parseAmount(values.target ?? ""),
    currentAmount: parseAmount(values.terkumpul ?? ""),
  };

  if (values.icon) payload.icon = values.icon;
  if (values.deadline) payload.targetDate = values.deadline;
  if (values.autodebit) payload.autoDebitAmount = parseAmount(values.autodebit);

  return payload;
}
