/**
 * Kas & E-Wallet — countries and the e-wallets people there actually use.
 * Each country carries its currency (what a wallet there holds) and the
 * kind of identifier the provider logs people in with, so the form can ask
 * for "Nomor HP" in Indonesia and "Email" for PayPal.
 */

export type WalletIdKind = "phone" | "email" | "id";

export interface WalletCountry {
  code: string;
  name: { id: string; en: string };
  currency: string;
  /** International dialling prefix, for phone-number hints. */
  dial: string;
}

export interface WalletProvider {
  key: string;
  name: string;
  /** Country codes; "*" = available almost everywhere. */
  countries: readonly string[];
  color: string;
  /** Two- or three-letter mark shown on the brand tile. */
  mark: string;
  idKind: WalletIdKind;
}

export const WALLET_COUNTRIES: readonly WalletCountry[] = [
  {
    code: "ID",
    name: { id: "Indonesia", en: "Indonesia" },
    currency: "IDR",
    dial: "+62",
  },
  {
    code: "SG",
    name: { id: "Singapura", en: "Singapore" },
    currency: "SGD",
    dial: "+65",
  },
  {
    code: "MY",
    name: { id: "Malaysia", en: "Malaysia" },
    currency: "MYR",
    dial: "+60",
  },
  {
    code: "TH",
    name: { id: "Thailand", en: "Thailand" },
    currency: "THB",
    dial: "+66",
  },
  {
    code: "PH",
    name: { id: "Filipina", en: "Philippines" },
    currency: "PHP",
    dial: "+63",
  },
  {
    code: "JP",
    name: { id: "Jepang", en: "Japan" },
    currency: "JPY",
    dial: "+81",
  },
  {
    code: "KR",
    name: { id: "Korea Selatan", en: "South Korea" },
    currency: "KRW",
    dial: "+82",
  },
  {
    code: "CN",
    name: { id: "Tiongkok", en: "China" },
    currency: "CNY",
    dial: "+86",
  },
  {
    code: "HK",
    name: { id: "Hong Kong", en: "Hong Kong" },
    currency: "HKD",
    dial: "+852",
  },
  {
    code: "IN",
    name: { id: "India", en: "India" },
    currency: "INR",
    dial: "+91",
  },
  {
    code: "AU",
    name: { id: "Australia", en: "Australia" },
    currency: "AUD",
    dial: "+61",
  },
  {
    code: "US",
    name: { id: "Amerika Serikat", en: "United States" },
    currency: "USD",
    dial: "+1",
  },
  {
    code: "GB",
    name: { id: "Inggris", en: "United Kingdom" },
    currency: "GBP",
    dial: "+44",
  },
  {
    code: "DE",
    name: { id: "Jerman", en: "Germany" },
    currency: "EUR",
    dial: "+49",
  },
  {
    code: "NL",
    name: { id: "Belanda", en: "Netherlands" },
    currency: "EUR",
    dial: "+31",
  },
  {
    code: "FR",
    name: { id: "Prancis", en: "France" },
    currency: "EUR",
    dial: "+33",
  },
];

