import { jakartaTodayYmd } from "../../investments/ledger/ledger-dates";

import {
  historyToRow,
  holdingStateOf,
  loadState,
  timelineOf,
  toEventDto,
  toTransactionDto,
  userNames,
} from "./asset-ledger-support";
import {
  changeAt,
  compareHistory,
  NO_CHANGE,
  sinceLastValuation,
  todayChange,
} from "./asset-timeline";

import type { TxClient } from "../../common/utils/serializable-retry.util";
import type { Asset } from "@prisma/client";
import type { AssetLedgerDto } from "@wealthme/contracts";

/**
 * GET .../assets/:id/events — every history event newest first by the A4
 * effective order (voided rows kept, flagged, without a change figure),
 * the transactions newest first, the holding state, and the A6 changes.
 */
export async function buildLedger(
  tx: TxClient,
  asset: Asset,
): Promise<AssetLedgerDto> {
  const state = await loadState(tx, asset.id);
  const t = timelineOf(asset, state);
  const index = new Map(t.ordered.map((r, i) => [r.id, i]));
  const [allHistory, allTx] = await Promise.all([
    tx.assetHistory.findMany({ where: { assetId: asset.id } }),
    tx.assetTransaction.findMany({ where: { assetId: asset.id } }),
  ]);
  const names = await userNames(
    tx,
    allHistory.map((h) => h.recordedByUserId),
  );
  const events = [...allHistory]
    .sort((a, b) => compareHistory(historyToRow(b), historyToRow(a)))
    .map((h) => {
      const i = index.get(h.id);
      return toEventDto(
        h,
        i === undefined ? NO_CHANGE : changeAt(t, i),
        h.recordedByUserId ? (names.get(h.recordedByUserId) ?? null) : null,
      );
    });
  const transactions = [...allTx]
    .sort((a, b) => {
      const ka = `${a.effectiveDate.toISOString()}|${a.effectiveTime ?? ""}|${a.createdAt.toISOString()}|${a.id}`;
      const kb = `${b.effectiveDate.toISOString()}|${b.effectiveTime ?? ""}|${b.createdAt.toISOString()}|${b.id}`;
      return kb.localeCompare(ka);
    })
    .map(toTransactionDto);
  return {
    events,
    transactions,
    asset: holdingStateOf(asset, state),
    sinceLastValuation: sinceLastValuation(t),
    todayChange: todayChange(t, jakartaTodayYmd()),
  };
}
