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
import { z as z4 } from "zod";

// src/accounts/banking.ts
import { z as z3 } from "zod";
var BankInstitutionKindSchema = z3.enum([
  "commercial",
  "digital",
  "sharia",
  "rural",
  "foreign_branch",
  "foreign"
]);
var BankProductKindSchema = z3.enum([
  "savings",
  "current",
  "time_deposit",
  "planned_savings",
  "multi_currency"
]);
var AccountOwnershipFormSchema = z3.enum(["individual", "joint", "qq"]);
var AccountStatusSchema = z3.enum([
  "active",
  "dormant",
  "blocked",
  "closed"
]);
var ShariaContractSchema = z3.enum(["wadiah", "mudharabah"]);
var DepositInterestPayoutSchema = z3.enum(["at_maturity", "monthly"]);
var DepositMaturityInstructionSchema = z3.enum([
  "aro",
  "aro_plus",
  "non_aro"
]);
var RoutingCodeKindSchema = z3.enum([
  "bank_code",
  "iban",
  "aba",
  "bsb"
]);
var INDONESIA = {
  code: "ID",
  currency: "IDR",
  routingKind: "bank_code",
  insurer: "LPS",
  insuranceCap: 2e9
};
var BANK_COUNTRIES = [
  INDONESIA,
  {
    code: "SG",
    currency: "SGD",
    routingKind: "bank_code",
    insurer: "SDIC",
    insuranceCap: 1e5
  },
  {
    code: "US",
    currency: "USD",
    routingKind: "aba",
    insurer: "FDIC",
    insuranceCap: 25e4
  },
  {
    code: "AU",
    currency: "AUD",
    routingKind: "bsb",
    insurer: "FCS",
    insuranceCap: 25e4
  },
  {
    code: "JP",
    currency: "JPY",
    routingKind: "bank_code",
    insurer: "DICJ",
    insuranceCap: 1e7
  },
  {
    code: "CN",
    currency: "CNY",
    routingKind: "bank_code",
    insurer: "DIS",
    insuranceCap: 5e5
  },
  {
    code: "DE",
    currency: "EUR",
    routingKind: "iban",
    insurer: "EdB",
    insuranceCap: 1e5
  },
  {
    code: "NL",
    currency: "EUR",
    routingKind: "iban",
    insurer: "DGS",
    insuranceCap: 1e5
  },
  {
    code: "FR",
    currency: "EUR",
    routingKind: "iban",
    insurer: "FGDR",
    insuranceCap: 1e5
  }
];
function bankCountry(code) {
  return BANK_COUNTRIES.find((c) => c.code === (code ?? "ID").toUpperCase()) ?? INDONESIA;
}
var ID_INTEREST_TAX_RATE = 0.2;
var ID_INTEREST_TAX_FREE_BALANCE = 75e5;
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addMonthsUtc(iso, months) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return isoDate(target);
}
function nextMaturityDate(placementDate, tenorMonths, instruction, today) {
  if (!placementDate || !tenorMonths || tenorMonths <= 0) return null;
  let periods = 1;
  let maturity = addMonthsUtc(placementDate, tenorMonths);
  if (instruction === "non_aro") return maturity;
  while (maturity < today && periods < 600) {
    periods += 1;
    maturity = addMonthsUtc(placementDate, tenorMonths * periods);
  }
  return maturity;
}
function daysBetween(fromIso, toIso) {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 864e5
  );
}
function estimateNetInterest(balance, ratePct, months, taxed = true) {
  if (!(balance > 0) || !(ratePct > 0) || !(months > 0)) return 0;
  const gross = balance * (ratePct / 100) * months / 12;
  const withheld = taxed && balance > ID_INTEREST_TAX_FREE_BALANCE ? gross * ID_INTEREST_TAX_RATE : 0;
  return Math.round(gross - withheld);
}

