import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxPort } from "../../fx/fx.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";
import {
  insuranceVisibilityWhere,
  type InsuranceViewer,
} from "../insurance-scope.util";

import {
  confirmedPolicyValue,
  type PolicyValueComponent,
} from "./insurance-value.core";

export interface InsuranceNetWorthPosition {
  insuranceId: string;
  name: string;
  /** Display metadata for the Aset overview row (not part of the value). */
  provider: string | null;
  policyNumber: string | null;
  policyType: string | null;
  holderUserId: string | null;
  /** Whole rupiah; null when a component's currency has no FX rate (excluded, never zero). */
  valueIdr: bigint | null;
  components: PolicyValueComponent[];
}

/**
 * Asuransi S6 — the ONE net-worth helper for insurance policy value, used by
 * the dashboard net worth, the reports balance sheet, the /asuransi summary
 * and the Aset overview (`sourceModule: insurances`). Counts ONLY the
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

  /**
   * `viewer` (S9 parity with accounts): pass it for a row-scoped viewer so
   * only the policies they can see count; omit it for a family-wide total
   * (Master/Co-Master and other household-wide readers).
   */
  async positions(
    familyGroupId: string,
    viewer?: InsuranceViewer,
  ): Promise<InsuranceNetWorthPosition[]> {
    const policies = await this.prisma.insurance.findMany({
      where: {
        familyGroupId,
        includeInNetWorth: true,
        ...(viewer && insuranceVisibilityWhere(viewer)),
      },
      select: {
        id: true,
        name: true,
        provider: true,
        policyNumber: true,
        policyType: true,
        holderUserId: true,
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
        provider: p.provider,
        policyNumber: p.policyNumber,
        policyType: p.policyType,
        holderUserId: p.holderUserId,
        valueIdr: toIdr(components, rates),
        components,
      }));
  }

  async total(
    familyGroupId: string,
    viewer?: InsuranceViewer,
  ): Promise<bigint> {
    const positions = await this.positions(familyGroupId, viewer);
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
