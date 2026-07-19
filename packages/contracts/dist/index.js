// src/common/index.ts
import { z } from "zod";
var RupiahSchema = z.number().int().nonnegative();
var CONTRACTS_VERSION = "0.0.0";

// src/auth/index.ts
import { z as z2 } from "zod";
var LoginInputSchema = z2.object({
  email: z2.string().email(),
  password: z2.string().min(8)
});
var AuthUserSchema = z2.object({
  id: z2.string(),
  name: z2.string(),
  email: z2.string().email()
});

// src/accounts/index.ts
import { z as z3 } from "zod";
var AccountTypeSchema = z3.enum([
  "bank",
  "ewallet",
  "cash",
  "investment",
  "property"
]);
var CreateAccountInputSchema = z3.object({
  name: z3.string().min(1),
  type: AccountTypeSchema,
  institution: z3.string().optional(),
  maskedNumber: z3.string().optional(),
  balance: z3.number().int(),
  currency: z3.string().default("IDR"),
  isPrivate: z3.boolean().optional()
});
var UpdateAccountInputSchema = CreateAccountInputSchema.partial();
var AccountDtoSchema = z3.object({
  id: z3.string(),
  familyGroupId: z3.string(),
  name: z3.string(),
  type: AccountTypeSchema,
  institution: z3.string().nullable(),
  maskedNumber: z3.string().nullable(),
  balance: z3.string(),
  currency: z3.string(),
  isPrivate: z3.boolean(),
  createdAt: z3.string(),
  updatedAt: z3.string()
});

// src/categories/index.ts
import { z as z4 } from "zod";
var CategoryKindSchema = z4.enum(["income", "expense"]);
var CategoryDtoSchema = z4.object({
  id: z4.string().uuid(),
  familyGroupId: z4.string().uuid(),
  name: z4.string(),
  kind: CategoryKindSchema,
  // EPIC-017: mandatory COA link (same family group).
  coaAccountId: z4.string().uuid(),
  color: z4.string().nullable(),
  icon: z4.string().nullable(),
  isPrivate: z4.boolean(),
  createdAt: z4.string()
});

