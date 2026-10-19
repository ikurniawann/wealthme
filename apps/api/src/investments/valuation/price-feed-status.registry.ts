import { Injectable } from "@nestjs/common";

/**
 * Last outcome of the automated price refresh per holding, kept in memory by
 * the refresh job (PriceRefreshProcessor) and read by the valuation service.
 * It lets a holding with no usable price say "the feed failed" (basis
 * `failed`) instead of plain "unpriced", and flags a retained price whose
 * latest refresh failed. Nothing here is persisted: after a restart the
 * first refresh run (every 60 s) repopulates it, and until then holdings
 * simply carry `feedStatus: null`.
 */
export type PriceFeedState = "ok" | "failed" | "no_route" | "simulated";

export interface PriceFeedStatus {
  state: PriceFeedState;
  at: Date;
  error: string | null;
}

@Injectable()
export class PriceFeedStatusRegistry {
  private readonly byInvestment = new Map<string, PriceFeedStatus>();

  record(
    investmentId: string,
    state: PriceFeedState,
    error: string | null = null,
    at: Date = new Date(),
  ): void {
    this.byInvestment.set(investmentId, { state, at, error });
  }

  get(investmentId: string): PriceFeedStatus | null {
    return this.byInvestment.get(investmentId) ?? null;
  }
}
