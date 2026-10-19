import type { BankInstitutionKind } from "@wealthme/contracts";

/**
 * Rekening v3 — banks the form recognises, so picking one fills in its
 * institution type, domestic clearing code and SWIFT/BIC, and offers its
 * own product names. Every filled value stays editable in the form: this is
 * a convenience, not an authority. Clearing codes are Bank Indonesia's
 * 3-digit "sandi bank"; codes and BICs were compiled from the banks' public
 * transfer details and should be corrected in the form if a bank changes
 * them.
 */
export interface KnownBank {
  /** Display name stored as `Account.institution`. */
  name: string;
  /** Short label for the logo chip. */
  short: string;
  /** Lower-case substrings that identify this bank in a typed name. */
  match: readonly string[];
  country: string;
  kind: BankInstitutionKind;
  isSharia?: boolean;
  bankCode?: string;
  swift?: string;
  color: string;
  products: readonly string[];
}

const GENERIC_ID_PRODUCTS = ["Tabungan", "Giro", "Deposito Berjangka"];

export const KNOWN_BANKS: readonly KnownBank[] = [
  {
    name: "BCA",
    short: "BCA",
    match: ["bca", "central asia"],
    country: "ID",
    kind: "commercial",
    bankCode: "014",
    swift: "CENAIDJA",
    color: "#0066AE",
    products: [
      "Tahapan",
      "Tahapan Xpresi",
      "Tahapan Gold",
      "TabunganKu",
      "Tahapan Berjangka",
      "Tabungan Valas",
      "Giro BCA",
      "Deposito Berjangka",
    ],
  },
  {
    name: "Mandiri",
    short: "MDR",
    match: ["mandiri"],
    country: "ID",
    kind: "commercial",
    bankCode: "008",
    swift: "BMRIIDJA",
    color: "#003D79",
    products: [
      "Mandiri Tabungan",
      "Tabungan NOW",
      "Mandiri Tabungan Rencana",
      "Giro Mandiri",
      "Deposito Rupiah",
    ],
  },
  {
    name: "BRI",
    short: "BRI",
    match: ["bri", "rakyat indonesia"],
    country: "ID",
    kind: "commercial",
    bankCode: "002",
    swift: "BRINIDJA",
    color: "#00529C",
    products: [
      "BritAma",
      "Simpedes",
      "BritAma Rencana",
      "Giro BRI",
      "Deposito BRI",
    ],
  },
  {
    name: "BNI",
    short: "BNI",
    match: ["bni", "negara indonesia"],
    country: "ID",
    kind: "commercial",
    bankCode: "009",
    swift: "BNINIDJA",
    color: "#F05A22",
    products: [
      "BNI Taplus",
      "BNI Taplus Muda",
      "BNI Taplus Bisnis",
      "Giro BNI",
      "Deposito BNI",
    ],
  },
  {
    name: "CIMB Niaga",
    short: "CIMB",
    match: ["cimb"],
    country: "ID",
    kind: "commercial",
    bankCode: "022",
    swift: "BNIAIDJA",
    color: "#7A1F2B",
    products: ["Tabungan Xtra", "OCTO Savers", "Giro CIMB", "Deposito CIMB"],
  },
  {
    name: "Permata",
    short: "PRM",
    match: ["permata"],
    country: "ID",
    kind: "commercial",
    bankCode: "013",
    swift: "BBBAIDJA",
    color: "#00A4A6",
    products: GENERIC_ID_PRODUCTS,
  },
  {
    name: "Danamon",
    short: "DNM",
    match: ["danamon"],
    country: "ID",
    kind: "commercial",
    bankCode: "011",
    swift: "BDINIDJA",
    color: "#005EB8",
    products: GENERIC_ID_PRODUCTS,
  },
  {
    name: "BTN",
    short: "BTN",
    match: ["btn", "tabungan negara"],
    country: "ID",
    kind: "commercial",
    bankCode: "200",
    color: "#00529C",
    products: GENERIC_ID_PRODUCTS,
  },
  {
    name: "OCBC Indonesia",
    short: "OCBC",
    match: ["ocbc nisp", "ocbc indonesia"],
    country: "ID",
    kind: "commercial",
    bankCode: "028",
    swift: "NISPIDJA",
    color: "#D71920",
    products: GENERIC_ID_PRODUCTS,
  },
  {
    name: "Panin",
    short: "PNB",
    match: ["panin"],
    country: "ID",
    kind: "commercial",
    bankCode: "019",
    swift: "PINBIDJA",
    color: "#004B8D",
    products: GENERIC_ID_PRODUCTS,
  },
  {
    name: "Maybank Indonesia",
    short: "MBB",
    match: ["maybank"],
    country: "ID",
    kind: "commercial",
    bankCode: "016",
    swift: "IBBKIDJA",
    color: "#F2B705",
    products: GENERIC_ID_PRODUCTS,
  },
  {
    name: "BSI",
    short: "BSI",
    match: ["bsi", "syariah indonesia"],
    country: "ID",
    kind: "sharia",
    isSharia: true,
    bankCode: "451",
    swift: "BSMDIDJA",
    color: "#00A39D",
    products: [
      "BSI Tabungan Easy Wadiah",
      "BSI Tabungan Easy Mudharabah",
      "BSI Deposito",
    ],
  },
  {
    name: "Bank Muamalat",
    short: "BMI",
    match: ["muamalat"],
    country: "ID",
    kind: "sharia",
    isSharia: true,
    bankCode: "147",
    swift: "MUABIDJA",
    color: "#5B2C83",
    products: ["Tabungan iB Hijrah", "Deposito iB Hijrah"],
  },
  {
    name: "BCA Syariah",
    short: "BCAS",
    match: ["bca syariah"],
    country: "ID",
    kind: "sharia",
    isSharia: true,
    bankCode: "536",
    color: "#0066AE",
    products: ["Tahapan iB", "Deposito iB"],
  },
  {
    name: "Bank Jago",
    short: "JAGO",
    match: ["jago"],
    country: "ID",
    kind: "digital",
    bankCode: "542",
    color: "#F9A01B",
    products: ["Kantong Jago", "Deposito Jago"],
  },
  {
    name: "SeaBank",
    short: "SEA",
    match: ["seabank"],
    country: "ID",
    kind: "digital",
    bankCode: "535",
    color: "#FF5722",
    products: ["SeaBank Tabungan", "Deposito SeaBank"],
  },
  {
    name: "blu by BCA Digital",
    short: "blu",
    match: ["blu", "bca digital"],
    country: "ID",
    kind: "digital",
    bankCode: "501",
    color: "#00B2E3",
    products: ["bluSaving", "bluDeposito"],
  },
  {
    name: "Allo Bank",
    short: "ALLO",
    match: ["allo"],
    country: "ID",
    kind: "digital",
    bankCode: "567",
    color: "#E4002B",
    products: ["Tabungan Allo", "Deposito Allo"],
  },
  {
    name: "Jenius (SMBC Indonesia)",
    short: "JEN",
    match: ["jenius", "btpn", "smbc"],
    country: "ID",
    kind: "digital",
    bankCode: "213",
    swift: "SUNIIDJA",
    color: "#00B0CA",
    products: ["Jenius Flexi Saver", "Jenius Dream Saver", "Maxi Saver"],
  },
  {
    name: "HSBC Indonesia",
    short: "HSBC",
    match: ["hsbc indonesia"],
    country: "ID",
    kind: "foreign_branch",
    bankCode: "087",
    swift: "HSBCIDJA",
    color: "#DB0011",
    products: GENERIC_ID_PRODUCTS,
  },
  // ── Foreign ──────────────────────────────────────────────────────────────
  {
    name: "DBS Bank",
    short: "DBS",
    match: ["dbs"],
    country: "SG",
    kind: "foreign",
    bankCode: "7171",
    swift: "DBSSSGSG",
    color: "#E1251B",
    products: ["My Account", "Multiplier", "Fixed Deposit"],
  },
  {
    name: "OCBC Singapore",
    short: "OCBC",
    match: ["ocbc singapore", "ocbc sg"],
    country: "SG",
    kind: "foreign",
    bankCode: "7339",
    swift: "OCBCSGSG",
    color: "#D71920",
    products: ["360 Account", "Global Savings", "Fixed Deposit"],
  },
  {
    name: "UOB Singapore",
    short: "UOB",
    match: ["uob"],
    country: "SG",
    kind: "foreign",
    bankCode: "7375",
    swift: "UOVBSGSG",
    color: "#0B3B8C",
    products: ["One Account", "Global Currency Account", "Fixed Deposit"],
  },
  {
    name: "Chase",
    short: "CHS",
    match: ["chase", "jpmorgan"],
    country: "US",
    kind: "foreign",
    swift: "CHASUS33",
    color: "#117ACA",
    products: ["Total Checking", "Chase Savings", "CD"],
  },
  {
    name: "Bank of America",
    short: "BofA",
    match: ["bank of america", "bofa"],
    country: "US",
    kind: "foreign",
    swift: "BOFAUS3N",
    color: "#E31837",
    products: ["Advantage Checking", "Advantage Savings", "CD"],
  },
  {
    name: "Commonwealth Bank",
    short: "CBA",
    match: ["commonwealth", "commbank"],
    country: "AU",
    kind: "foreign",
    swift: "CTBAAU2S",
    color: "#FFCC00",
    products: ["Everyday Account", "NetBank Saver", "Term Deposit"],
  },
  {
    name: "MUFG Bank",
    short: "MUFG",
    match: ["mufg"],
    country: "JP",
    kind: "foreign",
    swift: "BOTKJPJT",
    color: "#D7000F",
    products: ["Ordinary Deposit", "Time Deposit"],
  },
  {
    name: "Bank of China",
    short: "BOC",
    match: ["bank of china"],
    country: "CN",
    kind: "foreign",
    swift: "BKCHCNBJ",
    color: "#B4001E",
    products: ["Current Deposit", "Time Deposit"],
  },
  {
    name: "ING",
    short: "ING",
    match: ["ing"],
    country: "NL",
    kind: "foreign",
    swift: "INGBNL2A",
    color: "#FF6200",
    products: ["Betaalrekening", "Spaarrekening", "Deposito"],
  },
  {
    name: "Deutsche Bank",
    short: "DB",
    match: ["deutsche bank"],
    country: "DE",
    kind: "foreign",
    swift: "DEUTDEFF",
    color: "#0018A8",
    products: ["Girokonto", "Sparkonto", "Festgeld"],
  },
];