// src/coa/index.ts
var GENERIC_COA_CHART = [
  // Group 1 — Income
  { code: "10001", name: "Gaji", groupNum: 1, direction: "INCOME", budgetType: "FIXED" },
  { code: "10002", name: "Bonus", groupNum: 1, direction: "INCOME", budgetType: "VARIABLE" },
  { code: "10003", name: "Pendapatan Usaha", groupNum: 1, direction: "INCOME", budgetType: "VARIABLE" },
  { code: "10004", name: "Hasil Investasi", groupNum: 1, direction: "INCOME", budgetType: "VARIABLE" },
  { code: "10005", name: "Passive Income", groupNum: 1, direction: "INCOME", budgetType: "VARIABLE" },
  { code: "10099", name: "Pemasukan Lainnya", groupNum: 1, direction: "INCOME", budgetType: "VARIABLE" },
  // Group 2 — Expense
  { code: "20001", name: "Makanan & Minuman", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" },
  { code: "20002", name: "Transportasi", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" },
  { code: "20003", name: "Belanja", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" },
  { code: "20004", name: "Tagihan & Utilitas", groupNum: 2, direction: "EXPENSE", budgetType: "FIXED" },
  { code: "20005", name: "Kesehatan", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" },
  { code: "20006", name: "Hiburan", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" },
  { code: "20007", name: "Pendidikan", groupNum: 2, direction: "EXPENSE", budgetType: "FIXED" },
  { code: "20008", name: "Rumah Tangga", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" },
  { code: "20099", name: "Pengeluaran Lainnya", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" },
  // Group 3 — Wealth Allocation
  { code: "30001", name: "Tabungan", groupNum: 3, direction: "TRANSFER", budgetType: "FIXED" },
  { code: "30002", name: "Investasi", groupNum: 3, direction: "TRANSFER", budgetType: "FIXED" },
  { code: "30003", name: "Dana Darurat", groupNum: 3, direction: "TRANSFER", budgetType: "FIXED" },
  { code: "30099", name: "Alokasi Lainnya", groupNum: 3, direction: "TRANSFER", budgetType: "VARIABLE" },
  // Group 4 — Account Receivable
  { code: "40001", name: "Piutang", groupNum: 4, direction: "INCOME", budgetType: "VARIABLE" },
  // Group 5 — Account Payable
  { code: "50001", name: "Utang", groupNum: 5, direction: "EXPENSE", budgetType: "FIXED" },
  { code: "50002", name: "Cicilan", groupNum: 5, direction: "EXPENSE", budgetType: "FIXED" },
  // Group 6 — Tax
  { code: "60001", name: "Pajak Penghasilan", groupNum: 6, direction: "EXPENSE", budgetType: "FIXED" },
  { code: "60002", name: "Pajak Lainnya", groupNum: 6, direction: "EXPENSE", budgetType: "FIXED" }
];
var DEFAULT_INCOME_CODE = "10099";
var DEFAULT_EXPENSE_CODE = "20099";
var NAME_HINTS = [
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
  [/pajak|pph|ppn/i, "60001"]
];
function defaultCoaCodeForCategory(kind, name) {
  for (const [pattern, code] of NAME_HINTS) {
    if (pattern.test(name)) {
      const entry = GENERIC_COA_CHART.find((c) => c.code === code);
      if (!entry) continue;
      const compatible = kind === "income" ? entry.direction === "INCOME" : entry.direction === "EXPENSE" || entry.direction === "TRANSFER";
      if (compatible) return code;
    }
  }
  return kind === "income" ? DEFAULT_INCOME_CODE : DEFAULT_EXPENSE_CODE;
}

// src/transactions/index.ts
import { z as z5 } from "zod";
var TransactionTypeSchema = z5.enum(["income", "expense", "transfer"]);
var CreateTransactionInputSchema = z5.object({
  accountId: z5.string().uuid(),
  categoryId: z5.string().uuid().optional(),
  amount: z5.number().int().positive(),
  type: TransactionTypeSchema,
  description: z5.string().optional(),
  occurredAt: z5.string(),
  toAccountId: z5.string().uuid().optional()
});
var TransactionDtoSchema = z5.object({
  id: z5.string().uuid(),
  familyGroupId: z5.string().uuid(),
  accountId: z5.string().uuid(),
  categoryId: z5.string().uuid().nullable(),
  amount: z5.string(),
  type: TransactionTypeSchema,
  description: z5.string().nullable(),
  categoryName: z5.string().nullable(),
  accountName: z5.string(),
  occurredAt: z5.string(),
  createdAt: z5.string()
});
var TransactionSummarySchema = z5.object({
  totalIncome: z5.string(),
  totalExpense: z5.string(),
  netBalance: z5.string(),
  period: z5.object({
    from: z5.string().nullable(),
    to: z5.string().nullable()
  })
});
var TransactionListResponseSchema = z5.object({
  data: z5.array(TransactionDtoSchema),
  meta: z5.object({
    total: z5.number(),
    page: z5.number(),
    limit: z5.number()
  }),
  summary: TransactionSummarySchema
});
export {
  AccountDtoSchema,
  AccountTypeSchema,
  AuthUserSchema,
  CONTRACTS_VERSION,
  CategoryDtoSchema,
  CategoryKindSchema,
  CreateAccountInputSchema,
  CreateTransactionInputSchema,
  GENERIC_COA_CHART,
  LoginInputSchema,
  RupiahSchema,
  TransactionDtoSchema,
  TransactionListResponseSchema,
  TransactionSummarySchema,
  TransactionTypeSchema,
  UpdateAccountInputSchema,
  defaultCoaCodeForCategory
};
