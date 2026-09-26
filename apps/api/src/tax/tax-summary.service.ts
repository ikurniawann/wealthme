import { Injectable } from "@nestjs/common";

import { sptTiming } from "../tax-engine/spt.engine";
import { wibDateString } from "../tax-rules/tax-rules.registry";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FinalTaxService } from "./final-tax.service";
import { toRuleRefDtos } from "./tax-dto-mappers";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TaxService } from "./tax.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UmkmYearService } from "./umkm-year.service";

import type { TaxAnnualSummaryDto } from "@wealthme/contracts";

@Injectable()
export class TaxSummaryService {
  constructor(
    private readonly tax: TaxService,
    private readonly finalTax: FinalTaxService,
    private readonly umkm: UmkmYearService,
  ) {}

  async summary(
    familyGroupId: string,
    taxYear: number,
    today = wibDateString(new Date()),
  ): Promise<TaxAnnualSummaryDto> {
    const [record, finalTax, umkm] = await Promise.all([
      this.tax.findByYear(familyGroupId, taxYear),
      this.finalTax.estimate(familyGroupId, taxYear, { includeEntries: true }),
      this.umkm.get(familyGroupId, taxYear),
    ]);
    const timing = sptTiming(taxYear, today);
    const total =
      BigInt(record?.netTax ?? "0") +
      BigInt(finalTax.totalTax) +
      BigInt(umkm?.totalTax ?? "0");
    const rules = [
      ...(record?.rules ?? []),
      ...finalTax.lines.map((l) => l.rule),
      ...(umkm?.rules ?? []),
      ...toRuleRefDtos(timing.rules),
    ];
    return {
      taxYear,
      pphOp: record
        ? {
            recordId: record.id,
            calcMode: record.calcMode,
            tax: record.netTax,
            withheld: record.withheldPph21 ?? "0",
            balance: record.balance,
          }
        : null,
      finalTax: {
        totalTax: finalTax.totalTax,
        lineCount: finalTax.lines.length,
        missingRateCount: finalTax.missingRateCount,
      },
      umkm: umkm
        ? {
            totalTax: umkm.totalTax,
            exceedsCeiling: umkm.exceedsCeiling,
            ineligibleReason: umkm.ineligibleReason,
          }
        : null,
      totalEstimatedTax: total.toString(),
      spt: {
        status: record?.sptStatus ?? null,
        deadline: timing.deadline,
        graceUntil: timing.graceUntil,
        daysToDeadline: timing.daysToDeadline,
        pastDeadline: timing.pastDeadline,
        withinGrace: timing.withinGrace,
        filedAt: record?.sptFiledAt ?? null,
      },
      rules: [
        ...new Map(
          rules.map((r) => [`${r.key}|${r.effectiveFrom}`, r]),
        ).values(),
      ],
    };
  }
}
