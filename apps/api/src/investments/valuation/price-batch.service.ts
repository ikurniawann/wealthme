import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MARKETS } from "@wealthme/contracts";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";
import {
  isValidTimeZone,
  isValidYmd,
  jakartaTodayYmd,
  ledgerInstant,
} from "../ledger/ledger-dates";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentValuationService } from "./investment-valuation.service";
import { jakartaYmd, valueHolding } from "./valuation-core";

import type { PriceBatchDto, PriceBatchRowDto } from "./dto/price-batch.dto";
import type { ValuedHolding } from "./investment-valuation.service";
import type { ValuationFx, ValuationPrice } from "./valuation-core";
import type {
  InvestmentPriceBatchResultDto,
  InvestmentPriceBatchRowCode,
  InvestmentPriceBatchRowResult,
} from "@wealthme/contracts";

const D = Prisma.Decimal;
const PRICE = /^\d{1,16}(\.\d{1,8})?$/;

const MESSAGES: Record<InvestmentPriceBatchRowCode, string> = {
  empty_price: "Harga kosong — dilewati, harga sebelumnya tetap dipakai.",
  duplicate: "Harga dan tanggal yang sama sudah tercatat — dilewati.",
  older_than_current:
    "Tanggal harga lebih lama dari harga yang sedang dipakai — dilewati.",
  not_found: "Investasi tidak ditemukan.",
  duplicate_row: "Investasi ini muncul lebih dari sekali dalam daftar.",
  invalid_price: "Harga harus angka lebih dari 0 (maks. 8 desimal).",
  invalid_date: "Tanggal harga tidak valid.",
  future_date: "Tanggal/waktu harga tidak boleh di masa depan.",
  invalid_time_zone: "Zona waktu tidak dikenal.",
  unsupported_currency: "Mata uang harga tidak didukung.",
  fx_unavailable:
    "Kurs valuasi untuk mata uang ini belum tersedia — harga tidak dapat dinilai.",
  deposit_not_priced:
    "Deposito dinilai dari pokok dan bunga berjalan, bukan harga — ubah suku bunga atau tanggalnya di detail deposito.",
};

interface Plan {
  index: number;
  investmentId: string;
  data: Prisma.InvestmentPriceUncheckedCreateInput;
}

interface Evaluated {
  rows: InvestmentPriceBatchRowResult[];
  plans: Plan[];
}

function emptyResult(
  index: number,
  row: PriceBatchRowDto,
  holding: ValuedHolding | undefined,
): InvestmentPriceBatchRowResult {
  return {
    index,
    investmentId: row.investmentId,
    status: "failed",
    code: null,
    message: null,
    warnings: [],
    name: holding?.row.name ?? null,
    ticker: holding?.row.ticker ?? null,
    oldPrice: holding?.valuation.price ?? null,
    oldBasis: holding?.valuation.basis ?? null,
    oldValueIdr: holding?.valuation.marketValueIdr ?? null,
    newPrice: null,
    newCurrency: null,
    newValueIdr: null,
    impactIdr: null,
    priceId: null,
  };
}

function withCode(
  r: InvestmentPriceBatchRowResult,
  status: "skipped" | "failed",
  code: InvestmentPriceBatchRowCode,
): InvestmentPriceBatchRowResult {
  return { ...r, status, code, message: MESSAGES[code] };
}

/**
 * Investasi Task 8 — manual price batch (spec §10). Preview reports, per
 * row, updated / skipped / failed with the old and new value and the impact
 * on net worth; bulk saves the `updated` rows as InvestmentPrice rows ONLY —
 * never a transaction, a cost basis or a cash balance.
 */
