import { MARKETS } from "@wealthme/contracts";
import type {
  FxCurrencyCode,
  InvestmentDetails,
  InvestmentMarket,
  InvestmentType,
  CreateInvestmentLedgerInput,
} from "@wealthme/contracts";
import { amount, today } from "./investment-fields";
import { multiply, add, divide, positive, roundWhole } from "./decimal";

export interface PositionState {
  type: InvestmentType;
  market: InvestmentMarket;
  mode: "buy" | "opening";
  name: string;
  ticker: string;
  manual: boolean;
  priceSymbol: string;
  owner: string;
  platformId: string;
  pocketId: string;
  currency: FxCurrencyCode;
  unit: "lot" | "base";
  quantity: string;
  price: string;
  fee: string;
  tax: string;
  fx: string;
  date: string;
  time: string;
  timeZone: string;
  knownCost: boolean;
  note: string;
  details: Record<string, string>;
}
export function initialPosition(owner: string): PositionState {
  return {
    type: "saham",
    market: "IDX",
    mode: "buy",
    name: "",
    ticker: "",
    manual: false,
    priceSymbol: "",
    owner,
    platformId: "",
    pocketId: "",
    currency: "IDR",
    unit: "lot",
    quantity: "",
    price: "",
    fee: "0",
    tax: "0",
    fx: "",
    date: today(),
    time: "",
    timeZone: "Asia/Jakarta",
    knownCost: true,
    note: "",
    details: {
      priceConvention: "percent_of_par",
      valuationMethod: "manual_price",
      unit: "gram",
      form: "physical",
      rollover: "non_aro",
    },
  };
}
export function marketForType(type: InvestmentType): InvestmentMarket {
  return {
    saham: "IDX",
    reksa_dana: "MUTUAL_FUND_ID",
    obligasi: "BOND_ID",
    emas: "GOLD",
    kripto: "CRYPTO",
    deposito: "DEPOSIT",
    lainnya: "OTHER",
  }[type] as InvestmentMarket;
}
export function changeType(
  s: PositionState,
  type: InvestmentType,
): PositionState {
  const market = marketForType(type);
  return {
    ...s,
    type,
    market,
    currency: MARKETS[market].currency as FxCurrencyCode,
    unit: market === "IDX" ? "lot" : "base",
    platformId: "",
    pocketId: "",
    quantity: type === "deposito" ? "1" : "",
    details: { ...s.details, unit: type === "emas" ? "gram" : "unit" },
  };
}
export function positionNumbers(s: PositionState) {
  const quantity =
    s.type === "deposito"
      ? "1"
      : s.market === "IDX" && s.unit === "lot"
        ? multiply(amount(s.quantity), "100")
        : amount(s.quantity);
  const price = s.mode === "opening" && !s.knownCost ? "0" : amount(s.price);
  const gross =
    s.type === "obligasi" && s.details.priceConvention === "percent_of_par"
      ? divide(multiply(quantity, price), "100")
      : multiply(quantity, price);
  const debit = add(add(gross, amount(s.fee)), amount(s.tax));
  const debitIdr =
    s.currency === "IDR"
      ? roundWhole(debit)
      : positive(amount(s.fx))
        ? roundWhole(multiply(debit, amount(s.fx)))
        : null;
  return { quantity, price, gross, debit, debitIdr };
}
export function detailsForPosition(s: PositionState): InvestmentDetails {
  const d = s.details;
  if (s.type === "obligasi")
    return {
      bond: {
        instrumentCode: d.instrumentCode,
        issuer: d.issuer,
        principal: positionNumbers(s).quantity,
        priceConvention: d.priceConvention as "percent_of_par" | "per_unit",
        couponRatePct: d.couponRatePct,
        couponFrequency: d.couponFrequency
          ? Number(d.couponFrequency)
          : undefined,
        maturityDate: d.maturityDate,
        pricesIncludeAccrued: d.pricesIncludeAccrued === "true",
      },
    };
  if (s.type === "emas")
    return {
      gold: {
        form: d.form as "physical" | "digital",
        unit: d.unit,
        purity: d.purity,
        brand: d.brand,
      },
    };
  if (s.type === "deposito")
    return {
      deposit: {
        bankName: d.bankName,
        ratePct: d.ratePct,
        startDate: d.startDate || s.date,
        maturityDate: d.maturityDate,
        rollover: d.rollover as "aro" | "aro_plus" | "non_aro",
      },
    };
  if (s.type === "lainnya")
    return {
      other: {
        unit: d.unit,
        valuationMethod: d.valuationMethod as "fixed_cost" | "manual_price",
      },
    };
  return {};
}
export function positionBody(s: PositionState, key: string) {
  const n = positionNumbers(s);
  const entry: CreateInvestmentLedgerInput = {
    kind: s.mode,
    idempotencyKey: key,
    effectiveDate: s.date,
    effectiveTime: s.time || null,
    timeZone: s.time ? s.timeZone : null,
    quantity: n.quantity,
    pricePerUnit: n.price,
    grossAmount: n.gross,
    fee: amount(s.fee),
    tax: amount(s.tax),
    currency: s.currency,
    fxRate: s.currency === "IDR" ? undefined : amount(s.fx),
    cashAccountId: s.pocketId || null,
    note: s.note.trim() || null,
  };
  return {
    holding: {
      name: s.name.trim(),
      ticker: s.ticker.trim() || undefined,
      type: s.type,
      market: s.market,
      manualInstrument: s.manual,
      priceSymbol: s.priceSymbol.trim() || undefined,
      ownerUserId: s.owner || undefined,
      platformAccountId: s.platformId || undefined,
      details: detailsForPosition(s),
    },
    entry,
    costBasisKnown: s.mode === "opening" ? s.knownCost : true,
  };
}