/**
 * The known bank a stored/typed institution name refers to, or null. Longer
 * match strings are tried first, so "BCA Syariah" never resolves to BCA.
 */
export function findKnownBank(
  institution: string | null | undefined,
): KnownBank | null {
  if (!institution) return null;
  const lower = institution.toLowerCase().trim();
  const exact = KNOWN_BANKS.find((b) => b.name.toLowerCase() === lower);
  if (exact) return exact;
  let best: { bank: KnownBank; len: number } | null = null;
  for (const bank of KNOWN_BANKS) {
    for (const m of bank.match) {
      const hit =
        m.length <= 3
          ? new RegExp(`(^|[^a-z])${m}([^a-z]|$)`).test(lower)
          : lower.includes(m);
      if (hit && (!best || m.length > best.len)) best = { bank, len: m.length };
    }
  }
  return best?.bank ?? null;
}

/** Banks offered for a country, in directory order. */
export function banksForCountry(country: string): KnownBank[] {
  return KNOWN_BANKS.filter((b) => b.country === country);
}

/** Two- to four-letter logo label for any institution name. */
export function bankShortLabel(
  institution: string | null,
  fallback: string,
): string {
  const known = findKnownBank(institution);
  if (known) return known.short;
  const source = (institution || fallback).trim();
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  ).slice(0, 4);
}
