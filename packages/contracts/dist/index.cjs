"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
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
  ACCESS_LEVELS: () => ACCESS_LEVELS,
  ACCESS_PAGES: () => ACCESS_PAGES,
  ACTIVE_REFERENCE_ITEM_GROUPS: () => ACTIVE_REFERENCE_ITEM_GROUPS,
  ALWAYS_OPEN_PAGES: () => ALWAYS_OPEN_PAGES,
  ASSET_CLASS_KEYS: () => ASSET_CLASS_KEYS,
  ATTACHMENT_ACCEPTED_MIME_TYPES: () => ATTACHMENT_ACCEPTED_MIME_TYPES,
  ATTACHMENT_MAX_FILE_BYTES: () => ATTACHMENT_MAX_FILE_BYTES,
  AccessDataScopeSchema: () => AccessDataScopeSchema,
  AccessLevelSchema: () => AccessLevelSchema,
  AccessPageSchema: () => AccessPageSchema,
  AccessPermissionsSchema: () => AccessPermissionsSchema,
  AccessRoleInputSchema: () => AccessRoleInputSchema,
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
  CreateGoalContributionInputSchema: () => CreateGoalContributionInputSchema,
  CreateReferenceItemDtoSchema: () => CreateReferenceItemDtoSchema,
  CreateTransactionInputSchema: () => CreateTransactionInputSchema,
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT: () => DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  DEFAULT_ROLE_BY_RELATIONSHIP: () => DEFAULT_ROLE_BY_RELATIONSHIP,
  FAMILY_HANDLE_PATTERN: () => FAMILY_HANDLE_PATTERN,
  FOREIGN_FX_CURRENCY_CODES: () => FOREIGN_FX_CURRENCY_CODES,
  FX_CURRENCY_CODES: () => FX_CURRENCY_CODES,
  FX_CURRENCY_DECIMALS: () => FX_CURRENCY_DECIMALS,
  FX_RATE_SCALE: () => FX_RATE_SCALE,
  FxCurrencyCodeSchema: () => FxCurrencyCodeSchema,
  FxInputSchema: () => FxInputSchema,
  FxRatesResponseSchema: () => FxRatesResponseSchema,
  GENERIC_COA_CHART: () => GENERIC_COA_CHART,
  GoalContributionDtoSchema: () => GoalContributionDtoSchema,
  GoalContributionSourceSchema: () => GoalContributionSourceSchema,
  HeldExpenseResponseSchema: () => HeldExpenseResponseSchema,
  LEGACY_ACCESS_PRESETS: () => LEGACY_ACCESS_PRESETS,
  LOGIN_USERNAME_PATTERN: () => LOGIN_USERNAME_PATTERN,
  LoginInputSchema: () => LoginInputSchema,
  MAX_LOGIN_USERNAME_LENGTH: () => MAX_LOGIN_USERNAME_LENGTH,
  MEMBER_USERNAME_PATTERN: () => MEMBER_USERNAME_PATTERN,
  MemberAccessInputSchema: () => MemberAccessInputSchema,
  MemberCategoryAllowanceDtoSchema: () => MemberCategoryAllowanceDtoSchema,
  MemberRelationshipSchema: () => MemberRelationshipSchema,
  REFERENCE_ITEM_DEFAULTS: () => REFERENCE_ITEM_DEFAULTS,
  ReferenceItemDtoSchema: () => ReferenceItemDtoSchema,
  ReferenceItemGroupSchema: () => ReferenceItemGroupSchema,
  RejectAllowanceRequestInputSchema: () => RejectAllowanceRequestInputSchema,
  RoleSchema: () => RoleSchema,
  RupiahSchema: () => RupiahSchema,
  SetMemberCategoryAllowanceInputSchema: () => SetMemberCategoryAllowanceInputSchema,
  TransactionAttachmentDtoSchema: () => TransactionAttachmentDtoSchema,
  TransactionDtoSchema: () => TransactionDtoSchema,
  TransactionListResponseSchema: () => TransactionListResponseSchema,
  TransactionSummarySchema: () => TransactionSummarySchema,
  TransactionTypeSchema: () => TransactionTypeSchema,
  UpdateAccountInputSchema: () => UpdateAccountInputSchema,
  accountTypeToAssetClass: () => accountTypeToAssetClass,
  assetTypeToAssetClass: () => assetTypeToAssetClass,
  buildFamilyLoginId: () => buildFamilyLoginId,
  buildReferenceItemSeed: () => buildReferenceItemSeed,
  canAccessPage: () => canAccessPage,
  convertToIdr: () => convertToIdr,
  defaultCoaCodeForCategory: () => defaultCoaCodeForCategory,
  defaultRoleForRelationship: () => defaultRoleForRelationship,
  deriveIdrPerUnit: () => deriveIdrPerUnit,
  divRoundHalfUp: () => divRoundHalfUp,
  formatScaled: () => formatScaled,
  investmentTypeToAssetClass: () => investmentTypeToAssetClass,
  isFamilyLoginId: () => isFamilyLoginId,
  isFxCurrency: () => isFxCurrency,
  isMasterOrCoMaster: () => isMasterOrCoMaster,
  levelAtLeast: () => levelAtLeast,
  parseMinor: () => parseMinor,
  parseScaled: () => parseScaled,
  resolveEffectiveAccess: () => resolveEffectiveAccess,
  slugifyHandleBase: () => slugifyHandleBase,
  warisanAssetTypeToAssetClass: () => warisanAssetTypeToAssetClass
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
  // EPIC-032 R1 — istri is the Co-Master: full money reach, but member
  // management and family settings stay with the single head (owner).
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
  // EPIC-023 group E retry (HIGH 3) — a dedicated insurance-premium expense
  // account. `InsurancesService` used to reuse "20099" (the generic
  // catch-all `defaultCoaCodeForCategory` falls back to for ANY unmatched
  // expense category), which meant creating a policy silently hijacked
  // whatever user-made category/budget already lived on that shared
  // catch-all bucket. Never reuse a catch-all code for automatic behavior —
  // same precedent as "20009" above (A1/A2).
  {
    code: "20010",
    name: "Premi Asuransi",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "FIXED"
  },
  // Revisi K — a recorded KPR prepayment's penalty is a real expense with its
  // own account (never interest 20009, never the 20099 catch-all).
  {
    code: "20011",
    name: "Penalti Pelunasan Pinjaman",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE"
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
  // EPIC-023 E1 / group E retry (MEDIUM 6) — set for an insurance premium
  // payment, symmetric with liabilityId above.
  insuranceId: import_zod7.z.string().uuid().nullable(),
  amount: import_zod7.z.string(),
  type: TransactionTypeSchema,
  description: import_zod7.z.string().nullable(),
  categoryName: import_zod7.z.string().nullable(),
  // EPIC-023 Task E retry (MEDIUM 5) — was `z.string()` even though
  // `accountId` beside it went nullable for a card purchase (E3): a
  // service-layer `?? ""` laundered the "no account" case into an empty
  // string, which reads as blank data everywhere the DTO is displayed. Now
  // consistently `null` — see the service-layer `toDto`/mapper functions
  // this schema documents.
  accountName: import_zod7.z.string().nullable(),
  toAccountName: import_zod7.z.string().nullable(),
  occurredAt: import_zod7.z.string(),
  createdAt: import_zod7.z.string(),
  // Edit-rights decision 2026-09-28 ("Pembuat + pemilik rekening") — whether
  // the CURRENT viewer may PATCH/DELETE this row: its creator, or the owner
  // of a private account on either leg. Everyone else (incl. Master/
  // Co-Master) is read-only.
  canModify: import_zod7.z.boolean()
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

// src/goals/index.ts
var import_zod8 = require("zod");
var GoalContributionSourceSchema = import_zod8.z.enum(["manual", "auto"]);
var CreateGoalContributionInputSchema = import_zod8.z.object({
  amount: import_zod8.z.string().regex(/^[1-9]\d{0,11}$/),
  accountId: import_zod8.z.string().uuid().optional(),
  occurredAt: import_zod8.z.string().datetime().optional()
});
var GoalContributionDtoSchema = import_zod8.z.object({
  id: import_zod8.z.string(),
  goalId: import_zod8.z.string(),
  amount: import_zod8.z.string(),
  accountId: import_zod8.z.string().nullable(),
  accountName: import_zod8.z.string().nullable(),
  transactionId: import_zod8.z.string().nullable(),
  occurredAt: import_zod8.z.string(),
  source: GoalContributionSourceSchema,
  createdAt: import_zod8.z.string()
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
  emas: 0,
  // valued at the recorded figure; no appreciation assumed
  lainnya: 0
  // no assumption
};

// src/member-category-allowances/index.ts
var import_zod9 = require("zod");
var SetMemberCategoryAllowanceInputSchema = import_zod9.z.object({
  categoryIds: import_zod9.z.array(import_zod9.z.string().uuid())
});
var AllowedCategoryDtoSchema = import_zod9.z.object({
  id: import_zod9.z.string(),
  name: import_zod9.z.string()
});
var MemberCategoryAllowanceDtoSchema = import_zod9.z.object({
  memberId: import_zod9.z.string(),
  // Empty = unrestricted (backward compatible default for every member).
  categories: import_zod9.z.array(AllowedCategoryDtoSchema)
});

// src/reference-items/index.ts
var import_zod10 = require("zod");
var ReferenceItemGroupSchema = import_zod10.z.enum([
  "bank",
  "ewallet",
  "txntype",
  "invtype",
  "lembaga",
  "asettype",
  "instype"
]);
var ACTIVE_REFERENCE_ITEM_GROUPS = [
  "bank",
  "ewallet",
  "lembaga"
];
var CreateReferenceItemDtoSchema = import_zod10.z.object({
  group: ReferenceItemGroupSchema,
  label: import_zod10.z.string().min(1).max(100)
});
var ReferenceItemDtoSchema = import_zod10.z.object({
  id: import_zod10.z.string().uuid(),
  familyGroupId: import_zod10.z.string().uuid(),
  group: ReferenceItemGroupSchema,
  label: import_zod10.z.string(),
  sortOrder: import_zod10.z.number().int(),
  isSystem: import_zod10.z.boolean(),
  createdAt: import_zod10.z.string()
});
var REFERENCE_ITEM_DEFAULTS = {
  bank: ["BCA", "Mandiri", "BRI", "BNI", "CIMB", "OCBC"],
  ewallet: ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"],
  lembaga: ["BAZNAS", "Dompet Dhuafa", "Gereja / Paroki", "Pura / Vihara"]
};
function buildReferenceItemSeed() {
  return ACTIVE_REFERENCE_ITEM_GROUPS.flatMap(
    (group) => REFERENCE_ITEM_DEFAULTS[group].map((label, index) => ({
      group,
      label,
      sortOrder: index
    }))
  );
}

// src/attachments/index.ts
var import_zod11 = require("zod");
var TransactionAttachmentDtoSchema = import_zod11.z.object({
  id: import_zod11.z.string().uuid(),
  transactionId: import_zod11.z.string().uuid(),
  mimeType: import_zod11.z.string(),
  size: import_zod11.z.number().int().nonnegative(),
  createdAt: import_zod11.z.string()
});
var ATTACHMENT_MAX_FILE_BYTES = 5 * 1024 * 1024;
var ATTACHMENT_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

// src/access/index.ts
var import_zod12 = require("zod");
var ACCESS_PAGES = [
  "beranda",
  "ringkasan",
  "transaksi",
  "anggaran",
  "laporan",
  "tujuan",
  "dana",
  "rekening",
  "investasi",
  "aset",
  "liabilitas",
  "asuransi",
  "warisan",
  "donation",
  "tax",
  "persetujuan",
  "splitbill",
  "rekonsiliasi",
  "ai",
  "kalkulator",
  "mastercoa",
  "masterdata"
];
var AccessPageSchema = import_zod12.z.enum(ACCESS_PAGES);
var ALWAYS_OPEN_PAGES = [
  "akun",
  "akses-saya",
  "notifikasi",
  "panduan"
];
var ACCESS_LEVELS = ["none", "view", "manage"];
var AccessLevelSchema = import_zod12.z.enum(ACCESS_LEVELS);
var AccessDataScopeSchema = import_zod12.z.enum(["all", "own"]);
var AccessPermissionsSchema = import_zod12.z.record(import_zod12.z.string(), AccessLevelSchema).transform((raw) => {
  const clean = {};
  for (const [page, level] of Object.entries(raw)) {
    if (AccessPageSchema.safeParse(page).success) {
      clean[page] = level;
    }
  }
  return clean;
});
var all = (level) => Object.fromEntries(ACCESS_PAGES.map((p) => [p, level]));
var LEGACY_ACCESS_PRESETS = {
  // Everything except Persetujuan (ownerOnly in the nav) and IAM.
  spouse: {
    permissions: { ...all("manage"), persetujuan: "none" },
    dataScope: "all"
  },
  member: {
    permissions: {
      ...all("manage"),
      beranda: "view",
      ringkasan: "view",
      laporan: "view",
      dana: "view",
      rekening: "view",
      persetujuan: "none",
      ai: "view",
      kalkulator: "view",
      mastercoa: "view",
      masterdata: "view"
    },
    dataScope: "all"
  },
  // Bookkeeper: reads everything, works reconciliation and records transactions.
  admin_staff: {
    permissions: {
      ...all("view"),
      persetujuan: "none",
      rekonsiliasi: "manage",
      transaksi: "manage"
    },
    dataScope: "all"
  },
  dependant: {
    permissions: {
      transaksi: "manage",
      dana: "view",
      rekening: "view",
      warisan: "view"
    },
    dataScope: "own"
  },
  operational: {
    permissions: {
      transaksi: "manage",
      dana: "view",
      rekening: "view"
    },
    dataScope: "own"
  }
};
function isMasterOrCoMaster(role) {
  return role === "owner" || role === "spouse";
}
var LEVEL_RANK = { none: 0, view: 1, manage: 2 };
function levelAtLeast(have, need) {
  return LEVEL_RANK[have] >= LEVEL_RANK[need];
}
function resolveEffectiveAccess(input) {
  if (input.role === "owner") {
    return {
      isMaster: true,
      permissions: all("manage"),
      dataScope: "all",
      source: "master",
      hasOverrides: false,
      role: "owner"
    };
  }
  const base = input.accessRole ?? LEGACY_ACCESS_PRESETS[input.role];
  const permissions = Object.fromEntries(
    ACCESS_PAGES.map((page) => [
      page,
      input.overrides?.[page] ?? base.permissions[page] ?? "none"
    ])
  );
  return {
    isMaster: false,
    permissions,
    dataScope: base.dataScope,
    source: input.accessRole ? "custom-role" : "legacy",
    hasOverrides: Object.keys(input.overrides ?? {}).length > 0,
    role: input.role
  };
}
function canAccessPage(access, page, need = "view") {
  return access.isMaster || levelAtLeast(access.permissions[page], need);
}
var AccessRoleInputSchema = import_zod12.z.object({
  name: import_zod12.z.string().trim().min(1).max(60),
  description: import_zod12.z.string().trim().max(200).nullable().optional(),
  dataScope: AccessDataScopeSchema,
  permissions: AccessPermissionsSchema
});
var MemberAccessInputSchema = import_zod12.z.object({
  /** null = no custom role (use the built-in role's preset). */
  accessRoleId: import_zod12.z.string().min(1).nullable(),
  /** Sparse overrides on top of the role; {} clears them. */
  overrides: AccessPermissionsSchema
});

// src/family-login/index.ts
var MEMBER_USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
var FAMILY_HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$/;
var LOGIN_USERNAME_PATTERN = /^[a-z0-9_.]{3,30}(?:@[a-z0-9-]{3,24})?$/;
var MAX_LOGIN_USERNAME_LENGTH = 30 + 1 + 24;
function buildFamilyLoginId(username, handle) {
  return `${username.trim().toLowerCase()}@${handle.trim().toLowerCase()}`;
}
function isFamilyLoginId(input) {
  const value = input.trim().toLowerCase();
  return value.includes("@") && LOGIN_USERNAME_PATTERN.test(value);
}
function slugifyHandleBase(name) {
  const word = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").trim().split(/\s+/)[0];
  const base = (word ?? "").replace(/[^a-z0-9]/g, "").slice(0, 16);
  return base.length >= 3 ? base : "keluarga";
}

// src/fx/index.ts
var import_zod13 = require("zod");

// src/fx/currencies.ts
var FX_CURRENCY_CODES = [
  "IDR",
  "USD",
  "SGD",
  "EUR",
  "JPY",
  "AUD",
  "CNY"
];
var FOREIGN_FX_CURRENCY_CODES = FX_CURRENCY_CODES.filter(
  (c) => c !== "IDR"
);
var FX_CURRENCY_DECIMALS = {
  IDR: 0,
  USD: 2,
  SGD: 2,
  EUR: 2,
  JPY: 0,
  AUD: 2,
  CNY: 2
};
var FX_RATE_SCALE = 6;

// src/fx/money.ts
var DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;
function isFxCurrency(value) {
  return FX_CURRENCY_CODES.includes(value);
}
function parseScaled(value, scale) {
  const match = DECIMAL_RE.exec(value);
  if (!match) throw new RangeError(`"${value}" is not a decimal number`);
  const [, sign, intPart, frac = ""] = match;
  if (frac.length > scale) {
    throw new RangeError(`"${value}" has more than ${scale} decimal places`);
  }
  const magnitude = BigInt(`${intPart}${frac.padEnd(scale, "0")}`);
  return sign === "-" ? -magnitude : magnitude;
}
function parseMinor(amount, currency) {
  return parseScaled(amount, FX_CURRENCY_DECIMALS[currency]);
}
function divRoundHalfUp(n, d) {
  if (d <= 0n) throw new RangeError("divisor must be positive");
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const quotient = (magnitude * 2n + d) / (2n * d);
  return negative ? -quotient : quotient;
}
function formatScaled(value, scale) {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${body}` : body;
}
function convertToIdr(input) {
  const decimals = FX_CURRENCY_DECIMALS[input.currency];
  const minor = parseScaled(input.amount, decimals);
  if (input.currency === "IDR") return minor * 10n ** BigInt(input.targetScale);
  const rate = parseScaled(input.idrPerUnit, FX_RATE_SCALE);
  if (rate <= 0n)
    throw new RangeError(`rate for ${input.currency} must be positive`);
  const shift = decimals + FX_RATE_SCALE - input.targetScale;
  return divRoundHalfUp(minor * rate, 10n ** BigInt(shift));
}
function deriveIdrPerUnit(eurToIdr, eurToX) {
  const idr = parseScaled(eurToIdr, FX_RATE_SCALE);
  const x = parseScaled(eurToX, FX_RATE_SCALE);
  return formatScaled(
    divRoundHalfUp(idr * 10n ** BigInt(FX_RATE_SCALE), x),
    FX_RATE_SCALE
  );
}

// src/fx/index.ts
var FxCurrencyCodeSchema = import_zod13.z.enum(FX_CURRENCY_CODES);
var FxInputSchema = import_zod13.z.object({
  field: import_zod13.z.string().min(1).max(96),
  currency: FxCurrencyCodeSchema.exclude(["IDR"]),
  amount: import_zod13.z.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/)
});
var FxRatesResponseSchema = import_zod13.z.object({
  base: import_zod13.z.string(),
  rates: import_zod13.z.record(import_zod13.z.number()),
  rateDate: import_zod13.z.string(),
  source: import_zod13.z.enum(["frankfurter", "indicative"]),
  stale: import_zod13.z.boolean(),
  idrPerUnit: import_zod13.z.record(import_zod13.z.string())
});

// src/taxonomy/asset-class.ts
var ASSET_CLASS_KEYS = [
  "properti",
  "kendaraan",
  "kas_tabungan",
  "deposito",
  "saham",
  "reksa_dana",
  "obligasi",
  "emas",
  "kripto",
  "lainnya"
];
function assetTypeToAssetClass(type) {
  switch (type) {
    case "properti":
      return "properti";
    case "kendaraan":
      return "kendaraan";
    case "emas":
      return "emas";
    case "elektronik":
    case "perhiasan":
    case "lainnya":
    default:
      return "lainnya";
  }
}
function investmentTypeToAssetClass(type) {
  switch (type) {
    case "saham":
      return "saham";
    case "reksa_dana":
      return "reksa_dana";
    case "obligasi":
      return "obligasi";
    case "emas":
      return "emas";
    case "kripto":
      return "kripto";
    case "deposito":
      return "deposito";
    case "lainnya":
    default:
      return "lainnya";
  }
}
function accountTypeToAssetClass(type) {
  switch (type) {
    case "property":
      return "properti";
    case "bank":
    case "ewallet":
    case "cash":
    case "investment":
    default:
      return "kas_tabungan";
  }
}
function warisanAssetTypeToAssetClass(assetType) {
  const normalized = assetType.trim().toLowerCase();
  switch (normalized) {
    case "aset / properti":
    case "properti":
      return "properti";
    case "cash / tunai":
    case "kas & tabungan":
      return "kas_tabungan";
    case "surat berharga":
    case "obligasi/sbn":
    case "obligasi":
      return "obligasi";
    case "saham":
      return "saham";
    case "reksa dana":
      return "reksa_dana";
    case "kripto":
      return "kripto";
    case "deposito":
      return "deposito";
    case "kendaraan":
      return "kendaraan";
    case "emas":
      return "emas";
    case "lainnya":
    default:
      return "lainnya";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ACCESS_LEVELS,
  ACCESS_PAGES,
  ACTIVE_REFERENCE_ITEM_GROUPS,
  ALWAYS_OPEN_PAGES,
  ASSET_CLASS_KEYS,
  ATTACHMENT_ACCEPTED_MIME_TYPES,
  ATTACHMENT_MAX_FILE_BYTES,
  AccessDataScopeSchema,
  AccessLevelSchema,
  AccessPageSchema,
  AccessPermissionsSchema,
  AccessRoleInputSchema,
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
  CreateGoalContributionInputSchema,
  CreateReferenceItemDtoSchema,
  CreateTransactionInputSchema,
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  DEFAULT_ROLE_BY_RELATIONSHIP,
  FAMILY_HANDLE_PATTERN,
  FOREIGN_FX_CURRENCY_CODES,
  FX_CURRENCY_CODES,
  FX_CURRENCY_DECIMALS,
  FX_RATE_SCALE,
  FxCurrencyCodeSchema,
  FxInputSchema,
  FxRatesResponseSchema,
  GENERIC_COA_CHART,
  GoalContributionDtoSchema,
  GoalContributionSourceSchema,
  HeldExpenseResponseSchema,
  LEGACY_ACCESS_PRESETS,
  LOGIN_USERNAME_PATTERN,
  LoginInputSchema,
  MAX_LOGIN_USERNAME_LENGTH,
  MEMBER_USERNAME_PATTERN,
  MemberAccessInputSchema,
  MemberCategoryAllowanceDtoSchema,
  MemberRelationshipSchema,
  REFERENCE_ITEM_DEFAULTS,
  ReferenceItemDtoSchema,
  ReferenceItemGroupSchema,
  RejectAllowanceRequestInputSchema,
  RoleSchema,
  RupiahSchema,
  SetMemberCategoryAllowanceInputSchema,
  TransactionAttachmentDtoSchema,
  TransactionDtoSchema,
  TransactionListResponseSchema,
  TransactionSummarySchema,
  TransactionTypeSchema,
  UpdateAccountInputSchema,
  accountTypeToAssetClass,
  assetTypeToAssetClass,
  buildFamilyLoginId,
  buildReferenceItemSeed,
  canAccessPage,
  convertToIdr,
  defaultCoaCodeForCategory,
  defaultRoleForRelationship,
  deriveIdrPerUnit,
  divRoundHalfUp,
  formatScaled,
  investmentTypeToAssetClass,
  isFamilyLoginId,
  isFxCurrency,
  isMasterOrCoMaster,
  levelAtLeast,
  parseMinor,
  parseScaled,
  resolveEffectiveAccess,
  slugifyHandleBase,
  warisanAssetTypeToAssetClass
});
