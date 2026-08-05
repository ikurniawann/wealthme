"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AccountDtoSchema: () => AccountDtoSchema,
  AccountOwnerFilterSchema: () => AccountOwnerFilterSchema,
  AccountTypeSchema: () => AccountTypeSchema,
  AllowanceRequestDtoSchema: () => AllowanceRequestDtoSchema,
  AllowanceRequestKindSchema: () => AllowanceRequestKindSchema,
  AllowanceRequestStatusSchema: () => AllowanceRequestStatusSchema,
  AllowedCategoryDtoSchema: () => AllowedCategoryDtoSchema,
  ApproveAllowanceRequestInputSchema: () => ApproveAllowanceRequestInputSchema,
  AuthUserSchema: () => AuthUserSchema,
  CONTRACTS_VERSION: () => CONTRACTS_VERSION,
  CategoryDtoSchema: () => CategoryDtoSchema,
  CategoryKindSchema: () => CategoryKindSchema,
  CreateAccountInputSchema: () => CreateAccountInputSchema,
  CreateAllowanceRequestInputSchema: () => CreateAllowanceRequestInputSchema,
  CreateTransactionInputSchema: () => CreateTransactionInputSchema,
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT: () => DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  DEFAULT_ROLE_BY_RELATIONSHIP: () => DEFAULT_ROLE_BY_RELATIONSHIP,
  GENERIC_COA_CHART: () => GENERIC_COA_CHART,
  HeldExpenseResponseSchema: () => HeldExpenseResponseSchema,
  LoginInputSchema: () => LoginInputSchema,
  MemberCategoryAllowanceDtoSchema: () => MemberCategoryAllowanceDtoSchema,
  MemberRelationshipSchema: () => MemberRelationshipSchema,
  RejectAllowanceRequestInputSchema: () => RejectAllowanceRequestInputSchema,
  RoleSchema: () => RoleSchema,
  RupiahSchema: () => RupiahSchema,
  SetMemberCategoryAllowanceInputSchema: () => SetMemberCategoryAllowanceInputSchema,
  TransactionDtoSchema: () => TransactionDtoSchema,
  TransactionListResponseSchema: () => TransactionListResponseSchema,
  TransactionSummarySchema: () => TransactionSummarySchema,
  TransactionTypeSchema: () => TransactionTypeSchema,
  UpdateAccountInputSchema: () => UpdateAccountInputSchema,
  defaultCoaCodeForCategory: () => defaultCoaCodeForCategory,
  defaultRoleForRelationship: () => defaultRoleForRelationship
});
module.exports = __toCommonJS(index_exports);

// src/common/index.ts
var import_zod = require("zod");
var RupiahSchema = import_zod.z.number().int().nonnegative();
var CONTRACTS_VERSION = "0.0.0";

// src/auth/index.ts
var import_zod2 = require("zod");
var LoginInputSchema = import_zod2.z.object({
  email: import_zod2.z.string().email(),
  password: import_zod2.z.string().min(8)
});
var AuthUserSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  name: import_zod2.z.string(),
  email: import_zod2.z.string().email()
});

// src/accounts/index.ts
var import_zod3 = require("zod");
var AccountTypeSchema = import_zod3.z.enum([
  "bank",
  "ewallet",
  "cash",
  "investment",
  "property"
]);
var CreateAccountInputSchema = import_zod3.z.object({
  name: import_zod3.z.string().min(1),
  type: AccountTypeSchema,
  institution: import_zod3.z.string().optional(),
  maskedNumber: import_zod3.z.string().optional(),
  balance: import_zod3.z.number().int(),
  currency: import_zod3.z.string().default("IDR"),
  isPrivate: import_zod3.z.boolean().optional(),
  // EPIC-019 Task A — owning member's user id; omit for family-shared.
  ownerUserId: import_zod3.z.string().uuid().optional()
});
var UpdateAccountInputSchema = CreateAccountInputSchema.partial().extend({
  // Overrides the inherited (non-nullable) optional field: `null` explicitly
  // clears ownership back to family-shared; `undefined` (omitted) leaves it
  // unchanged.
  ownerUserId: import_zod3.z.string().uuid().nullable().optional()
});
var AccountOwnerFilterSchema = import_zod3.z.enum(["me", "family", "all"]);
var AccountDtoSchema = import_zod3.z.object({
  id: import_zod3.z.string(),
  familyGroupId: import_zod3.z.string(),
  name: import_zod3.z.string(),
  type: AccountTypeSchema,
  institution: import_zod3.z.string().nullable(),
  maskedNumber: import_zod3.z.string().nullable(),
  balance: import_zod3.z.string(),
  currency: import_zod3.z.string(),
  isPrivate: import_zod3.z.boolean(),
  ownerUserId: import_zod3.z.string().nullable(),
  ownerName: import_zod3.z.string().nullable(),
  createdAt: import_zod3.z.string(),
  updatedAt: import_zod3.z.string()
});