@Injectable()
export class PriceBatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuation: InvestmentValuationService,
  ) {}

  async preview(
    familyGroupId: string,
    dto: PriceBatchDto,
  ): Promise<InvestmentPriceBatchResultDto> {
    const { rows } = await this.evaluate(familyGroupId, dto, new Date());
    return this.result(rows, false);
  }

  async bulk(
    familyGroupId: string,
    dto: PriceBatchDto,
  ): Promise<InvestmentPriceBatchResultDto> {
    const { rows, plans } = await this.evaluate(familyGroupId, dto, new Date());
    if (plans.length === 0) return this.result(rows, true);
    const created = await this.prisma.$transaction(
      plans.map((p) =>
        this.prisma.investmentPrice.create({
          data: p.data,
          select: { id: true },
        }),
      ),
    );
    const idByIndex = new Map(
      plans.map((p, i) => [p.index, created[i]?.id ?? null]),
    );
    return this.result(
      rows.map((r) => ({ ...r, priceId: idByIndex.get(r.index) ?? null })),
      true,
    );
  }

  private result(
    rows: InvestmentPriceBatchRowResult[],
    saved: boolean,
  ): InvestmentPriceBatchResultDto {
    const updated = rows.filter((r) => r.status === "updated");
    return {
      saved,
      rows,
      updatedCount: updated.length,
      skippedCount: rows.filter((r) => r.status === "skipped").length,
      failedCount: rows.filter((r) => r.status === "failed").length,
      impactIdr: updated
        .reduce((sum, r) => sum + BigInt(r.impactIdr ?? "0"), 0n)
        .toString(),
    };
  }

  private async evaluate(
    familyGroupId: string,
    dto: PriceBatchDto,
    now: Date,
  ): Promise<Evaluated> {
    const ids = [...new Set(dto.rows.map((r) => r.investmentId))];
    const valued = await this.valuation.valueFamily(
      familyGroupId,
      { id: { in: ids } },
      now,
    );
    const byId = new Map(valued.map((v) => [v.row.id, v]));
    const fx = dto.rows.some((r) => r.currency !== "IDR")
      ? await this.valuation.valuationFx()
      : null;
    const seen = new Set<string>();
    const rows: InvestmentPriceBatchRowResult[] = [];
    const plans: Plan[] = [];
    dto.rows.forEach((row, index) => {
      const holding = byId.get(row.investmentId);
      const out = this.evaluateRow(index, row, holding, seen, fx, now);
      seen.add(row.investmentId);
      rows.push(out.result);
      if (out.plan) plans.push(out.plan);
    });
    return { rows, plans };
  }

  private evaluateRow(
    index: number,
    row: PriceBatchRowDto,
    holding: ValuedHolding | undefined,
    seen: ReadonlySet<string>,
    fx: ValuationFx | null,
    now: Date,
  ): { result: InvestmentPriceBatchRowResult; plan: Plan | null } {
    const base = emptyResult(index, row, holding);
    const fail = (
      status: "skipped" | "failed",
      code: InvestmentPriceBatchRowCode,
    ) => ({ result: withCode(base, status, code), plan: null });

    if (seen.has(row.investmentId)) return fail("failed", "duplicate_row");
    if (!holding) return fail("failed", "not_found");
    const raw = row.price?.trim() ?? "";
    if (raw === "") return fail("skipped", "empty_price");
    if (!PRICE.test(raw) || !new D(raw).greaterThan(0)) {
      return fail("failed", "invalid_price");
    }
    const market = holding.valuation.market;
    if (holding.row.type === "deposito" || market === "DEPOSIT") {
      return fail("failed", "deposit_not_priced");
    }
    if (!isValidYmd(row.asOfDate)) return fail("failed", "invalid_date");
    if (row.timeZone && !isValidTimeZone(row.timeZone)) {
      return fail("failed", "invalid_time_zone");
    }
    const asOfTime = row.asOfTime ?? null;
    const asOf = ledgerInstant(
      row.asOfDate,
      asOfTime,
      asOfTime ? (row.timeZone ?? null) : null,
    );
    if (row.asOfDate > jakartaTodayYmd(now) || asOf > now) {
      return fail("failed", "future_date");
    }

    const price = new D(raw);
    const unitLabel = row.unitLabel?.trim() || MARKETS[market].priceUnitLabel;
    const old = holding.valuation;
    const ownPrice =
      old.price && (old.method === "price" || old.method === "bond_price")
        ? old.price
        : null;
    if (ownPrice) {
      const oldAsOf = new Date(ownPrice.asOf);
      if (
        new D(ownPrice.value).equals(price) &&
        ownPrice.currency === row.currency &&
        oldAsOf.getTime() === asOf.getTime()
      ) {
        return fail("skipped", "duplicate");
      }
      // A date-only entry is compared by date, so today's manual price is
      // not "older" than an automated quote stamped earlier today.
      const older = asOfTime
        ? asOf < oldAsOf
        : row.asOfDate < jakartaYmd(oldAsOf);
      if (older) return fail("skipped", "older_than_current");
    }

    const newPrice: ValuationPrice = {
      price,
      currency: row.currency,
      unitLabel,
      source: row.source,
      asOf,
      recordedAt: now,
      hasTime: asOfTime !== null,
      delayed: false,
      reference: row.reference?.trim() || null,
    };
    const next = valueHolding(
      { ...holding.input, latestPrice: newPrice },
      { now, fx },
    );
    if (next.reason === "fx_unavailable") {
      return fail("failed", "fx_unavailable");
    }
    const warnings =
      row.currency !== holding.row.currency
        ? ["currency_differs_from_holding"]
        : [];
    return {
      result: {
        ...base,
        status: "updated",
        warnings,
        newPrice: price.toString(),
        newCurrency: row.currency,
        newValueIdr: next.marketValueIdr,
        impactIdr: (
          BigInt(next.netWorthIdr) - BigInt(old.netWorthIdr)
        ).toString(),
      },
      plan: {
        index,
        investmentId: row.investmentId,
        data: {
          investmentId: row.investmentId,
          price,
          currency: row.currency,
          unitLabel,
          source: row.source,
          asOf,
          hasTime: asOfTime !== null,
          delayed: false,
          reference: newPrice.reference,
        },
      },
    };
  }
}
