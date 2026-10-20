/**
 * Amount model of the top up / withdraw dialog (2026-10-20 hotfix).
 *
 * The user enters what LANDS (in the pocket for a top up, in the account
 * for a withdrawal) and an optional admin fee kept separate. The dialog
 * derives what the API expects:
 *
 *   sourceAmount = sent + fee   (total that leaves the source)
 *   destAmount   = landed       (net that arrives)
 *
 * Same currency: sent = landed. Cross currency: the user also enters what
 * was sent (excluding the fee) and the actual rate. The fee is never
 * subtracted from what the user said landed.
 */
import { amount } from "./investment-fields";
import {
  add,
  decimal,
  multiply,
  positive,
  roundWhole,
  subtract,
} from "./decimal";

export type FieldKey = "bank" | "pocket" | "sent" | "amount" | "rate" | "fee";

export type FieldError =
  | "chooseBank"
  | "choosePocket"
  | "sentRequired"
  | "amountRequired"
  | "rateRequired"
  | "feeTooHigh"
  | "insufficient";

export interface TransferInputs {
  bankId: string;
  pocketId: string;
  sourceCur: string;
  cross: boolean;
  amountRaw: string;
  sentRaw: string;
  feeRaw: string;
  rateRaw: string;
  /** IDR per unit of the source currency from the market snapshot. */
  snapshotRate: string | undefined;
  sourceBefore: string | null | undefined;
  destBefore: string | null | undefined;
  /** Balances are current, so only a transfer dated today is checked. */
  checkBalance: boolean;
}

export interface TransferPlan {
  /** Native amounts, canonical decimal strings. */
  landed: string;
  sent: string;
  fee: string;
  rate: string;
  sourceTotal: string;
  validFx: boolean;
  /** IDR effects shown in the summary (null when not computable). */
  totalIdr: string | null;
  feeIdr: string | null;
  creditIdr: string | null;
  sourceAfter: string | null;
  destAfter: string | null;
  errors: Partial<Record<FieldKey, FieldError>>;
}

const less = (a: string, b: string) => decimal(a) < decimal(b);

export function planTransfer(i: TransferInputs): TransferPlan {
  const landed = amount(i.amountRaw);
  const fee = amount(i.feeRaw);
  const sent = i.cross ? amount(i.sentRaw) : landed;
  const rate = amount(i.rateRaw);
  const sourceTotal = add(sent, fee);
  const fx = i.cross ? rate : i.snapshotRate;
  const validFx = i.sourceCur === "IDR" || positive(fx ?? "0");

  let totalIdr: string | null = null;
  let feeIdr: string | null = null;
  if (validFx) {
    // Mirrors computePocketTransferAmounts (API) so the preview matches
    // what gets booked: source −total, destination +total −fee.
    feeIdr = i.sourceCur === "IDR" ? fee : roundWhole(multiply(fee, fx ?? "0"));
    totalIdr =
      i.sourceCur === "IDR"
        ? sourceTotal
        : i.cross
          ? add(landed, feeIdr)
          : roundWhole(multiply(sourceTotal, fx ?? "0"));
  }
  const creditIdr =
    totalIdr !== null && feeIdr !== null ? subtract(totalIdr, feeIdr) : null;
  const sourceAfter =
    i.sourceBefore == null || totalIdr === null
      ? null
      : subtract(i.sourceBefore, totalIdr);
  const destAfter =
    i.destBefore == null || creditIdr === null
      ? null
      : add(i.destBefore, creditIdr);

  const errors: TransferPlan["errors"] = {};
  if (!i.bankId) errors.bank = "chooseBank";
  if (!i.pocketId) errors.pocket = "choosePocket";
  const first: FieldKey = i.cross ? "sent" : "amount";
  if (i.cross && !positive(sent)) errors.sent = "sentRequired";
  if (!positive(landed)) errors.amount = "amountRequired";
  if (i.cross && !positive(rate)) errors.rate = "rateRequired";
  if (positive(fee) && positive(sent) && !less(fee, sent)) {
    errors.fee = "feeTooHigh";
  }
  if (
    !errors[first] &&
    i.checkBalance &&
    sourceAfter !== null &&
    positive(sent) &&
    decimal(sourceAfter) < BigInt(0)
  ) {
    errors[first] = "insufficient";
  }
  return {
    landed,
    sent,
    fee,
    rate,
    sourceTotal,
    validFx,
    totalIdr,
    feeIdr,
    creditIdr,
    sourceAfter,
    destAfter,
    errors,
  };
}

/** Field order on screen — the first invalid one gets focus on submit. */
export function fieldOrder(cross: boolean): FieldKey[] {
  return cross
    ? ["bank", "pocket", "sent", "amount", "rate", "fee"]
    : ["bank", "pocket", "amount", "fee"];
}

/** Errors worth showing before the field is touched (they need a value). */
export const LIVE_ERRORS: ReadonlySet<FieldError> = new Set<FieldError>([
  "feeTooHigh",
  "insufficient",
]);
