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
var AllowanceRequestKindSchema = z4.enum(["funding", "held_expense"]);
var CreateAllowanceRequestInputSchema = z4.object({
  targetAccountId: z4.string().uuid(),
  amount: z4.number().int().positive(),
  note: z4.string().optional()
});
var ApproveAllowanceRequestInputSchema = z4.object({
  // EPIC-023 Task D (D3/D9) — required only to approve a `funding` request;
  // a `held_expense` request already carries its own account and needs no
  // choice at approval time.
  fromAccountId: z4.string().uuid().optional()
});
var RejectAllowanceRequestInputSchema = z4.object({
  reason: z4.string().optional()
});
var AllowanceRequestDtoSchema = z4.object({
  id: z4.string(),
  kind: AllowanceRequestKindSchema,
  familyGroupId: z4.string(),
  requesterUserId: z4.string(),
  requesterName: z4.string(),
  targetAccountId: z4.string(),
  targetAccountName: z4.string(),
  fromAccountId: z4.string().nullable(),
  fromAccountName: z4.string().nullable(),
  amount: z4.string(),
  note: z4.string().nullable(),
  // EPIC-023 Task D (D3/D9) — held_expense only; always null for funding.
  categoryId: z4.string().nullable(),
  categoryName: z4.string().nullable(),
  description: z4.string().nullable(),
  status: AllowanceRequestStatusSchema,
  createdAt: z4.string(),
  decidedAt: z4.string().nullable(),
  decidedByUserId: z4.string().nullable(),
  decidedByName: z4.string().nullable()
});
var HeldExpenseResponseSchema = z4.object({
  held: z4.literal(true),
  allowanceRequestId: z4.string(),
  amount: z4.string()
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
  // EPIC-023 E3 (D12) — null for a credit-card purchase (it touches no
  // account); see liabilityId instead.
  accountId: z7.string().uuid().nullable(),
  toAccountId: z7.string().uuid().nullable(),
  categoryId: z7.string().uuid().nullable(),
  // EPIC-023 E1/E3 — set for a liability payment or a credit-card purchase.
  liabilityId: z7.string().uuid().nullable(),
  // EPIC-023 E1 / group E retry (MEDIUM 6) — set for an insurance premium
  // payment, symmetric with liabilityId above.
  insuranceId: z7.string().uuid().nullable(),
  amount: z7.string(),
  type: TransactionTypeSchema,
  description: z7.string().nullable(),
  categoryName: z7.string().nullable(),
  // EPIC-023 Task E retry (MEDIUM 5) — was `z.string()` even though
  // `accountId` beside it went nullable for a card purchase (E3): a
  // service-layer `?? ""` laundered the "no account" case into an empty
  // string, which reads as blank data everywhere the DTO is displayed. Now
  // consistently `null` — see the service-layer `toDto`/mapper functions
  // this schema documents.
  accountName: z7.string().nullable(),
  toAccountName: z7.string().nullable(),
  occurredAt: z7.string(),
  createdAt: z7.string(),
  // Edit-rights decision 2026-09-28 ("Pembuat + pemilik rekening") — whether
  // the CURRENT viewer may PATCH/DELETE this row: its creator, or the owner
  // of a private account on either leg. Everyone else (incl. Master/
  // Co-Master) is read-only.
  canModify: z7.boolean()
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

// src/goals/index.ts
import { z as z8 } from "zod";
var GoalContributionSourceSchema = z8.enum(["manual", "auto"]);
var CreateGoalContributionInputSchema = z8.object({
  amount: z8.string().regex(/^[1-9]\d{0,11}$/),
  accountId: z8.string().uuid().optional(),
  occurredAt: z8.string().datetime().optional()
});
var GoalContributionDtoSchema = z8.object({
  id: z8.string(),
  goalId: z8.string(),
  amount: z8.string(),
  accountId: z8.string().nullable(),
  accountName: z8.string().nullable(),
  transactionId: z8.string().nullable(),
  occurredAt: z8.string(),
  source: GoalContributionSourceSchema,
  createdAt: z8.string()
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
import { z as z9 } from "zod";
var SetMemberCategoryAllowanceInputSchema = z9.object({
  categoryIds: z9.array(z9.string().uuid())
});
var AllowedCategoryDtoSchema = z9.object({
  id: z9.string(),
  name: z9.string()
});
var MemberCategoryAllowanceDtoSchema = z9.object({
  memberId: z9.string(),
  // Empty = unrestricted (backward compatible default for every member).
  categories: z9.array(AllowedCategoryDtoSchema)
});

// src/reference-items/index.ts
import { z as z10 } from "zod";
var ReferenceItemGroupSchema = z10.enum([
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
var CreateReferenceItemDtoSchema = z10.object({
  group: ReferenceItemGroupSchema,
  label: z10.string().min(1).max(100)
});
var ReferenceItemDtoSchema = z10.object({
  id: z10.string().uuid(),
  familyGroupId: z10.string().uuid(),
  group: ReferenceItemGroupSchema,
  label: z10.string(),
  sortOrder: z10.number().int(),
  isSystem: z10.boolean(),
  createdAt: z10.string()
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
import { z as z11 } from "zod";
var TransactionAttachmentDtoSchema = z11.object({
  id: z11.string().uuid(),
  transactionId: z11.string().uuid(),
  mimeType: z11.string(),
  size: z11.number().int().nonnegative(),
  createdAt: z11.string()
});
var ATTACHMENT_MAX_FILE_BYTES = 5 * 1024 * 1024;
var ATTACHMENT_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

// src/access/index.ts
import { z as z12 } from "zod";
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
var AccessPageSchema = z12.enum(ACCESS_PAGES);
var ALWAYS_OPEN_PAGES = [
  "akun",
  "akses-saya",
  "notifikasi",
  "panduan"
];
var ACCESS_LEVELS = ["none", "view", "manage"];
var AccessLevelSchema = z12.enum(ACCESS_LEVELS);
var AccessDataScopeSchema = z12.enum(["all", "own"]);
var AccessPermissionsSchema = z12.record(z12.string(), AccessLevelSchema).transform((raw) => {
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
var AccessRoleInputSchema = z12.object({
  name: z12.string().trim().min(1).max(60),
  description: z12.string().trim().max(200).nullable().optional(),
  dataScope: AccessDataScopeSchema,
  permissions: AccessPermissionsSchema
});
var MemberAccessInputSchema = z12.object({
  /** null = no custom role (use the built-in role's preset). */
  accessRoleId: z12.string().min(1).nullable(),
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
import { z as z13 } from "zod";

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
var FxCurrencyCodeSchema = z13.enum(FX_CURRENCY_CODES);
var FxInputSchema = z13.object({
  field: z13.string().min(1).max(96),
  currency: FxCurrencyCodeSchema.exclude(["IDR"]),
  amount: z13.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/)
});
var FxRatesResponseSchema = z13.object({
  base: z13.string(),
  rates: z13.record(z13.number()),
  rateDate: z13.string(),
  source: z13.enum(["frankfurter", "indicative"]),
  stale: z13.boolean(),
  idrPerUnit: z13.record(z13.string())
});
export {
  ACCESS_LEVELS,
  ACCESS_PAGES,
  ACTIVE_REFERENCE_ITEM_GROUPS,
  ALWAYS_OPEN_PAGES,
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
  buildFamilyLoginId,
  buildReferenceItemSeed,
  canAccessPage,
  convertToIdr,
  defaultCoaCodeForCategory,
  defaultRoleForRelationship,
  deriveIdrPerUnit,
  divRoundHalfUp,
  formatScaled,
  isFamilyLoginId,
  isFxCurrency,
  isMasterOrCoMaster,
  levelAtLeast,
  parseMinor,
  parseScaled,
  resolveEffectiveAccess,
  slugifyHandleBase
};