export const WALLET_PROVIDERS: readonly WalletProvider[] = [
  // Indonesia
  {
    key: "gopay",
    name: "GoPay",
    countries: ["ID"],
    color: "#00AED6",
    mark: "GP",
    idKind: "phone",
  },
  {
    key: "ovo",
    name: "OVO",
    countries: ["ID"],
    color: "#4C3494",
    mark: "OVO",
    idKind: "phone",
  },
  {
    key: "dana",
    name: "DANA",
    countries: ["ID"],
    color: "#118EEA",
    mark: "DA",
    idKind: "phone",
  },
  {
    key: "shopeepay",
    name: "ShopeePay",
    countries: ["ID", "SG", "MY", "TH", "PH"],
    color: "#EE4D2D",
    mark: "SP",
    idKind: "phone",
  },
  {
    key: "linkaja",
    name: "LinkAja",
    countries: ["ID"],
    color: "#E82529",
    mark: "LA",
    idKind: "phone",
  },
  {
    key: "astrapay",
    name: "AstraPay",
    countries: ["ID"],
    color: "#1E4FA0",
    mark: "AP",
    idKind: "phone",
  },
  {
    key: "isaku",
    name: "i.saku",
    countries: ["ID"],
    color: "#0F5FA8",
    mark: "iS",
    idKind: "phone",
  },
  {
    key: "sakuku",
    name: "Sakuku",
    countries: ["ID"],
    color: "#005BAC",
    mark: "SK",
    idKind: "phone",
  },
  // Southeast Asia
  {
    key: "grabpay",
    name: "GrabPay",
    countries: ["SG", "MY", "PH"],
    color: "#00B14F",
    mark: "GR",
    idKind: "phone",
  },
  {
    key: "paylah",
    name: "DBS PayLah!",
    countries: ["SG"],
    color: "#E3001B",
    mark: "PL",
    idKind: "phone",
  },
  {
    key: "tng",
    name: "Touch 'n Go eWallet",
    countries: ["MY"],
    color: "#005ABB",
    mark: "TnG",
    idKind: "phone",
  },
  {
    key: "boost",
    name: "Boost",
    countries: ["MY"],
    color: "#EE2E24",
    mark: "BO",
    idKind: "phone",
  },
  {
    key: "truemoney",
    name: "TrueMoney",
    countries: ["TH"],
    color: "#F7941D",
    mark: "TM",
    idKind: "phone",
  },
  {
    key: "gcash",
    name: "GCash",
    countries: ["PH"],
    color: "#007CFF",
    mark: "GC",
    idKind: "phone",
  },
  {
    key: "maya",
    name: "Maya",
    countries: ["PH"],
    color: "#00B464",
    mark: "MY",
    idKind: "phone",
  },
  // East & South Asia
  {
    key: "paypay",
    name: "PayPay",
    countries: ["JP"],
    color: "#FF0033",
    mark: "PP",
    idKind: "phone",
  },
  {
    key: "rakutenpay",
    name: "Rakuten Pay",
    countries: ["JP"],
    color: "#BF0000",
    mark: "RP",
    idKind: "email",
  },
  {
    key: "suica",
    name: "Suica",
    countries: ["JP"],
    color: "#2E8B57",
    mark: "SU",
    idKind: "id",
  },
  {
    key: "kakaopay",
    name: "KakaoPay",
    countries: ["KR"],
    color: "#FFCD00",
    mark: "KP",
    idKind: "phone",
  },
  {
    key: "naverpay",
    name: "Naver Pay",
    countries: ["KR"],
    color: "#03C75A",
    mark: "NP",
    idKind: "id",
  },
  {
    key: "toss",
    name: "Toss",
    countries: ["KR"],
    color: "#0064FF",
    mark: "TS",
    idKind: "phone",
  },
  {
    key: "alipay",
    name: "Alipay",
    countries: ["CN", "HK"],
    color: "#1677FF",
    mark: "AL",
    idKind: "phone",
  },
  {
    key: "wechatpay",
    name: "WeChat Pay",
    countries: ["CN", "HK"],
    color: "#07C160",
    mark: "WC",
    idKind: "phone",
  },
  {
    key: "octopus",
    name: "Octopus",
    countries: ["HK"],
    color: "#F28C00",
    mark: "OC",
    idKind: "id",
  },
  {
    key: "paytm",
    name: "Paytm",
    countries: ["IN"],
    color: "#00BAF2",
    mark: "PT",
    idKind: "phone",
  },
  {
    key: "phonepe",
    name: "PhonePe",
    countries: ["IN"],
    color: "#5F259F",
    mark: "PE",
    idKind: "phone",
  },
  // West
  {
    key: "venmo",
    name: "Venmo",
    countries: ["US"],
    color: "#008CFF",
    mark: "VE",
    idKind: "email",
  },
  {
    key: "cashapp",
    name: "Cash App",
    countries: ["US", "GB"],
    color: "#00D632",
    mark: "$",
    idKind: "id",
  },
  {
    key: "applecash",
    name: "Apple Cash",
    countries: ["US"],
    color: "#111111",
    mark: "AC",
    idKind: "phone",
  },
  {
    key: "monzo",
    name: "Monzo",
    countries: ["GB"],
    color: "#FF4F40",
    mark: "MO",
    idKind: "email",
  },
  {
    key: "beem",
    name: "Beem",
    countries: ["AU"],
    color: "#6E3CF0",
    mark: "BE",
    idKind: "phone",
  },
  // Global
  {
    key: "paypal",
    name: "PayPal",
    countries: ["*"],
    color: "#003087",
    mark: "PP",
    idKind: "email",
  },
  {
    key: "wise",
    name: "Wise",
    countries: ["*"],
    color: "#163300",
    mark: "W",
    idKind: "email",
  },
  {
    key: "revolut",
    name: "Revolut",
    countries: ["SG", "AU", "JP", "US", "GB", "DE", "NL", "FR"],
    color: "#191C1F",
    mark: "R",
    idKind: "phone",
  },
];

const BY_CODE = new Map(WALLET_COUNTRIES.map((c) => [c.code, c]));

export function walletCountry(code: string | null | undefined): WalletCountry {
  return BY_CODE.get((code ?? "ID").toUpperCase()) ?? WALLET_COUNTRIES[0]!;
}

/** Local providers first (in directory order), then the global ones. */
export function providersForCountry(code: string): WalletProvider[] {
  const local = WALLET_PROVIDERS.filter((p) => p.countries.includes(code));
  const global = WALLET_PROVIDERS.filter(
    (p) => p.countries.includes("*") && !local.includes(p),
  );
  return [...local, ...global];
}

export function findProvider(
  name: string | null | undefined,
): WalletProvider | undefined {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return undefined;
  return WALLET_PROVIDERS.find(
    (p) => p.name.toLowerCase() === n || p.key === n,
  );
}

/** "+62 812 •••• 9012" / "c•••@mail.com" — enough to recognise, not to reuse. */
export function maskIdentifier(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (v.includes("@")) {
    const [user, domain] = v.split("@");
    return `${(user ?? "").slice(0, 1)}•••@${domain ?? ""}`;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 6) return `••${digits.slice(-4)}`;
  return v.length > 4 ? `••${v.slice(-4)}` : v;
}
