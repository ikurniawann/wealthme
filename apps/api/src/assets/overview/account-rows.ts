import { dbDateToYmd } from "../../investments/ledger/ledger-dates";

import { NO_CHANGE, ownerName, searchText } from "./overview-model";

import type { BuiltRow, RowContext } from "./overview-model";
import type { AccountStatus, AccountType } from "@prisma/client";
import type { AssetClass } from "@wealthme/contracts";

/** The account columns the overview reads (net-worth rule already applied). */
export interface OverviewAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: bigint;
  institution: string | null;
  maskedNumber: string | null;
  ownerUserId: string | null;
  platformAccountId: string | null;
  status: AccountStatus;
  openingBalanceDate: Date | null;
  placementDate: Date | null;
  storageLocation: string | null;
}

/**
 * A2 — accounts are "Dana & rekening", including an investment pocket
 * (Account.type=investment): platform cash is counted once, here, and never
 * again inside Investasi. Account.type=property keeps its meaning (a
 * recorded balance) but is classed as a physical asset and flagged as a
 * possible duplicate when a `properti` Asset exists (never auto-merged).
 */
function accountClass(type: AccountType): AssetClass {
  return type === "property" ? "aset_fisik" : "dana_rekening";
}

function accountHref(a: OverviewAccount): string {
  if (a.type === "cash" || a.type === "ewallet") return `/dana?account=${a.id}`;
  if (a.type === "investment") return `/investasi?pocket=${a.id}`;
  return `/rekening?account=${a.id}`;
}

export function accountRow(
  a: OverviewAccount,
  ctx: RowContext,
  duplicateWarning: boolean,
): BuiltRow {
  const value = a.balance.toString();
  const acquired = a.openingBalanceDate ?? a.placementDate;
  return {
    counted: true,
    search: searchText(a.name, a.institution, a.maskedNumber),
    dto: {
      id: `accounts:${a.id}`,
      name: a.name,
      internalCode: a.maskedNumber,
      ticker: null,
      class: accountClass(a.type),
      subtype: a.type,
      sourceModule: "accounts",
      sourceId: a.id,
      sources: [{ module: "accounts", id: a.id, href: accountHref(a) }],
      ownerUserId: a.ownerUserId,
      ownerName: ownerName(ctx, a.ownerUserId),
      custodian: a.institution ?? a.storageLocation,
      platformAccountId: a.platformAccountId,
      quantity: null,
      unit: null,
      acquisition: {
        date: acquired ? dbDateToYmd(acquired) : null,
        multiple: false,
      },
      status: a.status === "closed" ? "archived" : "active",
      // A recorded balance is a user-maintained figure; zero is a real zero.
      valuationBasis: a.balance === 0n ? "zero_valid" : "manual",
      valueIdr: value,
      displayValue: ctx.display(value),
      displayCurrency: ctx.displayCurrency,
      netWorthValueIdr: value,
      costBasisIdr: null,
      price: null,
      change: NO_CHANGE,
      unrealizedPnlIdr: null,
      unrealizedPnlPercent: null,
      duplicateWarning,
    },
  };
}
