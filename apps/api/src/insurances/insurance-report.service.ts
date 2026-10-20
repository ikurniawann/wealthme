import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiKeyService } from "../ai-advisor/ai-key.service";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import {
  MAX_REPORT_TOTAL_CHARS,
  MIN_REPORT_TEXT_CHARS,
} from "./dto/insurance-report.dto";
import { toValuationDto } from "./insurance-mapper";
import { assertNotFutureEffectiveDate } from "./insurance-valuations.service";
import { parseDateOnly } from "./premium-schedule.util";
import { build } from "./report-reader/insurance-report-http-error.util";
import {
  buildDrafts,
  verifyFields,
} from "./report-reader/insurance-report-normalize";
import { InsuranceReportNotConfiguredError } from "./report-reader/insurance-report-prompt.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceReportReaderFactory } from "./report-reader/insurance-report-reader.factory";

import type {
  ConfirmInsuranceReportDto,
  ConfirmInsuranceReportItemDto,
  PreviewInsuranceReportDto,
} from "./dto/insurance-report.dto";
import type { ReportPageText } from "./report-reader/insurance-report-reader.port";
import type {
  ConfirmInsuranceReportResultDto,
  InsuranceReportPreviewDto,
} from "@wealthme/contracts";

const dec = (v: string | undefined) =>
  v === undefined ? null : new Prisma.Decimal(v);
const date = (v: string | undefined) =>
  v === undefined ? null : parseDateOnly(v);
const nonWs = (t: string) => t.replace(/\s+/g, "").length;

type Policy = {
  id: string;
  policyType: string | null;
  currency: string;
};

/**
 * Asuransi S8 — "Baca laporan dengan AI".
 *
 * preview: browser-extracted text pages → the family's own AI key → strings
 * with page + snippet → deterministic verification, Decimal units × NAV and
 * the "Data belum lengkap" list. NOTHING is persisted.
 *
 * confirm: the user-reviewed values become `confirmed` value statements
 * (source report, with documentId/page/snippet). Value updates never create
 * cash transactions (S6); a backdated report never overrides a newer
 * effective one (insurance-value.core picks the latest by effectiveDate) —
 * the response names the rows that are not current for that reason.
 */
@Injectable()
export class InsuranceReportService {
  private readonly logger = new Logger(InsuranceReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiKeys: AiKeyService,
    private readonly readers: InsuranceReportReaderFactory,
  ) {}

  async preview(
    familyGroupId: string,
    dto: PreviewInsuranceReportDto,
  ): Promise<InsuranceReportPreviewDto> {
    const pages = this.usablePages(dto);
    const policy = dto.insuranceId
      ? await this.policy(familyGroupId, dto.insuranceId)
      : null;
    if (dto.documentId) {
      if (!policy) {
        throw new BadRequestException(
          "documentId memerlukan insuranceId (dokumen selalu milik satu polis)",
        );
      }
      await this.assertDocument(familyGroupId, policy.id, dto.documentId);
    }
    const funds = policy
      ? await this.prisma.insuranceFund.findMany({
          where: { insuranceId: policy.id },
          select: { id: true, name: true, code: true, currency: true },
        })
      : [];

    const resolved = await this.aiKeys.resolveDecryptedKey(familyGroupId);
    if (!resolved) throw new InsuranceReportNotConfiguredError();
    const reader = this.readers.create(
      resolved.provider,
      resolved.apiKey,
      resolved.model,
    );

    const startedAt = Date.now();
    let reading;
    try {
      reading = await reader.readReport(pages);
    } catch (err) {
      this.logger.warn(
        `insurance report read FAILED: provider=${resolved.provider} pages=${pages.length} ms=${Date.now() - startedAt} err=${err instanceof Error ? err.name : typeof err}`,
      );
      throw err;
    }
    // No document text and no key in the log — only what diagnoses a read.
    this.logger.log(
      `insurance report read: provider=${resolved.provider} pages=${pages.length} fields=${reading.fields.length} ms=${Date.now() - startedAt}`,
    );

    return this.assemble(reading.fields, pages, policy, funds, dto);
  }

