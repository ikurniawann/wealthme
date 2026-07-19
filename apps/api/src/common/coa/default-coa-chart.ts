import type { CoaBudgetType, CoaDirection } from "@prisma/client";

/**
 * Generic, non-personalized Chart of Accounts provisioned for **every** family
 * group (at registration and, for pre-existing groups, by the
 * `add_category_coa_link` migration). The demo family keeps its own richer,
 * personalized chart from `prisma/seed.ts`; this template is what real users
 * get so that `Category.coaAccountId` (NOT NULL) can always be satisfied.
 *
 * `groupNum` follows the confirmed WealthMe taxonomy (EPIC-017 Decision #3):
 *   1 Income · 2 Expense · 3 Wealth Allocation · 4 Receivable · 5 Payable · 6 Tax
 *
 * Keep this in sync with the raw-SQL VALUES list in the
 * `*_add_category_coa_link` migration — both describe the same chart.
 */
export type CoaChartEntry = {
  code: string;
  name: string;
  groupNum: number;
  direction: CoaDirection;
  budgetType: CoaBudgetType;
};

export const GENERIC_COA_CHART: readonly CoaChartEntry[] = [
  // Group 1 — Income
  {
    code: "10001",
    name: "Gaji",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "FIXED",
  },
  {
    code: "10002",
    name: "Bonus",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE",
  },
  {
    code: "10003",
    name: "Pendapatan Usaha",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE",
  },
  {
    code: "10004",
    name: "Hasil Investasi",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE",
  },
  {
    code: "10005",
    name: "Passive Income",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE",
  },
  {
    code: "10099",
    name: "Pemasukan Lainnya",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE",
  },
  // Group 2 — Expense
  {
    code: "20001",
    name: "Makanan & Minuman",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
  {
    code: "20002",
    name: "Transportasi",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
  {
    code: "20003",
    name: "Belanja",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
  {
    code: "20004",
    name: "Tagihan & Utilitas",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "FIXED",
  },
  {
    code: "20005",
    name: "Kesehatan",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
  {
    code: "20006",
    name: "Hiburan",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
  {
    code: "20007",
    name: "Pendidikan",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "FIXED",
  },
  {
    code: "20008",
    name: "Rumah Tangga",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
  {
    code: "20099",
    name: "Pengeluaran Lainnya",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
  // Group 3 — Wealth Allocation
  {
    code: "30001",
    name: "Tabungan",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "FIXED",
  },
  {
    code: "30002",
    name: "Investasi",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "FIXED",
  },
  {
    code: "30003",
    name: "Dana Darurat",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "FIXED",
  },
  {
    code: "30099",
    name: "Alokasi Lainnya",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "VARIABLE",
  },
  // Group 4 — Account Receivable
  {
    code: "40001",
    name: "Piutang",
    groupNum: 4,
    direction: "INCOME",
    budgetType: "VARIABLE",
  },
  // Group 5 — Account Payable
  {
    code: "50001",
    name: "Utang",
    groupNum: 5,
    direction: "EXPENSE",
    budgetType: "FIXED",
  },
  {
    code: "50002",
    name: "Cicilan",
    groupNum: 5,
    direction: "EXPENSE",
    budgetType: "FIXED",
  },
  // Group 6 — Tax
  {
    code: "60001",
    name: "Pajak Penghasilan",
    groupNum: 6,
    direction: "EXPENSE",
    budgetType: "FIXED",
  },
  {
    code: "60002",
    name: "Pajak Lainnya",
    groupNum: 6,
    direction: "EXPENSE",
    budgetType: "FIXED",
  },
];

/** Default income/expense fallback buckets in the generic chart. */
const DEFAULT_INCOME_CODE = "10099";
const DEFAULT_EXPENSE_CODE = "20099";

/**
 * Keyword → COA code hints for mapping a category name onto a generic-chart
 * account. Only used when provisioning fresh charts (registration, seed); the
 * migration backfill of arbitrary existing categories uses the simpler
 * direction-based fallback so it stays valid against any chart shape.
 */
const NAME_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/gaji|salary/i, "10001"],
  [/bonus|thr/i, "10002"],
  [/usaha|bisnis|dagang/i, "10003"],
  [/investasi|dividen|saham|reksa/i, "10004"],
  [/passive|sewa|bunga/i, "10005"],
  [/makan|minum|kuliner/i, "20001"],
  [/transport|bensin|bbm|ojek|parkir/i, "20002"],
  [/belanja|shopping/i, "20003"],
  [/tagihan|utilitas|listrik|internet|pulsa/i, "20004"],
  [/kesehatan|dokter|obat|rumah sakit/i, "20005"],
  [/hiburan|game|nonton/i, "20006"],
  [/pendidikan|sekolah|kuliah|kursus/i, "20007"],
  [/rumah tangga|household|kebersihan/i, "20008"],
  [/tabungan|saving/i, "30001"],
  [/darurat|emergency/i, "30003"],
  [/piutang|receivable/i, "40001"],
  [/utang|hutang|payable|pinjaman/i, "50001"],
  [/cicilan|angsuran|kredit/i, "50002"],
  [/pajak|pph|ppn/i, "60001"],
];

/**
 * Pick a sensible generic-chart COA code for a category, by name hint first and
 * kind fallback second.
 *
 * Direction compatibility (COA has three directions but a category only two
 * kinds): an `income` category may only link to an `INCOME` account; an
 * `expense` category may link to an `EXPENSE` account OR a `TRANSFER` (wealth
 * allocation) account — a savings/investment outflow is a valid target for an
 * expense-kind category. An income hint is therefore never selected for an
 * expense category, and vice-versa. The `kind` fallback bucket keeps the result
 * a valid same-direction account when no hint matches.
 */
export function defaultCoaCodeForCategory(
  kind: "income" | "expense",
  name: string,
): string {
  for (const [pattern, code] of NAME_HINTS) {
    if (pattern.test(name)) {
      const entry = GENERIC_COA_CHART.find((c) => c.code === code);
      if (!entry) continue;
      const compatible =
        kind === "income"
          ? entry.direction === "INCOME"
          : entry.direction === "EXPENSE" || entry.direction === "TRANSFER";
      if (compatible) return code;
    }
  }
  return kind === "income" ? DEFAULT_INCOME_CODE : DEFAULT_EXPENSE_CODE;
}
