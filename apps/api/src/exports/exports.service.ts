import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReportsService } from "../reports/reports.service";

import { renderPdfReport } from "./pdf-report-writer.util";

import type { PdfReportContent } from "./pdf-report-writer.util";
import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
  DetailReportDto,
  ExportFormat,
  ExportJobRequestDto,
  ExportJobStatus,
  ExportJobStatusDto,
  ExportReportType,
  PnlDto,
  ReportSummaryDto,
} from "@wealthme/contracts";
import type { Queue } from "bullmq";

export const EXPORT_QUEUE = "exports";

export interface ExportJobData {
  familyGroupId: string;
  request: ExportJobRequestDto;
  canSeePrivate: boolean;
}

/** Pre-fetched report data, tagged by report type so callers can narrow it. */
type ReportData =
  | { type: "summary"; data: ReportSummaryDto }
  | { type: "bank"; data: BankReportDto }
  | { type: "detail"; data: DetailReportDto }
  | { type: "pnl"; data: PnlDto }
  | { type: "balance-sheet"; data: BalanceSheetDto }
  | { type: "cashflow"; data: CashflowStatementDto };

/** In-memory store for job status/result (per process). */
const jobStore = new Map<
  string,
  {
    familyGroupId: string;
    status: ExportJobStatus;
    downloadUrl?: string;
    errorMessage?: string;
  }
>();

function parseDate(iso: string | undefined, fallback: Date): Date {
  if (!iso) return fallback;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? fallback : d;
}

function formatCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    )
    .join("\n");
}

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);
  private readonly jobTtls = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @InjectQueue(EXPORT_QUEUE)
    private readonly exportQueue: Queue<ExportJobData>,
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  async createJob(
    familyGroupId: string,
    request: ExportJobRequestDto,
    canSeePrivate: boolean,
  ): Promise<ExportJobStatusDto> {
    const job = await this.exportQueue.add(
      "generate",
      { familyGroupId, request, canSeePrivate } satisfies ExportJobData,
      { attempts: 2, removeOnComplete: true, removeOnFail: true },
    );

    if (!job.id) throw new Error("BullMQ returned a job with no id");
    const id = job.id;
    jobStore.set(id, { status: "pending", familyGroupId });

    const ttl = setTimeout(
      () => {
        jobStore.delete(id);
        this.jobTtls.delete(id);
      },
      15 * 60 * 1000,
    );
    this.jobTtls.set(id, ttl);

    return { id, status: "pending" };
  }

  getJobStatus(jobId: string, callerFamilyGroupId: string): ExportJobStatusDto {
    const entry = jobStore.get(jobId);
    if (!entry || entry.familyGroupId !== callerFamilyGroupId) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }
    return {
      id: jobId,
      status: entry.status,
      downloadUrl: entry.downloadUrl,
      errorMessage: entry.errorMessage,
    };
  }

  /** Called by the processor to mark a job as processing. */
  markProcessing(jobId: string): void {
    const entry = jobStore.get(jobId);
    if (entry) jobStore.set(jobId, { ...entry, status: "processing" });
  }

  /** Called by the processor to mark a job done with inline data URL. */
  markDone(jobId: string, downloadUrl: string): void {
    const entry = jobStore.get(jobId);
    if (entry) jobStore.set(jobId, { ...entry, status: "done", downloadUrl });
  }

  /** Called by the processor to mark a job failed. */
  markFailed(jobId: string, errorMessage: string): void {
    const entry = jobStore.get(jobId);
    if (entry)
      jobStore.set(jobId, { ...entry, status: "failed", errorMessage });
  }

  /** Generate the export content and return it as a data URI. */
  async generate(
    familyGroupId: string,
    request: ExportJobRequestDto,
    canSeePrivate: boolean,
  ): Promise<string> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(request.startDate, defaultStart);
    const endDate = parseDate(request.endDate, now);
    const months = Math.min(Math.max(request.months ?? 6, 1), 24);

    const content = await this.buildContent(
      familyGroupId,
      request.type,
      request.format,
      startDate,
      endDate,
      months,
      canSeePrivate,
    );

    return content;
  }

  private async buildContent(
    familyGroupId: string,
    type: ExportReportType,
    format: ExportFormat,
    startDate: Date,
    endDate: Date,
    months: number,
    canSeePrivate: boolean,
  ): Promise<string> {
    if (format === "excel") {
      return this.buildCsv(
        familyGroupId,
        type,
        startDate,
        endDate,
        months,
        canSeePrivate,
      );
    }
    return this.buildPdf(
      familyGroupId,
      type,
      startDate,
      endDate,
      months,
      canSeePrivate,
    );
  }

  /**
   * Fetches the underlying report data for `type` exactly once. Shared by
   * both the CSV and PDF builders so the reportsService call per report type
   * is not duplicated across formats.
   */
  private async fetchReportData(
    familyGroupId: string,
    type: ExportReportType,
    startDate: Date,
    endDate: Date,
    months: number,
    canSeePrivate: boolean,
  ): Promise<ReportData> {
    switch (type) {
      case "summary":
        return {
          type,
          // EPIC-022 B6 — anchor the trailing-months window on the caller's
          // selected `endDate` (not the default `new Date()`), so the
          // exported "Ringkasan" matches the period the /laporan screen is
          // actually showing instead of always ending today.
          data: await this.reportsService.getSummary(
            familyGroupId,
            "monthly",
            months,
            canSeePrivate,
            endDate,
          ),
        };
      case "bank":
        return {
          type,
          data: await this.reportsService.getBankReport(
            familyGroupId,
            startDate,
            endDate,
            canSeePrivate,
          ),
        };
      case "detail":
        return {
          type,
          data: await this.reportsService.getDetailReport(
            familyGroupId,
            startDate,
            endDate,
            canSeePrivate,
          ),
        };
      case "pnl":
        return {
          type,
          data: await this.reportsService.getPnl(
            familyGroupId,
            startDate,
            endDate,
            canSeePrivate,
          ),
        };
      case "balance-sheet":
        return {
          type,
          data: await this.reportsService.getBalanceSheet(
            familyGroupId,
            endDate,
            canSeePrivate,
          ),
        };
      case "cashflow":
        return {
          type,
          data: await this.reportsService.getCashflowStatement(
            familyGroupId,
            startDate,
            endDate,
            canSeePrivate,
          ),
        };
    }
  }

  private async buildCsv(
    familyGroupId: string,
    type: ExportReportType,
    startDate: Date,
    endDate: Date,
    months: number,
    canSeePrivate: boolean,
  ): Promise<string> {
    const reportData = await this.fetchReportData(
      familyGroupId,
      type,
      startDate,
      endDate,
      months,
      canSeePrivate,
    );

    const csv = formatCsv(this.buildCsvRows(reportData));
    const b64 = Buffer.from(csv, "utf-8").toString("base64");
    return `data:text/csv;base64,${b64}`;
  }

  /** Builds the spreadsheet-friendly rows (raw numeric cells) for `reportData`. */
  private buildCsvRows(reportData: ReportData): string[][] {
    switch (reportData.type) {
      case "summary": {
        const data = reportData.data;
        return [
          ["Bulan", "Pemasukan", "Pengeluaran", "Net"],
          ...data.points.map((p) => [
            p.label,
            String(p.income),
            String(p.expense),
            String(p.net),
          ]),
          [],
          ["Total Pemasukan", rupiah(data.totalIncome)],
          ["Total Pengeluaran", rupiah(data.totalExpense)],
          ["Net Savings", rupiah(data.netSavings)],
          ["Savings Rate", `${data.savingsRate}%`],
        ];
      }
      case "bank": {
        const data = reportData.data;
        return [
          ["Rekening", "Bank", "Pemasukan", "Pengeluaran", "Saldo"],
          ...data.banks.map((b) => [
            b.accountName,
            b.institution ?? "",
            String(b.income),
            String(b.expense),
            String(b.balance),
          ]),
          [],
          ["Total Pemasukan", rupiah(data.totalIncome)],
          ["Total Pengeluaran", rupiah(data.totalExpense)],
        ];
      }
      case "detail": {
        const data = reportData.data;
        return [
          ["Tanggal", "Keterangan", "Kategori", "Akun", "Tipe", "Jumlah"],
          ...data.transactions.map((t) => [
            t.occurredAt.slice(0, 10),
            t.description ?? "",
            t.categoryName ?? "",
            // EPIC-023 Task E retry (MEDIUM 5) — "-" like the PDF export
            // below (and unlike this CSV row's own `description`/
            // `categoryName` cells before it — that inconsistency is
            // pre-existing and out of this fix's scope), not "" — an empty
            // cell reads as missing data, not as "this purchase has no
            // account".
            t.accountName ?? "-",
            t.type,
            String(t.amount),
          ]),
          [],
          ["Total Pemasukan", rupiah(data.totalIncome)],
          ["Total Pengeluaran", rupiah(data.totalExpense)],
          ["Jumlah Transaksi", String(data.count)],
        ];
      }
      case "pnl": {
        const data = reportData.data;
        return [
          ["Item", "Nilai"],
          ["Revenue", rupiah(data.revenue)],
          ["Expenses", rupiah(data.expenses)],
          ["Net Profit", rupiah(data.netProfit)],
          ["Previous Revenue", rupiah(data.previousRevenue)],
          ["Revenue Growth", `${data.revenueGrowth}%`],
          ["Expense Growth", `${data.expenseGrowth}%`],
          ["Profit Growth", `${data.profitGrowth}%`],
          [],
          ["Kategori Pendapatan", "Jumlah", "%"],
          ...data.revenueBreakdown.map((b) => [
            b.categoryName,
            rupiah(b.amount),
            `${b.percentage}%`,
          ]),
          [],
          ["Kategori Pengeluaran", "Jumlah", "%"],
          ...data.expenseBreakdown.map((b) => [
            b.categoryName,
            rupiah(b.amount),
            `${b.percentage}%`,
          ]),
        ];
      }
      case "balance-sheet": {
        const data = reportData.data;
        return [
          ["Kategori", "Nama", "Jumlah"],
          ...data.assets.flatMap((a) => [
            [a.category, "", rupiah(a.amount)],
            ...a.items.map((i) => ["", i.name, rupiah(i.amount)]),
          ]),
          [],
          ["Total Aset", "", rupiah(data.totalAssets)],
          [],
          ...data.liabilities.flatMap((l) => [
            [l.category, "", rupiah(l.amount)],
            ...l.items.map((i) => ["", i.name, rupiah(i.amount)]),
          ]),
          [],
          ["Total Liabilitas", "", rupiah(data.totalLiabilities)],
          ["Net Worth", "", rupiah(data.netWorth)],
        ];
      }
      case "cashflow": {
        const data = reportData.data;
        return [
          ["Item", "Jumlah"],
          ["Penerimaan Operasi", rupiah(data.operatingInflows)],
          ["Pengeluaran Operasi", rupiah(data.operatingOutflows)],
          ["Net Operasi", rupiah(data.netOperating)],
          ["Penerimaan Investasi", rupiah(data.investingInflows)],
          ["Pengeluaran Investasi", rupiah(data.investingOutflows)],
          ["Net Investasi", rupiah(data.netInvesting)],
          ["Saldo Awal", rupiah(data.openingBalance)],
          ["Saldo Akhir", rupiah(data.closingBalance)],
          ["Perubahan Bersih", rupiah(data.netChange)],
        ];
      }
    }
  }

  private async buildPdf(
    familyGroupId: string,
    type: ExportReportType,
    startDate: Date,
    endDate: Date,
    months: number,
    canSeePrivate: boolean,
  ): Promise<string> {
    const periodLabel = `${startDate.toISOString().slice(0, 10)} s.d. ${endDate.toISOString().slice(0, 10)}`;

    const [familyGroup, reportData] = await Promise.all([
      this.prisma.familyGroup.findUnique({
        where: { id: familyGroupId },
        select: { name: true },
      }),
      this.fetchReportData(
        familyGroupId,
        type,
        startDate,
        endDate,
        months,
        canSeePrivate,
      ),
    ]);

    const rawContent = this.buildPdfContent(reportData, periodLabel, endDate);
    const generatedAt = new Date().toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const content: PdfReportContent = {
      ...rawContent,
      meta: [
        `Keluarga: ${familyGroup?.name ?? "-"}`,
        ...rawContent.meta,
        `Dibuat pada: ${generatedAt}`,
      ],
    };

    const pdfBytes = await renderPdfReport(content);
    const b64 = Buffer.from(pdfBytes).toString("base64");
    return `data:application/pdf;base64,${b64}`;
  }

  /** Builds the printable table layout (Rupiah-formatted cells) for `reportData`. */
  private buildPdfContent(
    reportData: ReportData,
    periodLabel: string,
    endDate: Date,
  ): PdfReportContent {
    switch (reportData.type) {
      case "summary": {
        const data = reportData.data;
        return {
          title: "Ringkasan Keuangan",
          meta: [],
          sections: [
            {
              heading: "Ringkasan",
              header: ["Item", "Nilai"],
              rows: [
                ["Total Pemasukan", rupiah(data.totalIncome)],
                ["Total Pengeluaran", rupiah(data.totalExpense)],
                ["Net Savings", rupiah(data.netSavings)],
                ["Savings Rate", `${data.savingsRate}%`],
              ],
            },
            {
              heading: "Tren Bulanan",
              header: ["Bulan", "Pemasukan", "Pengeluaran", "Net"],
              rows: data.points.map((p) => [
                p.label,
                rupiah(p.income),
                rupiah(p.expense),
                rupiah(p.net),
              ]),
            },
          ],
        };
      }
      case "bank": {
        const data = reportData.data;
        return {
          title: "Laporan Bank",
          meta: [`Periode: ${periodLabel}`],
          sections: [
            {
              header: ["Rekening", "Bank", "Pemasukan", "Pengeluaran", "Saldo"],
              rows: data.banks.map((b) => [
                b.accountName,
                b.institution ?? "-",
                rupiah(b.income),
                rupiah(b.expense),
                rupiah(b.balance),
              ]),
            },
            {
              heading: "Ringkasan",
              header: ["Item", "Nilai"],
              rows: [
                ["Total Pemasukan", rupiah(data.totalIncome)],
                ["Total Pengeluaran", rupiah(data.totalExpense)],
              ],
            },
          ],
        };
      }
      case "detail": {
        const data = reportData.data;
        return {
          title: "Detail Transaksi",
          meta: [`Periode: ${periodLabel}`, `Jumlah Transaksi: ${data.count}`],
          sections: [
            {
              header: [
                "Tanggal",
                "Keterangan",
                "Kategori",
                "Akun",
                "Tipe",
                "Jumlah",
              ],
              rows: data.transactions.map((t) => [
                t.occurredAt.slice(0, 10),
                t.description ?? "-",
                t.categoryName ?? "-",
                t.accountName ?? "-",
                t.type,
                rupiah(t.amount),
              ]),
            },
            {
              heading: "Ringkasan",
              header: ["Item", "Nilai"],
              rows: [
                ["Total Pemasukan", rupiah(data.totalIncome)],
                ["Total Pengeluaran", rupiah(data.totalExpense)],
              ],
            },
          ],
        };
      }
      case "pnl": {
        const data = reportData.data;
        return {
          title: "Profit & Loss Statement",
          meta: [`Periode: ${periodLabel}`],
          sections: [
            {
              heading: "Ringkasan",
              header: ["Item", "Nilai"],
              rows: [
                ["Revenue", rupiah(data.revenue)],
                ["Revenue Growth", `${data.revenueGrowth}%`],
                ["Expenses", rupiah(data.expenses)],
                ["Expense Growth", `${data.expenseGrowth}%`],
                ["Net Profit", rupiah(data.netProfit)],
                ["Profit Growth", `${data.profitGrowth}%`],
              ],
            },
            {
              heading: "Breakdown Pendapatan",
              header: ["Kategori", "Jumlah", "%"],
              rows: data.revenueBreakdown.map((b) => [
                b.categoryName,
                rupiah(b.amount),
                `${b.percentage}%`,
              ]),
            },
            {
              heading: "Breakdown Pengeluaran",
              header: ["Kategori", "Jumlah", "%"],
              rows: data.expenseBreakdown.map((b) => [
                b.categoryName,
                rupiah(b.amount),
                `${b.percentage}%`,
              ]),
            },
          ],
        };
      }
      case "balance-sheet": {
        const data = reportData.data;
        return {
          title: "Balance Sheet",
          meta: [`Per tanggal: ${endDate.toISOString().slice(0, 10)}`],
          sections: [
            {
              heading: "Aset",
              header: ["Kategori", "Nama", "Jumlah"],
              rows: [
                ...data.assets.flatMap((a) => [
                  [a.category, "", rupiah(a.amount)],
                  ...a.items.map((i) => ["", i.name, rupiah(i.amount)]),
                ]),
                ["Total Aset", "", rupiah(data.totalAssets)],
              ],
            },
            {
              heading: "Liabilitas",
              header: ["Kategori", "Nama", "Jumlah"],
              rows: [
                ...data.liabilities.flatMap((l) => [
                  [l.category, "", rupiah(l.amount)],
                  ...l.items.map((i) => ["", i.name, rupiah(i.amount)]),
                ]),
                ["Total Liabilitas", "", rupiah(data.totalLiabilities)],
              ],
            },
            {
              heading: "Net Worth",
              header: ["Item", "Jumlah"],
              rows: [["Net Worth", rupiah(data.netWorth)]],
            },
          ],
        };
      }
      case "cashflow": {
        const data = reportData.data;
        return {
          title: "Cashflow Statement",
          meta: [`Periode: ${periodLabel}`],
          sections: [
            {
              heading: "Ringkasan",
              header: ["Item", "Jumlah"],
              rows: [
                ["Penerimaan Operasi", rupiah(data.operatingInflows)],
                ["Pengeluaran Operasi", rupiah(data.operatingOutflows)],
                ["Net Operasi", rupiah(data.netOperating)],
                ["Penerimaan Investasi", rupiah(data.investingInflows)],
                ["Pengeluaran Investasi", rupiah(data.investingOutflows)],
                ["Net Investasi", rupiah(data.netInvesting)],
                ["Saldo Awal", rupiah(data.openingBalance)],
                ["Saldo Akhir", rupiah(data.closingBalance)],
                ["Perubahan Bersih", rupiah(data.netChange)],
              ],
            },
          ],
        };
      }
    }
  }
}