  /** Pure post-processing, exposed for the boot check with a stub reader. */
  assemble(
    raw: Parameters<typeof verifyFields>[0],
    pages: ReportPageText[],
    policy: Policy | null,
    funds: {
      id: string;
      name: string;
      code: string | null;
      currency: string;
    }[],
    dto: { insuranceId?: string; documentId?: string },
  ): InsuranceReportPreviewDto {
    const fields = verifyFields(raw, pages, policy?.policyType ?? null);
    const { valuations, missing } = buildDrafts(fields, {
      policyCurrency: policy?.currency ?? null,
      funds,
    });
    return {
      insuranceId: dto.insuranceId ?? null,
      documentId: dto.documentId ?? null,
      pageCount: pages.length,
      fields,
      missing,
      valuations,
      complete: missing.length === 0 && valuations.length > 0,
    };
  }

  async confirm(
    familyGroupId: string,
    insuranceId: string,
    dto: ConfirmInsuranceReportDto,
    actorUserId: string | null,
  ): Promise<ConfirmInsuranceReportResultDto> {
    const policy = await this.policy(familyGroupId, insuranceId);
    if (dto.documentId) {
      await this.assertDocument(familyGroupId, insuranceId, dto.documentId);
    }
    for (const item of dto.items) {
      assertItemShape(policy, item);
      assertNotFutureEffectiveDate(item.effectiveDate);
    }

    const created = await runSerializableWithRetry(this.prisma, async (tx) => {
      const rows = [];
      for (const item of dto.items) {
        const fund = await this.resolveFund(tx, policy, item);
        // One report statement per fund + date (+ document when given):
        // a double-submit or a second confirm never stores the value twice.
        const dup = await tx.insuranceValuation.findFirst({
          where: {
            insuranceId,
            fundId: fund?.id ?? null,
            effectiveDate: parseDateOnly(item.effectiveDate),
            source: "report",
            ...(dto.documentId && { documentId: dto.documentId }),
          },
          select: { id: true },
        });
        if (dup) {
          throw new ConflictException(
            `Nilai dari laporan untuk tanggal ${item.effectiveDate} sudah dikonfirmasi`,
          );
        }
        rows.push(
          await tx.insuranceValuation.create({
            data: {
              insuranceId,
              fundId: fund?.id ?? null,
              currency: fund?.currency ?? item.currency ?? policy.currency,
              units: dec(item.units),
              navPerUnit: dec(item.navPerUnit),
              navDate: date(item.navDate),
              unitsDate: date(item.unitsDate),
              reportedValue: dec(item.reportedValue),
              cashValue: dec(item.cashValue),
              surrenderEstimate: dec(item.surrenderEstimate),
              maturityBenefit: dec(item.maturityBenefit),
              guaranteed: item.guaranteed ?? false,
              effectiveDate: parseDateOnly(item.effectiveDate),
              source: "report",
              documentId: dto.documentId ?? null,
              page: item.page ?? null,
              snippet: item.snippet ?? null,
              status: "confirmed",
              confirmedAt: new Date(),
              confirmedByUserId: actorUserId,
              createdByUserId: actorUserId,
            },
          }),
        );
      }
      return rows;
    });

    const supersededIds: string[] = [];
    for (const row of created) {
      const newer = await this.prisma.insuranceValuation.findFirst({
        where: {
          insuranceId,
          fundId: row.fundId,
          status: "confirmed",
          effectiveDate: { gt: row.effectiveDate },
        },
        select: { id: true },
      });
      if (newer) supersededIds.push(row.id);
    }
    return { valuations: created.map(toValuationDto), supersededIds };
  }

  private usablePages(dto: PreviewInsuranceReportDto): ReportPageText[] {
    const seen = new Set<number>();
    for (const p of dto.pages) {
      if (seen.has(p.page)) {
        throw new BadRequestException(`Halaman ${p.page} dikirim dua kali`);
      }
      seen.add(p.page);
    }
    const pages = dto.pages
      .filter((p) => nonWs(p.text) > 0)
      .sort((a, b) => a.page - b.page);
    const total = pages.reduce((n, p) => n + p.text.length, 0);
    if (total > MAX_REPORT_TOTAL_CHARS) {
      throw build(
        HttpStatus.PAYLOAD_TOO_LARGE,
        "INSURANCE_REPORT_TOO_LARGE",
        "Teks laporan terlalu panjang untuk dibaca sekaligus — unggah halaman yang memuat nilai polis saja.",
      );
    }
    // A scan has no text layer. An empty prompt is how a model invents a
    // confident policy value, so the paid call is never made on one.
    if (pages.reduce((n, p) => n + nonWs(p.text), 0) < MIN_REPORT_TEXT_CHARS) {
      throw build(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "INSURANCE_REPORT_NO_TEXT_LAYER",
        "Dokumen ini tidak bisa dibaca: tidak ada lapisan teks (kemungkinan hasil scan/foto). Unduh PDF asli dari perusahaan asuransi, atau isi nilai polis secara manual.",
      );
    }
    return pages;
  }

