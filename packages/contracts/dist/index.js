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
  isPrivate: z3.boolean().optional(),
  // EPIC-019 Task A — owning member's user id; omit for family-shared.
  ownerUserId: z3.string().uuid().optional()
});
var UpdateAccountInputSchema = CreateAccountInputSchema.partial().extend({
  // Overrides the inherited (non-nullable) optional field: `null` explicitly
  // clears ownership back to family-shared; `undefined` (omitted) leaves it
  // unchanged.
  ownerUserId: z3.string().uuid().nullable().optional()
});
var AccountOwnerFilterSchema = z3.enum(["me", "family", "all"]);
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
  ownerUserId: z3.string().nullable(),
  ownerName: z3.string().nullable(),
  createdAt: z3.string(),
  updatedAt: z3.string()
});

// src/allowance-requests/index.ts
import { z as z4 } from "zod";
var AllowanceRequestStatusSchema = z4.enum([
  "pending",
  "approved",
  "rejected"
]);
var CreateAllowanceRequestInputSchema = z4.object({
  targetAccountId: z4.string().uuid(),
  amount: z4.number().int().positive(),
  note: z4.string().optional()
});
var ApproveAllowanceRequestInputSchema = z4.object({
  fromAccountId: z4.string().uuid()
});
var RejectAllowanceRequestInputSchema = z4.object({
  reason: z4.string().optional()
});
var AllowanceRequestDtoSchema = z4.object({
  id: z4.string(),
  familyGroupId: z4.string(),
  requesterUserId: z4.string(),
  requesterName: z4.string(),
  targetAccountId: z4.string(),
  targetAccountName: z4.string(),
  fromAccountId: z4.string().nullable(),
  fromAccountName: z4.string().nullable(),
  amount: z4.string(),
  note: z4.string().nullable(),
  status: AllowanceRequestStatusSchema,
  createdAt: z4.string(),
  decidedAt: z4.string().nullable(),
  decidedByUserId: z4.string().nullable(),
  decidedByName: z4.string().nullable()
});

// src/members/index.ts
import { z as z5 } from "zod";
var MemberRelationshipSchema = z5.enum([
  "istri",
  "anak",
  "kakek",
  "nenek",
  "bibi",
  "supir",
  "sekretaris",
  "bendahara"
]);
var RoleSchema = z5.enum([
  "owner",
  "member",
  "admin_staff",
  "spouse",
  "dependant",
  "operational"
]);
var DEFAULT_ROLE_BY_RELATIONSHIP = {
  istri: "spouse",
  anak: "dependant",
  kakek: "member",
  nenek: "member",
  bibi: "member",
  supir: "operational",
  sekretaris: "operational",
  bendahara: "admin_staff"
};
function defaultRoleForRelationship(relationship) {
  return DEFAULT_ROLE_BY_RELATIONSHIP[relationship];
}

// src/categories/index.ts
import { z as z6 } from "zod";
var CategoryKindSchema = z6.enum(["income", "expense"]);
var CategoryDtoSchema = z6.object({
  id: z6.string().uuid(),
  familyGroupId: z6.string().uuid(),
  name: z6.string(),
  kind: CategoryKindSchema,
  // EPIC-017: mandatory COA link (same family group).
  coaAccountId: z6.string().uuid(),
  color: z6.string().nullable(),
  icon: z6.string().nullable(),
  isPrivate: z6.boolean(),
  createdAt: z6.string()
});

