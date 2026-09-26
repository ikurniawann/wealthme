import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
import { wibDateToUtc, wibYearStartUtc } from "../tax-engine/dates";
import { accruedInterest, finalTaxFor } from "../tax-engine/final-tax.engine";
import { wibDateString, yearEndDate } from "../tax-rules/tax-rules.registry";

import { toRuleRefDtos } from "./tax-dto-mappers";

import type {
  CreateFinalIncomeEntryDto,
  UpdateFinalIncomeEntryDto,
} from "./dto/final-income.dto";
import type { FinalInstrument } from "../tax-engine/final-tax.engine";
import type {
  CryptoExchangeKind,
  FinalTaxEstimateDto,
  FinalTaxLineDto,
  TaxFinalIncomeEntryDto,
} from "@wealthme/contracts";

const toRupiah = (v: Decimal) =>
  BigInt(v.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
const TAXED_TYPES = [
  "deposito",
  "obligasi",
  "saham",
  "kripto",
  "reksa_dana",
  "emas",
] as const;
const SELL_INSTRUMENT = {
  saham: "saham_idx",
  reksa_dana: "reksa_dana",
  emas: "emas",
} as const;

interface InvestmentTxRow {
  quantity: Decimal;
  pricePerUnit: Decimal;
  occurredAt: Date;
}

interface InvestmentRow {
  id: string;
  name: string;
  ticker: string;
  type: string;
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  currency: string;
  interestRatePct: Decimal | null;
  purchasedAt: Date | null;
  maturityDate: Date | null;
  cryptoExchange: CryptoExchangeKind | null;
  transactions: InvestmentTxRow[];
}

interface EntryRow {
  id: string;
  taxYear: number;
  instrument: FinalInstrument;
  grossAmount: bigint;
  occurredAt: Date;
  reinvested: boolean;
  rateBpsOverride: number | null;
  investmentId: string | null;
  accountId: string | null;
  notes: string | null;
}

function line(
  base: Pick<
    FinalTaxLineDto,
    | "source"
    | "instrument"
    | "label"
    | "investmentId"
    | "accountId"
    | "entryId"
    | "caveat"
  >,
  gross: bigint,
  calc: ReturnType<typeof finalTaxFor> | null,
): FinalTaxLineDto {
  return {
    ...base,
    grossAmount: gross.toString(),
    rateBps: calc?.rateBps ?? null,
    tax: calc?.tax == null ? null : calc.tax.toString(),
    rateSource: calc?.rateSource ?? "rule",
    belowThreshold: calc?.belowThreshold ?? false,
    rule: toRuleRefDtos([calc!.ref])[0]!,
  };
}

const holdingLabel = (inv: InvestmentRow) =>
  inv.ticker ? `${inv.ticker} · ${inv.name}` : inv.name;

function sumSells(txs: readonly InvestmentTxRow[]): Decimal {
  return txs.reduce(
    (acc, t) => acc.plus(t.quantity.times(t.pricePerUnit)),
    new Decimal(0),
  );
}

function lastDate(txs: readonly InvestmentTxRow[]): Date {
  return txs.reduce(
    (a, t) => (t.occurredAt > a ? t.occurredAt : a),
    txs[0]!.occurredAt,
  );
}

@Injectable()
export class FinalTaxService {
  constructor(private readonly prisma: PrismaService) {}

  async listEntries(
    familyGroupId: string,
    taxYear: number,
  ): Promise<TaxFinalIncomeEntryDto[]> {
    const rows = (await this.prisma.taxFinalIncomeEntry.findMany({
      where: { familyGroupId, taxYear },
      orderBy: { occurredAt: "asc" },
    })) as unknown as EntryRow[];
    return rows.map((r) => this.toEntryDto(r));
  }

  async createEntry(
    familyGroupId: string,
    dto: CreateFinalIncomeEntryDto,
  ): Promise<TaxFinalIncomeEntryDto> {
    await this.assertReferences(familyGroupId, dto);
    const taxYear = Number(dto.occurredAt.slice(0, 4));
    const row = (await this.prisma.taxFinalIncomeEntry.create({
      data: {
        familyGroupId,
        taxYear,
        instrument: dto.instrument,
        grossAmount: BigInt(dto.grossAmount),
        occurredAt: wibDateToUtc(dto.occurredAt),
        reinvested: dto.reinvested ?? false,
        rateBpsOverride: dto.rateBpsOverride ?? null,
        investmentId: dto.investmentId ?? null,
        accountId: dto.accountId ?? null,
        notes: dto.notes ?? null,
      },
    })) as unknown as EntryRow;
    return this.toEntryDto(row);
  }

  async updateEntry(
    familyGroupId: string,
    id: string,
    dto: UpdateFinalIncomeEntryDto,
  ): Promise<TaxFinalIncomeEntryDto> {
    const existing = (await this.prisma.taxFinalIncomeEntry.findFirst({
      where: { id, familyGroupId },
    })) as unknown as EntryRow | null;
    if (!existing) throw new NotFoundException("final income entry not found");
    const merged: CreateFinalIncomeEntryDto = {
      instrument: dto.instrument ?? existing.instrument,
      grossAmount: dto.grossAmount ?? existing.grossAmount.toString(),
      occurredAt: dto.occurredAt ?? wibDateString(existing.occurredAt),
      reinvested: dto.reinvested ?? existing.reinvested,
      rateBpsOverride:
        dto.rateBpsOverride === undefined
          ? existing.rateBpsOverride
          : dto.rateBpsOverride,
      investmentId:
        dto.investmentId === undefined
          ? existing.investmentId
          : dto.investmentId,
      accountId:
        dto.accountId === undefined ? existing.accountId : dto.accountId,
      notes: dto.notes === undefined ? existing.notes : dto.notes,
    };
    await this.assertReferences(familyGroupId, merged);
    const taxYear = Number(merged.occurredAt.slice(0, 4));
    const row = (await this.prisma.taxFinalIncomeEntry.update({
      where: { id },
      data: {
        instrument: merged.instrument,
        taxYear,
        grossAmount: BigInt(merged.grossAmount),
        occurredAt: wibDateToUtc(merged.occurredAt),
        reinvested: merged.reinvested ?? false,
        rateBpsOverride: merged.rateBpsOverride ?? null,
        investmentId: merged.investmentId ?? null,
        accountId: merged.accountId ?? null,
        notes: merged.notes ?? null,
      },
    })) as unknown as EntryRow;
    return this.toEntryDto(row);
  }

  async removeEntry(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.taxFinalIncomeEntry.findFirst({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("final income entry not found");
    await this.prisma.taxFinalIncomeEntry.delete({ where: { id } });
  }

  async setCryptoExchange(
    familyGroupId: string,
    investmentId: string,
    kind: CryptoExchangeKind | null,
  ): Promise<{
    investmentId: string;
    cryptoExchange: CryptoExchangeKind | null;
  }> {
    const inv = (await this.prisma.investment.findFirst({
      where: { id: investmentId, familyGroupId },
      select: { id: true, type: true },
    })) as unknown as { id: string; type: string } | null;
    if (!inv || inv.type !== "kripto") {
      throw new BadRequestException(
        "investment is not a kripto holding for this family",
      );
    }
    await this.prisma.investment.update({
      where: { id: investmentId },
      data: { cryptoExchange: kind },
    });
    return { investmentId, cryptoExchange: kind };
  }

  async estimate(
    familyGroupId: string,
    taxYear: number,
    opts: { includeEntries: boolean },
  ): Promise<FinalTaxEstimateDto> {
    const { lines: holdingLinesResult, skippedForeign } =
      await this.holdingLines(familyGroupId, taxYear);
    const entryLinesResult = opts.includeEntries
      ? await this.entryLines(familyGroupId, taxYear)
      : [];
    // A manual entry that names the same (investmentId, instrument) as a
    // derived holding line replaces it instead of adding to it — manual
    // wins (opus review fix round 1, Important #2).
    const manualKeys = new Set(
      entryLinesResult
        .filter((l) => l.investmentId !== null)
        .map((l) => `${l.investmentId}|${l.instrument}`),
    );
    const dedupedHoldingLines = holdingLinesResult.filter(
      (l) => !manualKeys.has(`${l.investmentId}|${l.instrument}`),
    );
    const lines = [...dedupedHoldingLines, ...entryLinesResult];
    const totalTax = lines.reduce(
      (acc, l) => acc + (l.tax === null ? 0n : BigInt(l.tax)),
      0n,
    );
    const missingRateCount = lines.filter((l) => l.tax === null).length;
    return {
      taxYear,
      lines,
      totalTax: totalTax.toString(),
      missingRateCount,
      skippedForeign,
    };
  }

  private async holdingLines(
    familyGroupId: string,
    taxYear: number,
  ): Promise<{ lines: FinalTaxLineDto[]; skippedForeign: number }> {
    const investments = (await this.prisma.investment.findMany({
      where: { familyGroupId, type: { in: [...TAXED_TYPES] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        ticker: true,
        type: true,
        quantity: true,
        costBasisPerUnit: true,
        currency: true,
        interestRatePct: true,
        purchasedAt: true,
        maturityDate: true,
        cryptoExchange: true,
        transactions: {
          where: {
            type: "sell",
            occurredAt: {
              gte: wibYearStartUtc(taxYear),
              lt: wibYearStartUtc(taxYear + 1),
            },
          },
          orderBy: { occurredAt: "asc" },
          select: { quantity: true, pricePerUnit: true, occurredAt: true },
        },
      },
    })) as unknown as InvestmentRow[];

    const lines: FinalTaxLineDto[] = [];
    let skippedForeign = 0;
    for (const inv of investments) {
      if (inv.currency !== "IDR") {
        skippedForeign++;
        continue;
      }
      if (inv.type === "deposito" || inv.type === "obligasi") {
        const l = this.accrualLine(inv, taxYear);
        if (l) lines.push(l);
      } else if (inv.type === "kripto") {
        lines.push(...this.kriptoLines(inv));
      } else {
        const l = this.sellLine(inv);
        if (l) lines.push(l);
      }
    }
    return { lines, skippedForeign };
  }

  private accrualLine(
    inv: InvestmentRow,
    taxYear: number,
  ): FinalTaxLineDto | null {
    const isDeposito = inv.type === "deposito";
    const instrument: FinalInstrument = isDeposito
      ? "bunga_deposito"
      : "kupon_sbn";
    const base = {
      source: "holding" as const,
      instrument,
      label: holdingLabel(inv),
      investmentId: inv.id,
      accountId: null,
      entryId: null,
    };
    if (inv.interestRatePct === null) {
      const calc = finalTaxFor({
        instrument,
        grossAmount: 0n,
        date: yearEndDate(taxYear),
      });
      return {
        ...line({ ...base, caveat: "no_interest_rate" }, 0n, calc),
        tax: null,
      };
    }
    const noPurchaseDate = inv.purchasedAt === null;
    const from = noPurchaseDate
      ? `${taxYear}-01-01`
      : wibDateString(inv.purchasedAt!);
    const to =
      inv.maturityDate === null ? null : wibDateString(inv.maturityDate);
    const principal = toRupiah(inv.quantity.times(inv.costBasisPerUnit));
    // Explicit round-half-up (not the implicit `toFixed(0)` default) —
    // matches `toRupiah` above and the amortisation.util.ts convention.
    const rateHundredths = toRupiah(inv.interestRatePct.times(100));
    const { interest } = accruedInterest({
      principal,
      rateHundredths,
      from,
      to,
      taxYear,
    });
    const caveat = noPurchaseDate
      ? "no_purchase_date"
      : isDeposito
        ? null
        : "assumed_sbn";
    if (interest === 0n && caveat === null) return null;
    const calc = finalTaxFor({
      instrument,
      grossAmount: interest,
      date: yearEndDate(taxYear),
      principal: isDeposito ? principal : null,
    });
    return line({ ...base, caveat }, interest, calc);
  }

  private sellLine(inv: InvestmentRow): FinalTaxLineDto | null {
    if (inv.transactions.length === 0) return null;
    const instrument =
      SELL_INSTRUMENT[inv.type as keyof typeof SELL_INSTRUMENT];
    const gross = toRupiah(sumSells(inv.transactions));
    const date = wibDateString(lastDate(inv.transactions));
    const calc = finalTaxFor({ instrument, grossAmount: gross, date });
    return line(
      {
        source: "holding",
        instrument,
        label: holdingLabel(inv),
        investmentId: inv.id,
        accountId: null,
        entryId: null,
        caveat: null,
      },
      gross,
      calc,
    );
  }

  private kriptoLines(inv: InvestmentRow): FinalTaxLineDto[] {
    if (inv.transactions.length === 0) return [];
    const instrument: FinalInstrument =
      inv.cryptoExchange === "luar_negeri" ? "kripto_luar" : "kripto_domestik";
    const caveat = inv.cryptoExchange === null ? "assumed_domestic" : null;
    const groups = new Map<string, InvestmentTxRow[]>();
    for (const tx of inv.transactions) {
      const key = finalTaxFor({
        instrument,
        grossAmount: 0n,
        date: wibDateString(tx.occurredAt),
      }).ref.effectiveFrom;
      const group = groups.get(key) ?? [];
      group.push(tx);
      groups.set(key, group);
    }
    return [...groups.values()].map((txs) => {
      const gross = toRupiah(sumSells(txs));
      const date = wibDateString(lastDate(txs));
      const calc = finalTaxFor({ instrument, grossAmount: gross, date });
      return line(
        {
          source: "holding",
          instrument,
          label: holdingLabel(inv),
          investmentId: inv.id,
          accountId: null,
          entryId: null,
          caveat,
        },
        gross,
        calc,
      );
    });
  }

  private async entryLines(
    familyGroupId: string,
    taxYear: number,
  ): Promise<FinalTaxLineDto[]> {
    const rows = (await this.prisma.taxFinalIncomeEntry.findMany({
      where: { familyGroupId, taxYear },
      orderBy: { occurredAt: "asc" },
    })) as unknown as EntryRow[];
    return rows.map((r) => {
      const calc = finalTaxFor({
        instrument: r.instrument,
        grossAmount: r.grossAmount,
        date: wibDateString(r.occurredAt),
        reinvested: r.reinvested,
        rateBpsOverride: r.rateBpsOverride,
      });
      return line(
        {
          source: "entry",
          instrument: r.instrument,
          label: r.notes ?? "",
          investmentId: r.investmentId,
          accountId: r.accountId,
          entryId: r.id,
          caveat: null,
        },
        r.grossAmount,
        calc,
      );
    });
  }

  private async assertReferences(
    familyGroupId: string,
    dto: CreateFinalIncomeEntryDto,
  ): Promise<void> {
    if (dto.reinvested === true && dto.instrument !== "dividen") {
      throw new BadRequestException(
        "reinvested applies only to the dividen instrument",
      );
    }
    if (dto.investmentId != null) {
      const found = await this.prisma.investment.findFirst({
        where: { id: dto.investmentId, familyGroupId },
        select: { id: true },
      });
      if (!found) throw new BadRequestException("investmentId not found");
    }
    if (dto.accountId != null) {
      const found = await this.prisma.account.findFirst({
        where: { id: dto.accountId, familyGroupId },
        select: { id: true },
      });
      if (!found) throw new BadRequestException("accountId not found");
    }
  }

  private toEntryDto(row: EntryRow): TaxFinalIncomeEntryDto {
    return {
      id: row.id,
      taxYear: row.taxYear,
      instrument: row.instrument,
      grossAmount: row.grossAmount.toString(),
      occurredAt: wibDateString(row.occurredAt),
      reinvested: row.reinvested,
      rateBpsOverride: row.rateBpsOverride,
      investmentId: row.investmentId,
      accountId: row.accountId,
      notes: row.notes,
    };
  }
}