// src/allowance-requests/index.ts
var import_zod4 = require("zod");
var AllowanceRequestStatusSchema = import_zod4.z.enum([
  "pending",
  "approved",
  "rejected"
]);
var AllowanceRequestKindSchema = import_zod4.z.enum(["funding", "held_expense"]);
var CreateAllowanceRequestInputSchema = import_zod4.z.object({
  targetAccountId: import_zod4.z.string().uuid(),
  amount: import_zod4.z.number().int().positive(),
  note: import_zod4.z.string().optional()
});
var ApproveAllowanceRequestInputSchema = import_zod4.z.object({
  // EPIC-023 Task D (D3/D9) — required only to approve a `funding` request;
  // a `held_expense` request already carries its own account and needs no
  // choice at approval time.
  fromAccountId: import_zod4.z.string().uuid().optional()
});
var RejectAllowanceRequestInputSchema = import_zod4.z.object({
  reason: import_zod4.z.string().optional()
});
var AllowanceRequestDtoSchema = import_zod4.z.object({
  id: import_zod4.z.string(),
  kind: AllowanceRequestKindSchema,
  familyGroupId: import_zod4.z.string(),
  requesterUserId: import_zod4.z.string(),
  requesterName: import_zod4.z.string(),
  targetAccountId: import_zod4.z.string(),
  targetAccountName: import_zod4.z.string(),
  fromAccountId: import_zod4.z.string().nullable(),
  fromAccountName: import_zod4.z.string().nullable(),
  amount: import_zod4.z.string(),
  note: import_zod4.z.string().nullable(),
  // EPIC-023 Task D (D3/D9) — held_expense only; always null for funding.
  categoryId: import_zod4.z.string().nullable(),
  categoryName: import_zod4.z.string().nullable(),
  description: import_zod4.z.string().nullable(),
  status: AllowanceRequestStatusSchema,
  createdAt: import_zod4.z.string(),
  decidedAt: import_zod4.z.string().nullable(),
  decidedByUserId: import_zod4.z.string().nullable(),
  decidedByName: import_zod4.z.string().nullable()
});
var HeldExpenseResponseSchema = import_zod4.z.object({
  held: import_zod4.z.literal(true),
  allowanceRequestId: import_zod4.z.string(),
  amount: import_zod4.z.string()
});

// src/members/index.ts
var import_zod5 = require("zod");
var MemberRelationshipSchema = import_zod5.z.enum([
  "istri",
  "anak",
  "kakek",
  "nenek",
  "bibi",
  "supir",
  "sekretaris",
  "bendahara"
]);
var RoleSchema = import_zod5.z.enum([
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
var import_zod6 = require("zod");
var CategoryKindSchema = import_zod6.z.enum(["income", "expense"]);
var CategoryDtoSchema = import_zod6.z.object({
  id: import_zod6.z.string().uuid(),
  familyGroupId: import_zod6.z.string().uuid(),
  name: import_zod6.z.string(),
  kind: CategoryKindSchema,
  // EPIC-017: mandatory COA link (same family group).
  coaAccountId: import_zod6.z.string().uuid(),
  color: import_zod6.z.string().nullable(),
  icon: import_zod6.z.string().nullable(),
  isPrivate: import_zod6.z.boolean(),
  createdAt: import_zod6.z.string()
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
var import_zod7 = require("zod");
var TransactionTypeSchema = import_zod7.z.enum(["income", "expense", "transfer"]);
var CreateTransactionInputSchema = import_zod7.z.object({
  accountId: import_zod7.z.string().uuid(),
  categoryId: import_zod7.z.string().uuid().optional(),
  amount: import_zod7.z.number().int().positive(),
  type: TransactionTypeSchema,
  description: import_zod7.z.string().optional(),
  occurredAt: import_zod7.z.string(),
  toAccountId: import_zod7.z.string().uuid().optional(),
  // EPIC-021 Group B #28 — e-wallet top-up admin fee. Only meaningful when
  // type = transfer with a toAccountId; deducted from the DESTINATION
  // account as a separate linked expense (see transactions.service.ts).
  adminFee: import_zod7.z.number().int().min(0).optional()
});
var TransactionDtoSchema = import_zod7.z.object({
  id: import_zod7.z.string().uuid(),
  familyGroupId: import_zod7.z.string().uuid(),
  // EPIC-023 E3 (D12) — null for a credit-card purchase (it touches no
  // account); see liabilityId instead.
  accountId: import_zod7.z.string().uuid().nullable(),
  toAccountId: import_zod7.z.string().uuid().nullable(),
  categoryId: import_zod7.z.string().uuid().nullable(),
  // EPIC-023 E1/E3 — set for a liability payment or a credit-card purchase.
  liabilityId: import_zod7.z.string().uuid().nullable(),
  amount: import_zod7.z.string(),
  type: TransactionTypeSchema,
  description: import_zod7.z.string().nullable(),
  categoryName: import_zod7.z.string().nullable(),
  accountName: import_zod7.z.string(),
  toAccountName: import_zod7.z.string().nullable(),
  occurredAt: import_zod7.z.string(),
  createdAt: import_zod7.z.string()
});
var TransactionSummarySchema = import_zod7.z.object({
  totalIncome: import_zod7.z.string(),
  totalExpense: import_zod7.z.string(),
  netBalance: import_zod7.z.string(),
  period: import_zod7.z.object({
    from: import_zod7.z.string().nullable(),
    to: import_zod7.z.string().nullable()
  })
});
var TransactionListResponseSchema = import_zod7.z.object({
  data: import_zod7.z.array(TransactionDtoSchema),
  meta: import_zod7.z.object({
    total: import_zod7.z.number(),
    page: import_zod7.z.number(),
    limit: import_zod7.z.number()
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
var import_zod8 = require("zod");
var SetMemberCategoryAllowanceInputSchema = import_zod8.z.object({
  categoryIds: import_zod8.z.array(import_zod8.z.string().uuid())
});
var AllowedCategoryDtoSchema = import_zod8.z.object({
  id: import_zod8.z.string(),
  name: import_zod8.z.string()
});
var MemberCategoryAllowanceDtoSchema = import_zod8.z.object({
  memberId: import_zod8.z.string(),
  // Empty = unrestricted (backward compatible default for every member).
  categories: import_zod8.z.array(AllowedCategoryDtoSchema)
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AccountDtoSchema,
  AccountOwnerFilterSchema,
  AccountTypeSchema,
  AllowanceRequestDtoSchema,
  AllowanceRequestKindSchema,
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
  HeldExpenseResponseSchema,
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
});
