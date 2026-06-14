import { Injectable } from "@nestjs/common";

import { FxPort } from "./fx.port";

@Injectable()
export class FxMockService extends FxPort {
  private readonly rates: Record<string, number> = {
    IDR: 1,
    USD: 0.000063,
    SGD: 0.000085,
    EUR: 0.000058,
    JPY: 0.0095,
  };

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    const fromRate = this.rates[from] ?? 1;
    const toRate = this.rates[to] ?? 1;
    return toRate / fromRate;
  }

  async getRates(base: string): Promise<Record<string, number>> {
    const baseRate = this.rates[base] ?? 1;
    return Object.fromEntries(
      Object.entries(this.rates).map(([currency, rate]) => [
        currency,
        rate / baseRate,
      ]),
    );
  }
}