  private async policy(familyGroupId: string, id: string): Promise<Policy> {
    const p = await this.prisma.insurance.findUnique({
      where: { id, familyGroupId },
      select: { id: true, policyType: true, currency: true },
    });
    if (!p) throw new NotFoundException("Insurance not found");
    return p;
  }

  private async assertDocument(
    familyGroupId: string,
    insuranceId: string,
    documentId: string,
  ): Promise<void> {
    const doc = await this.prisma.insuranceDocument.findFirst({
      where: { id: documentId, insuranceId, familyGroupId },
      select: { id: true },
    });
    if (!doc) {
      throw new BadRequestException("documentId bukan dokumen polis ini");
    }
  }

  /**
   * The fund an item belongs to: an existing fund of THIS policy, or one
   * created (reused by case-insensitive name) inside the confirm
   * transaction. A fund's value is always in the fund's currency.
   */
  private async resolveFund(
    tx: Prisma.TransactionClient,
    policy: Policy,
    item: ConfirmInsuranceReportItemDto,
  ): Promise<{ id: string; currency: string } | null> {
    if (item.fundId) {
      const fund = await tx.insuranceFund.findFirst({
        where: { id: item.fundId, insuranceId: policy.id },
        select: { id: true, currency: true, name: true },
      });
      if (!fund)
        throw new BadRequestException("fundId bukan subdana polis ini");
      assertCurrency(item.currency, fund);
      return fund;
    }
    if (!item.newFundName) return null;
    const name = item.newFundName.trim();
    const existing = await tx.insuranceFund.findFirst({
      where: {
        insuranceId: policy.id,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true, currency: true, name: true },
    });
    if (existing) {
      assertCurrency(item.currency, existing);
      return existing;
    }
    return tx.insuranceFund.create({
      data: {
        insuranceId: policy.id,
        name,
        code: item.newFundCode?.trim() || null,
        currency: item.currency ?? policy.currency,
      },
      select: { id: true, currency: true },
    });
  }
}

function assertCurrency(
  requested: string | undefined,
  fund: { currency: string; name: string },
): void {
  if (requested && requested !== fund.currency) {
    throw new BadRequestException(
      `Mata uang nilai (${requested}) berbeda dengan mata uang subdana "${fund.name}" (${fund.currency})`,
    );
  }
}

/** S5 rules, before anything is written. */
function assertItemShape(
  policy: Policy,
  item: ConfirmInsuranceReportItemDto,
): void {
  const hasFund = !!item.fundId || !!item.newFundName;
  const hasUnits = item.units !== undefined || item.navPerUnit !== undefined;
  if (hasFund && policy.policyType !== "unit_link") {
    throw new BadRequestException(
      "Subdana hanya untuk polis Unit Link — tetapkan tipe polis terlebih dahulu",
    );
  }
  if (hasUnits) {
    if (item.units === undefined || item.navPerUnit === undefined) {
      throw new BadRequestException(
        "Jumlah unit dan NAB per unit harus diisi bersamaan",
      );
    }
    if (item.reportedValue !== undefined) {
      throw new BadRequestException(
        "Isi nilai yang dilaporkan ATAU unit × NAB, tidak keduanya (menghindari nilai ganda)",
      );
    }
    if (!hasFund) {
      throw new BadRequestException("Unit × NAB memerlukan subdana");
    }
  }
  const hasValue =
    hasUnits ||
    item.reportedValue !== undefined ||
    item.cashValue !== undefined ||
    item.surrenderEstimate !== undefined ||
    item.maturityBenefit !== undefined;
  if (!hasValue) {
    throw new BadRequestException(
      "Data belum lengkap — isi nilai polis, unit × NAB, atau nilai tunai",
    );
  }
}