// src/investments/platforms.ts
var INVESTMENT_PRODUCT_KEYS = [
  "saham_idx",
  "saham_us",
  "reksa_dana",
  "obligasi",
  "emas",
  "kripto",
  "deposito"
];
var POCKET_KINDS = ["rdn", "crypto", "usd", "general"];
var CUSTOM_PLATFORM_KEY = "custom";
var INVESTMENT_PLATFORMS = [
  {
    key: "ajaib",
    name: "Ajaib",
    country: "ID",
    color: "#1E5EFF",
    mark: "Aj",
    // Saham, reksa dana and saham AS (via Ajaib Alpha, Feb 2025) per
    // ajaib.co.id. Kripto is a separate app (Ajaib Kripto — record it under
    // "custom") and obligasi could not be verified, so both are left out.
    // Fractional US shares not confirmed.
    products: ["saham_idx", "saham_us", "reksa_dana"],
    pockets: ["rdn", "general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://ajaib.co.id"
  },
  {
    key: "stockbit",
    name: "Stockbit Sekuritas",
    country: "ID",
    color: "#00AB6B",
    mark: "Sb",
    // Only Indonesian equities confirmed (stockbit.com could not be read).
    products: ["saham_idx"],
    pockets: ["rdn"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://stockbit.com"
  },
  {
    key: "ipot",
    name: "IPOT (Indo Premier Sekuritas)",
    country: "ID",
    color: "#E31E24",
    mark: "IP",
    // Saham/ETF, reksa dana (IPOT Fund) and obligasi (IPOT Bond). US shares
    // and gold were not confirmed.
    products: ["saham_idx", "reksa_dana", "obligasi"],
    pockets: ["rdn"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.indopremier.com"
  },
  {
    key: "bibit",
    name: "Bibit",
    country: "ID",
    color: "#00A85A",
    mark: "Bi",
    // bibit.id: reksa dana, SBN ritel, obligasi FR, saham.
    products: ["saham_idx", "reksa_dana", "obligasi"],
    pockets: ["rdn", "general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://bibit.id"
  },
  {
    key: "bareksa",
    name: "Bareksa",
    country: "ID",
    color: "#0F9D58",
    mark: "Bk",
    // bareksa.com (re-checked 2026-10-19): Saham, Reksa Dana, SBN, Emas.
    products: ["saham_idx", "reksa_dana", "obligasi", "emas"],
    pockets: ["general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.bareksa.com"
  },
  {
    key: "gotrade",
    name: "Gotrade",
    country: "ID",
    color: "#111827",
    mark: "Gt",
    // heygotrade.com/id: 600+ US stocks and ETFs, fractional from $1.
    products: ["saham_us"],
    pockets: ["usd"],
    fractionalUsShares: true,
    syncMode: "manual",
    source: "https://www.heygotrade.com/id"
  },
  {
    key: "pluang",
    name: "Pluang",
    country: "ID",
    color: "#2F54EB",
    mark: "Pl",
    // pluang.com: saham ID, fractional saham AS, kripto, reksa dana, emas.
    products: ["saham_idx", "saham_us", "reksa_dana", "emas", "kripto"],
    pockets: ["general"],
    fractionalUsShares: true,
    syncMode: "manual",
    source: "https://pluang.com"
  },
  {
    key: "pintu",
    name: "Pintu",
    country: "ID",
    color: "#0A68F4",
    mark: "Pi",
    // pintu.co.id: crypto only.
    products: ["kripto"],
    pockets: ["crypto"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://pintu.co.id"
  },
  {
    key: "indodax",
    name: "Indodax",
    country: "ID",
    color: "#1B3B6F",
    mark: "Id",
    products: ["kripto"],
    pockets: ["crypto"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://indodax.com"
  },
  {
    key: "tokocrypto",
    name: "Tokocrypto",
    country: "ID",
    color: "#0B1E3F",
    mark: "Tk",
    // tokocrypto.com: crypto only.
    products: ["kripto"],
    pockets: ["crypto"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.tokocrypto.com"
  },
  {
    key: "pegadaian",
    name: "Pegadaian",
    country: "ID",
    color: "#00753A",
    mark: "Pg",
    // pegadaian.co.id: Tabungan Emas, Cicil Emas.
    products: ["emas"],
    pockets: ["general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.pegadaian.co.id"
  },
  {
    key: CUSTOM_PLATFORM_KEY,
    name: "Platform lain",
    country: "ID",
    color: "#64748B",
    mark: "+",
    // A user-named platform may hold anything; the user is the source.
    products: INVESTMENT_PRODUCT_KEYS,
    pockets: POCKET_KINDS,
    fractionalUsShares: true,
    syncMode: "manual",
    source: null
  }
];
function findInvestmentPlatform(key) {
  return INVESTMENT_PLATFORMS.find((p) => p.key === key);
}

// src/accounts/index.ts
var PocketKindSchema = z4.enum(POCKET_KINDS);
var AccountTypeSchema = z4.enum([
  "bank",
  "ewallet",
  "cash",
  "investment",
  "property"
]);
var CreateAccountInputSchema = z4.object({
  name: z4.string().min(1),
  type: AccountTypeSchema,
  institution: z4.string().optional(),
  maskedNumber: z4.string().optional(),
  balance: z4.number().int(),
  currency: z4.string().default("IDR"),
  isPrivate: z4.boolean().optional(),
  // EPIC-019 Task A — owning member's user id; omit for family-shared.
  ownerUserId: z4.string().uuid().optional(),
  // Investasi R2 — only for type "investment" (service-checked).
  platformAccountId: z4.string().uuid().optional(),
  pocketKind: PocketKindSchema.optional()
});
var UpdateAccountInputSchema = CreateAccountInputSchema.partial().extend({
  // Overrides the inherited (non-nullable) optional field: `null` explicitly
  // clears ownership back to family-shared; `undefined` (omitted) leaves it
  // unchanged.
  ownerUserId: z4.string().uuid().nullable().optional()
});
var AccountOwnerFilterSchema = z4.enum(["me", "family", "all"]);
var AccountDtoSchema = z4.object({
  id: z4.string(),
  familyGroupId: z4.string(),
  name: z4.string(),
  type: AccountTypeSchema,
  institution: z4.string().nullable(),
  maskedNumber: z4.string().nullable(),
  /** null when the viewer's "Lihat saldo" is off (see balancesHidden). */
  balance: z4.string().nullable(),
  currency: z4.string(),
  isPrivate: z4.boolean(),
  ownerUserId: z4.string().nullable(),
  ownerName: z4.string().nullable(),
  createdAt: z4.string(),
  updatedAt: z4.string(),
  balancesHidden: z4.boolean().optional(),
  // ── Rekening v3 — optional so older fixtures/callers still type-check ──
  country: z4.string().optional(),
  institutionKind: BankInstitutionKindSchema.nullable().optional(),
  isSharia: z4.boolean().optional(),
  bankCode: z4.string().nullable().optional(),
  swiftCode: z4.string().nullable().optional(),
  routingCode: z4.string().nullable().optional(),
  routingCodeKind: RoutingCodeKindSchema.nullable().optional(),
  productKind: BankProductKindSchema.nullable().optional(),
  productName: z4.string().nullable().optional(),
  holderUserId: z4.string().nullable().optional(),
  /** Display name for "Atas nama": the holder member's name, else the typed name. */
  holderName: z4.string().nullable().optional(),
  ownershipForm: AccountOwnershipFormSchema.optional(),
  status: AccountStatusSchema.optional(),
  openingBalance: z4.string().nullable().optional(),
  openingBalanceDate: z4.string().nullable().optional(),
  interestRate: z4.number().nullable().optional(),
  shariaContract: ShariaContractSchema.nullable().optional(),
  branch: z4.string().nullable().optional(),
  isPrimary: z4.boolean().optional(),
  notes: z4.string().nullable().optional(),
  reportInTaxReturn: z4.boolean().optional(),
  storageLocation: z4.string().nullable().optional(),
  includeInNetWorth: z4.boolean().optional(),
  /** ISO timestamp of the last "Cocokkan saldo", or null. */
  lastReconciledAt: z4.string().nullable().optional(),
  /** Investasi R2 — the platform account this pocket belongs to. */
  platformAccountId: z4.string().nullable().optional(),
  pocketKind: PocketKindSchema.nullable().optional(),
  beneficiaryUserId: z4.string().nullable().optional(),
  beneficiaryName: z4.string().nullable().optional(),
  depositNumber: z4.string().nullable().optional(),
  placementDate: z4.string().nullable().optional(),
  tenorMonths: z4.number().nullable().optional(),
  interestPayout: DepositInterestPayoutSchema.nullable().optional(),
  maturityInstruction: DepositMaturityInstructionSchema.nullable().optional(),
  payoutAccountId: z4.string().nullable().optional(),
  maturityReminder: z4.boolean().optional(),
  shares: z4.array(
    z4.object({
      userId: z4.string(),
      name: z4.string(),
      canPost: z4.boolean()
    })
  ).optional(),
  /** Date (yyyy-mm-dd) of the latest transaction on either leg, or null. */
  lastActivityAt: z4.string().nullable().optional()
});
var AccountShareInputSchema = z4.object({
  userId: z4.string().min(1),
  canPost: z4.boolean()
});

// src/allowance-requests/index.ts
import { z as z5 } from "zod";
var AllowanceRequestStatusSchema = z5.enum([
  "pending",
  "approved",
  "rejected"
]);
var AllowanceRequestKindSchema = z5.enum(["funding", "held_expense"]);
var CreateAllowanceRequestInputSchema = z5.object({
  targetAccountId: z5.string().uuid(),
  amount: z5.number().int().positive(),
  note: z5.string().optional()
});
var ApproveAllowanceRequestInputSchema = z5.object({
  // EPIC-023 Task D (D3/D9) — required only to approve a `funding` request;
  // a `held_expense` request already carries its own account and needs no
  // choice at approval time.
  fromAccountId: z5.string().uuid().optional()
});
var RejectAllowanceRequestInputSchema = z5.object({
  reason: z5.string().optional()
});
var AllowanceRequestDtoSchema = z5.object({
  id: z5.string(),
  kind: AllowanceRequestKindSchema,
  familyGroupId: z5.string(),
  requesterUserId: z5.string(),
  requesterName: z5.string(),
  targetAccountId: z5.string(),
  targetAccountName: z5.string(),
  fromAccountId: z5.string().nullable(),
  fromAccountName: z5.string().nullable(),
  amount: z5.string(),
  note: z5.string().nullable(),
  // EPIC-023 Task D (D3/D9) — held_expense only; always null for funding.
  categoryId: z5.string().nullable(),
  categoryName: z5.string().nullable(),
  description: z5.string().nullable(),
  status: AllowanceRequestStatusSchema,
  createdAt: z5.string(),
  decidedAt: z5.string().nullable(),
  decidedByUserId: z5.string().nullable(),
  decidedByName: z5.string().nullable()
});
var HeldExpenseResponseSchema = z5.object({
  held: z5.literal(true),
  allowanceRequestId: z5.string(),
  amount: z5.string()
});

// src/members/index.ts
import { z as z6 } from "zod";
var MemberRelationshipSchema = z6.enum([
  "istri",
  "anak",
  "kakek",
  "nenek",
  "bibi",
  "supir",
  "sekretaris",
  "bendahara"
]);
var RoleSchema = z6.enum([
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
import { z as z7 } from "zod";
var CategoryKindSchema = z7.enum(["income", "expense"]);
var CategoryDtoSchema = z7.object({
  id: z7.string().uuid(),
  familyGroupId: z7.string().uuid(),
  name: z7.string(),
  kind: CategoryKindSchema,
  // EPIC-017: mandatory COA link (same family group).
  coaAccountId: z7.string().uuid(),
  color: z7.string().nullable(),
  icon: z7.string().nullable(),
  isPrivate: z7.boolean(),
  createdAt: z7.string()
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
import { z as z8 } from "zod";
var TransactionTypeSchema = z8.enum(["income", "expense", "transfer"]);
var CreateTransactionInputSchema = z8.object({
  accountId: z8.string().uuid(),
  categoryId: z8.string().uuid().optional(),
  amount: z8.number().int().positive(),
  type: TransactionTypeSchema,
  description: z8.string().optional(),
  occurredAt: z8.string(),
  toAccountId: z8.string().uuid().optional(),
  // EPIC-021 Group B #28 — e-wallet top-up admin fee. Only meaningful when
  // type = transfer with a toAccountId; deducted from the DESTINATION
  // account as a separate linked expense (see transactions.service.ts).
  adminFee: z8.number().int().min(0).optional()
});
var TransactionDtoSchema = z8.object({
  id: z8.string().uuid(),
  familyGroupId: z8.string().uuid(),
  // EPIC-023 E3 (D12) — null for a credit-card purchase (it touches no
  // account); see liabilityId instead.
  accountId: z8.string().uuid().nullable(),
  toAccountId: z8.string().uuid().nullable(),
  categoryId: z8.string().uuid().nullable(),
  // EPIC-023 E1/E3 — set for a liability payment or a credit-card purchase.
  liabilityId: z8.string().uuid().nullable(),
  // EPIC-023 E1 / group E retry (MEDIUM 6) — set for an insurance premium
  // payment, symmetric with liabilityId above.
  insuranceId: z8.string().uuid().nullable(),
  amount: z8.string(),
  type: TransactionTypeSchema,
  description: z8.string().nullable(),
  categoryName: z8.string().nullable(),
  // EPIC-023 Task E retry (MEDIUM 5) — was `z.string()` even though
  // `accountId` beside it went nullable for a card purchase (E3): a
  // service-layer `?? ""` laundered the "no account" case into an empty
  // string, which reads as blank data everywhere the DTO is displayed. Now
  // consistently `null` — see the service-layer `toDto`/mapper functions
  // this schema documents.
  accountName: z8.string().nullable(),
  toAccountName: z8.string().nullable(),
  occurredAt: z8.string(),
  createdAt: z8.string(),
  // Edit-rights decision 2026-09-28 ("Pembuat + pemilik rekening") — whether
  // the CURRENT viewer may PATCH/DELETE this row: its creator, or the owner
  // of a private account on either leg. Everyone else (incl. Master/
  // Co-Master) is read-only.
  canModify: z8.boolean()
});
var TransactionSummarySchema = z8.object({
  totalIncome: z8.string(),
  totalExpense: z8.string(),
  netBalance: z8.string(),
  period: z8.object({
    from: z8.string().nullable(),
    to: z8.string().nullable()
  })
});
var TransactionListResponseSchema = z8.object({
  data: z8.array(TransactionDtoSchema),
  meta: z8.object({
    total: z8.number(),
    page: z8.number(),
    limit: z8.number()
  }),
  summary: TransactionSummarySchema
});

// src/goals/index.ts
import { z as z9 } from "zod";
var GoalContributionSourceSchema = z9.enum(["manual", "auto"]);
var CreateGoalContributionInputSchema = z9.object({
  amount: z9.string().regex(/^[1-9]\d{0,11}$/),
  accountId: z9.string().uuid().optional(),
  occurredAt: z9.string().datetime().optional()
});
var GoalContributionDtoSchema = z9.object({
  id: z9.string(),
  goalId: z9.string(),
  amount: z9.string(),
  accountId: z9.string().nullable(),
  accountName: z9.string().nullable(),
  transactionId: z9.string().nullable(),
  occurredAt: z9.string(),
  source: GoalContributionSourceSchema,
  createdAt: z9.string()
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

// src/investments/investment.dto.ts
var LEGACY_RESIDUAL_NOTE = "legacy-residual";

// src/investments/markets.ts
var INVESTMENT_MARKET_KEYS = [
  "IDX",
  "NASDAQ",
  "NYSE",
  "CRYPTO",
  "MUTUAL_FUND_ID",
  "BOND_ID",
  "GOLD",
  "DEPOSIT",
  "OTHER"
];
var MARKETS = {
  IDX: {
    key: "IDX",
    label: "Bursa Efek Indonesia",
    country: "ID",
    currency: "IDR",
    lotSize: 100,
    allowFractionDefault: false,
    quantityDecimals: 0,
    settlementDays: 2,
    settlementBusinessDays: true,
    baseUnit: "lembar",
    displayUnit: "lot",
    priceUnitLabel: "per lembar",
    staleAfterDays: 3
  },
  NASDAQ: {
    key: "NASDAQ",
    label: "NASDAQ",
    country: "US",
    currency: "USD",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 6,
    settlementDays: 1,
    settlementBusinessDays: true,
    baseUnit: "share",
    displayUnit: "share",
    priceUnitLabel: "per share",
    staleAfterDays: 3
  },
  NYSE: {
    key: "NYSE",
    label: "NYSE",
    country: "US",
    currency: "USD",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 6,
    settlementDays: 1,
    settlementBusinessDays: true,
    baseUnit: "share",
    displayUnit: "share",
    priceUnitLabel: "per share",
    staleAfterDays: 3
  },
  CRYPTO: {
    key: "CRYPTO",
    label: "Aset kripto",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 8,
    settlementDays: 0,
    settlementBusinessDays: false,
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "per unit",
    staleAfterDays: 1
  },
  MUTUAL_FUND_ID: {
    key: "MUTUAL_FUND_ID",
    label: "Reksa dana Indonesia",
    country: "ID",
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 4,
    settlementDays: 0,
    settlementBusinessDays: true,
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "NAB per unit",
    staleAfterDays: 3
  },
  BOND_ID: {
    key: "BOND_ID",
    label: "Obligasi Indonesia",
    country: "ID",
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 0,
    settlementDays: null,
    settlementBusinessDays: true,
    // Quantity keeps the convention of existing obligasi rows; the price
    // convention (% of par vs per unit, clean/dirty) lives in
    // InvestmentDetails.bond.priceConvention.
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "per unit",
    staleAfterDays: 7
  },
  GOLD: {
    key: "GOLD",
    label: "Emas",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 4,
    settlementDays: null,
    settlementBusinessDays: false,
    baseUnit: "gram",
    displayUnit: "gram",
    priceUnitLabel: "per gram",
    staleAfterDays: 3
  },
  DEPOSIT: {
    key: "DEPOSIT",
    label: "Deposito",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 0,
    settlementDays: null,
    settlementBusinessDays: true,
    // Legacy deposito rows store quantity = 1 and costBasisPerUnit = nominal.
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "nominal",
    staleAfterDays: null
  },
  OTHER: {
    key: "OTHER",
    label: "Lainnya",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 8,
    settlementDays: null,
    settlementBusinessDays: false,
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "per unit",
    staleAfterDays: 30
  }
};
function effectiveMarketFor(type, market, currency) {
  if (market) return market;
  switch (type) {
    case "saham":
      return currency === "IDR" ? "IDX" : "NASDAQ";
    case "kripto":
      return "CRYPTO";
    case "reksa_dana":
      return "MUTUAL_FUND_ID";
    case "obligasi":
      return "BOND_ID";
    case "emas":
      return "GOLD";
    case "deposito":
      return "DEPOSIT";
    default:
      return "OTHER";
  }
}

// src/investments/valuation.ts
var INVESTMENT_VALUATION_BASES = [
  "market",
  "manual",
  "stale",
  "cost_basis",
  "unpriced",
  "failed",
  "zero_valid"
];
var PRICED_VALUATION_BASES = [
  "market",
  "manual",
  "stale",
  "cost_basis",
  "zero_valid"
];
var AUTOMATED_PRICE_SOURCES = [
  "yahoo-finance",
  "coingecko",
  "emasantam"
];
var SIMULATED_PRICE_SOURCE = "mock";
var MANUAL_PRICE_SOURCES = [
  "manual",
  "broker_statement",
  "fund_factsheet",
  "bank_statement",
  "exchange_website",
  "other"
];

// src/member-category-allowances/index.ts
import { z as z10 } from "zod";
var SetMemberCategoryAllowanceInputSchema = z10.object({
  categoryIds: z10.array(z10.string().uuid())
});
var AllowedCategoryDtoSchema = z10.object({
  id: z10.string(),
  name: z10.string()
});
var MemberCategoryAllowanceDtoSchema = z10.object({
  memberId: z10.string(),
  // Empty = unrestricted (backward compatible default for every member).
  categories: z10.array(AllowedCategoryDtoSchema)
});

// src/insurances/index.ts
var INSURANCE_STATUSES = [
  "aktif",
  "masa_tenggang",
  "lapse",
  "berakhir",
  "dibatalkan",
  "tidak_aktif",
  "kadaluarsa"
];
var PREMIUM_PERIODS = [
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
  "single",
  "custom"
];
var INSURANCE_POLICY_TYPES = [
  "traditional",
  "unit_link"
];
var INSURANCE_BENEFIT_KINDS = [
  "life_sum_assured",
  "health_annual_limit",
  "per_event",
  "daily",
  "critical_illness",
  "accident",
  "other"
];
var INSURANCE_BENEFIT_PERIODS = [
  "per_year",
  "per_event",
  "per_day",
  "per_policy_term",
  "lifetime"
];
var INSURANCE_VALUATION_STATUSES = ["ai_extracted", "needs_confirmation", "confirmed"];

// src/reference-items/index.ts
import { z as z11 } from "zod";
var ReferenceItemGroupSchema = z11.enum([
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
var CreateReferenceItemDtoSchema = z11.object({
  group: ReferenceItemGroupSchema,
  label: z11.string().min(1).max(100)
});
var ReferenceItemDtoSchema = z11.object({
  id: z11.string().uuid(),
  familyGroupId: z11.string().uuid(),
  group: ReferenceItemGroupSchema,
  label: z11.string(),
  sortOrder: z11.number().int(),
  isSystem: z11.boolean(),
  createdAt: z11.string()
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
import { z as z12 } from "zod";
var TransactionAttachmentDtoSchema = z12.object({
  id: z12.string().uuid(),
  transactionId: z12.string().uuid(),
  mimeType: z12.string(),
  size: z12.number().int().nonnegative(),
  createdAt: z12.string()
});
var ATTACHMENT_MAX_FILE_BYTES = 5 * 1024 * 1024;
var ATTACHMENT_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

// src/access/index.ts
import { z as z13 } from "zod";
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
var AccessPageSchema = z13.enum(ACCESS_PAGES);
var ALWAYS_OPEN_PAGES = [
  "akun",
  "akses-saya",
  "notifikasi",
  "panduan"
];
var ACCESS_LEVELS = ["none", "view", "manage"];
var AccessLevelSchema = z13.enum(ACCESS_LEVELS);
var AccessDataScopeSchema = z13.enum(["all", "own"]);
var AccessPermissionsSchema = z13.record(z13.string(), AccessLevelSchema).transform((raw) => {
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
var AccessRoleInputSchema = z13.object({
  name: z13.string().trim().min(1).max(60),
  description: z13.string().trim().max(200).nullable().optional(),
  dataScope: AccessDataScopeSchema,
  permissions: AccessPermissionsSchema
});
var MemberAccessInputSchema = z13.object({
  /** null = no custom role (use the built-in role's preset). */
  accessRoleId: z13.string().min(1).nullable(),
  /** Sparse overrides on top of the role; {} clears them. */
  overrides: AccessPermissionsSchema,
  /**
   * "Lihat saldo". Omit to leave unchanged. false = member can still record
   * transactions but never sees balance figures.
   */
  canViewBalances: z13.boolean().optional()
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
import { z as z14 } from "zod";

// src/fx/currencies.ts
var FX_CURRENCY_CODES = [
  "IDR",
  "USD",
  "SGD",
  "EUR",
  "JPY",
  "AUD",
  "CNY",
  "GBP",
  "HKD",
  "MYR",
  "THB",
  "PHP",
  "KRW",
  "INR"
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
  CNY: 2,
  GBP: 2,
  HKD: 2,
  MYR: 2,
  THB: 2,
  PHP: 2,
  KRW: 0,
  INR: 2
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
var FxCurrencyCodeSchema = z14.enum(FX_CURRENCY_CODES);
var FxInputSchema = z14.object({
  field: z14.string().min(1).max(96),
  currency: FxCurrencyCodeSchema.exclude(["IDR"]),
  amount: z14.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/)
});
var FxRatesResponseSchema = z14.object({
  base: z14.string(),
  rates: z14.record(z14.number()),
  rateDate: z14.string(),
  source: z14.enum(["frankfurter", "indicative"]),
  stale: z14.boolean(),
  idrPerUnit: z14.record(z14.string())
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
export {
  ACCESS_LEVELS,
  ACCESS_PAGES,
  ACTIVE_REFERENCE_ITEM_GROUPS,
  ALWAYS_OPEN_PAGES,
  ASSET_CLASS_KEYS,
  ATTACHMENT_ACCEPTED_MIME_TYPES,
  ATTACHMENT_MAX_FILE_BYTES,
  AUTOMATED_PRICE_SOURCES,
  AccessDataScopeSchema,
  AccessLevelSchema,
  AccessPageSchema,
  AccessPermissionsSchema,
  AccessRoleInputSchema,
  AccountDtoSchema,
  AccountOwnerFilterSchema,
  AccountOwnershipFormSchema,
  AccountShareInputSchema,
  AccountStatusSchema,
  AccountTypeSchema,
  AllowanceRequestDtoSchema,
  AllowanceRequestKindSchema,
  AllowanceRequestStatusSchema,
  AllowedCategoryDtoSchema,
  ApproveAllowanceRequestInputSchema,
  AuthUserSchema,
  BANK_COUNTRIES,
  BankInstitutionKindSchema,
  BankProductKindSchema,
  CONTRACTS_VERSION,
  CUSTOM_PLATFORM_KEY,
  CategoryDtoSchema,
  CategoryKindSchema,
  CreateAccountInputSchema,
  CreateAllowanceRequestInputSchema,
  CreateGoalContributionInputSchema,
  CreateReferenceItemDtoSchema,
  CreateTransactionInputSchema,
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  DEFAULT_ROLE_BY_RELATIONSHIP,
  DepositInterestPayoutSchema,
  DepositMaturityInstructionSchema,
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
  ID_INTEREST_TAX_FREE_BALANCE,
  ID_INTEREST_TAX_RATE,
  INDONESIA,
  INSURANCE_BENEFIT_KINDS,
  INSURANCE_BENEFIT_PERIODS,
  INSURANCE_POLICY_TYPES,
  INSURANCE_STATUSES,
  INSURANCE_VALUATION_STATUSES,
  INVESTMENT_MARKET_KEYS,
  INVESTMENT_PLATFORMS,
  INVESTMENT_PRODUCT_KEYS,
  INVESTMENT_VALUATION_BASES,
  LEGACY_ACCESS_PRESETS,
  LEGACY_RESIDUAL_NOTE,
  LOGIN_USERNAME_PATTERN,
  LoginInputSchema,
  MANUAL_PRICE_SOURCES,
  MARKETS,
  MAX_LOGIN_USERNAME_LENGTH,
  MEMBER_USERNAME_PATTERN,
  MemberAccessInputSchema,
  MemberCategoryAllowanceDtoSchema,
  MemberRelationshipSchema,
  POCKET_KINDS,
  PREMIUM_PERIODS,
  PRICED_VALUATION_BASES,
  PocketKindSchema,
  REFERENCE_ITEM_DEFAULTS,
  ReferenceItemDtoSchema,
  ReferenceItemGroupSchema,
  RejectAllowanceRequestInputSchema,
  RoleSchema,
  RoutingCodeKindSchema,
  RupiahSchema,
  SIMULATED_PRICE_SOURCE,
  SetMemberCategoryAllowanceInputSchema,
  ShariaContractSchema,
  TransactionAttachmentDtoSchema,
  TransactionDtoSchema,
  TransactionListResponseSchema,
  TransactionSummarySchema,
  TransactionTypeSchema,
  UpdateAccountInputSchema,
  accountTypeToAssetClass,
  addMonthsUtc,
  assetTypeToAssetClass,
  bankCountry,
  buildFamilyLoginId,
  buildReferenceItemSeed,
  canAccessPage,
  convertToIdr,
  daysBetween,
  defaultCoaCodeForCategory,
  defaultRoleForRelationship,
  deriveIdrPerUnit,
  divRoundHalfUp,
  effectiveMarketFor,
  estimateNetInterest,
  findInvestmentPlatform,
  formatScaled,
  investmentTypeToAssetClass,
  isFamilyLoginId,
  isFxCurrency,
  isMasterOrCoMaster,
  isoDate,
  levelAtLeast,
  nextMaturityDate,
  parseMinor,
  parseScaled,
  resolveEffectiveAccess,
  slugifyHandleBase,
  warisanAssetTypeToAssetClass
};
