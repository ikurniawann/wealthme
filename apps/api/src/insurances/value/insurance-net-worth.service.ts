import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxPort } from "../../fx/fx.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";

import {
  confirmedPolicyValue,
  type PolicyValueComponent,
} from "./insurance-value.core";

export interface InsuranceNetWorthPosition {
  insuranceId: string;
  name: string;
  /** Whole rupiah; null when a component's currency has no FX rate (excluded, never zero). */
  valueIdr: bigint | null;
  components: PolicyValueComponent[];
}

/**
 * Asuransi S6 — the ONE net-worth helper for insurance policy value, used by
 * the dashboard net worth, the reports balance sheet, the /asuransi summary
 * and (later) the Aset overview (`sourceModule: insurances`). Counts ONLY the
 * confirmed value of policies with includeInNetWorth=true, once per policy
 * (see confirmedPolicyValue). Sum assured and premiums paid never count;
 * value updates never create cash transactions. Foreign values convert at
 * today's FX snapshot; a missing rate leaves the policy out (unpriced).
 */
@Injectable()
export class InsuranceNetWorthService {
  private readonly logger = new Logger(InsuranceNetWorthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxPort,
  ) {}

  async positions(familyGroupId: string): Promise<InsuranceNetWorthPosition[]> {
    const policies = await this.prisma.insurance.findMany({
      where: { familyGroupId, includeInNetWorth: true },
      select: {
        id: true,
        name: true,
        valuations: { where: { status: "confirmed" } },
      },
      orderBy: { createdAt: "asc" },
    });
    const valued = policies.map((p) => ({
      p,
      components: confirmedPolicyValue(p.valuations),
    }));
    const needsFx = valued.some(({ components }) =>
      components.some((c) => c.currency !== "IDR"),
    );
    const rates = needsFx ? await this.idrRates() : {};

    return valued
      .filter(({ components }) => components.length > 0)
      .map(({ p, components }) => ({
        insuranceId: p.id,
        name: p.name,
        valueIdr: toIdr(components, rates),
        components,
      }));
  }

  async total(familyGroupId: string): Promise<bigint> {
    const positions = await this.positions(familyGroupId);
    return positions.reduce((sum, p) => sum + (p.valueIdr ?? 0n), 0n);
  }

  private async idrRates(): Promise<Record<string, string>> {
    try {
      const snap = await this.fx.getSnapshot();
      return snap.idrPerUnit as Record<string, string>;
    } catch (err) {
      this.logger.warn(
        `FX unavailable; foreign policy values stay unpriced: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {};
    }
  }
}

function toIdr(
  components: PolicyValueComponent[],
  rates: Record<string, string>,
): bigint | null {
  let sum = new Prisma.Decimal(0);
  for (const c of components) {
    if (c.currency === "IDR") {
      sum = sum.plus(c.value);
      continue;
    }
    const rate = rates[c.currency];
    if (!rate) return null;
    sum = sum.plus(c.value.times(rate));
  }
  return BigInt(
    sum.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0),
  );
}
