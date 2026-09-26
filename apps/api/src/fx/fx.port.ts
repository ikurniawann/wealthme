import type { FxSnapshot } from "./fx-snapshot";

export abstract class FxPort {
  abstract getRate(from: string, to: string): Promise<number>;
  abstract getRates(base: string): Promise<Record<string, number>>;
  abstract getSnapshot(): Promise<FxSnapshot>;
}