// src/coa/index.ts
var GENERIC_COA_CHART = [
  // Group 1 — Income
  {
    code: "10001",
    name: "Gaji",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "FIXED"
  },
  {
    code: "10002",
    name: "Bonus",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE"
  },
  {
    code: "10003",
    name: "Pendapatan Usaha",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE"
  },
  {
    code: "10004",
    name: "Hasil Investasi",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE"
  },
  {
    code: "10005",
    name: "Passive Income",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE"
  },
  {
    code: "10099",
    name: "Pemasukan Lainnya",
    groupNum: 1,
    direction: "INCOME",
    budgetType: "VARIABLE"
  },
  // Group 2 — Expense
  {
    code: "20001",
    name: "Makanan & Minuman",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
  },
  {
    code: "20002",
    name: "Transportasi",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
  },
  {
    code: "20003",
    name: "Belanja",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
  },
  {
    code: "20004",
    name: "Tagihan & Utilitas",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "FIXED"
  },
  {
    code: "20005",
    name: "Kesehatan",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
  },
  {
    code: "20006",
    name: "Hiburan",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
  },
  {
    code: "20007",
    name: "Pendidikan",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "FIXED"
  },
  {
    code: "20008",
    name: "Rumah Tangga",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
  },
  {
    code: "20099",
    name: "Pengeluaran Lainnya",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
  },
  // EPIC-023 A1/A2 — the interest portion of a liability payment is a real
  // expense (unlike the principal, which is a group-5 TRANSFER below).
  {
    code: "20009",
    name: "Bunga Pinjaman",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "FIXED"
  },
  // Group 3 — Wealth Allocation
  {
    code: "30001",
    name: "Tabungan",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "FIXED"
  },
  {
    code: "30002",
    name: "Investasi",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "FIXED"
  },
  {
    code: "30003",
    name: "Dana Darurat",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "FIXED"
  },
  {
    code: "30099",
    name: "Alokasi Lainnya",
    groupNum: 3,
    direction: "TRANSFER",
    budgetType: "VARIABLE"
  },
  // Group 4 — Account Receivable. TRANSFER, not INCOME: money lent out or a
  // reimbursement owed is a claim on an asset, not revenue (EPIC-023 D23).
  {
    code: "40001",
    name: "Piutang",
    groupNum: 4,
    direction: "TRANSFER",
    budgetType: "VARIABLE"
  },
  // Group 5 — Account Payable. TRANSFER, not EXPENSE: principal repayment
  // reduces a liability, it does not consume income (EPIC-023 D23). The
  // interest portion of a payment is its own group-2 expense (code 20009).
  {
    code: "50001",
    name: "Utang",
    groupNum: 5,
    direction: "TRANSFER",
    budgetType: "FIXED"
  },
  {
    code: "50002",
    name: "Cicilan",
    groupNum: 5,
    direction: "TRANSFER",
    budgetType: "FIXED"
  },
  // Group 6 — Tax
  {
    code: "60001",
    name: "Pajak Penghasilan",
    groupNum: 6,
    direction: "EXPENSE",
    budgetType: "FIXED"
  },
  {
    code: "60002",
    name: "Pajak Lainnya",
    groupNum: 6,
    direction: "EXPENSE",
    budgetType: "FIXED"
  }
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
import { z as z7 } from "zod";
var TransactionTypeSchema = z7.enum(["income", "expense", "transfer"]);
var CreateTransactionInputSchema = z7.object({
  accountId: z7.string().uuid(),
  categoryId: z7.string().uuid().optional(),
  amount: z7.number().int().positive(),
  type: TransactionTypeSchema,
  description: z7.string().optional(),
  occurredAt: z7.string(),
  toAccountId: z7.string().uuid().optional(),
  // EPIC-021 Group B #28 — e-wallet top-up admin fee. Only meaningful when
  // type = transfer with a toAccountId; deducted from the DESTINATION
  // account as a separate linked expense (see transactions.service.ts).
  adminFee: z7.number().int().min(0).optional()
});
var TransactionDtoSchema = z7.object({
  id: z7.string().uuid(),
  familyGroupId: z7.string().uuid(),
  accountId: z7.string().uuid(),
  toAccountId: z7.string().uuid().nullable(),
  categoryId: z7.string().uuid().nullable(),
  amount: z7.string(),
  type: TransactionTypeSchema,
  description: z7.string().nullable(),
  categoryName: z7.string().nullable(),
  accountName: z7.string(),
  toAccountName: z7.string().nullable(),
  occurredAt: z7.string(),
  createdAt: z7.string()
});
var TransactionSummarySchema = z7.object({
  totalIncome: z7.string(),
  totalExpense: z7.string(),
  netBalance: z7.string(),
  period: z7.object({
    from: z7.string().nullable(),
    to: z7.string().nullable()
  })
});
var TransactionListResponseSchema = z7.object({
  data: z7.array(TransactionDtoSchema),
  meta: z7.object({
    total: z7.number(),
    page: z7.number(),
    limit: z7.number()
  }),
  summary: TransactionSummarySchema
});

// src/assets/index.ts
var DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT = {
  properti: 3,
  // modest appreciation
  kendaraan: -12,
  // typical vehicle depreciation
  elektronik: -20,
  // fast depreciation
  perhiasan: 2,
  // mild appreciation
  lainnya: 0
  // no assumption
};

// src/member-category-allowances/index.ts
import { z as z8 } from "zod";
var SetMemberCategoryAllowanceInputSchema = z8.object({
  categoryIds: z8.array(z8.string().uuid())
});
var AllowedCategoryDtoSchema = z8.object({
  id: z8.string(),
  name: z8.string()
});
var MemberCategoryAllowanceDtoSchema = z8.object({
  memberId: z8.string(),
  // Empty = unrestricted (backward compatible default for every member).
  categories: z8.array(AllowedCategoryDtoSchema)
});
export {
  AccountDtoSchema,
  AccountOwnerFilterSchema,
  AccountTypeSchema,
  AllowanceRequestDtoSchema,
  AllowanceRequestStatusSchema,
  AllowedCategoryDtoSchema,
  ApproveAllowanceRequestInputSchema,
  AuthUserSchema,
  CONTRACTS_VERSION,
  CategoryDtoSchema,
  CategoryKindSchema,
  CreateAccountInputSchema,
  CreateAllowanceRequestInputSchema,
  CreateTransactionInputSchema,
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  DEFAULT_ROLE_BY_RELATIONSHIP,
  GENERIC_COA_CHART,
  LoginInputSchema,
  MemberCategoryAllowanceDtoSchema,
  MemberRelationshipSchema,
  RejectAllowanceRequestInputSchema,
  RoleSchema,
  RupiahSchema,
  SetMemberCategoryAllowanceInputSchema,
  TransactionDtoSchema,
  TransactionListResponseSchema,
  TransactionSummarySchema,
  TransactionTypeSchema,
  UpdateAccountInputSchema,
  defaultCoaCodeForCategory,
  defaultRoleForRelationship
};
