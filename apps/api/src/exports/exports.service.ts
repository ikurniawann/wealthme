import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReportsService } from "../reports/reports.service";

import type {
  ExportFormat,
  ExportJobRequestDto,
  ExportJobStatus,
  ExportJobStatusDto,
  ExportReportType,
} from "@wealthme/contracts";
import type { Queue } from "bullmq";

export const EXPORT_QUEUE = "exports";

export interface ExportJobData {
  familyGroupId: string;
  request: ExportJobRequestDto;
  canSeePrivate: boolean;
}

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

function formatTxt(sections: { title: string; body: string }[]): string {
  return sections.map((s) => `=== ${s.title} ===\n${s.body}`).join("\n\n");
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

  private async buildCsv(
    familyGroupId: string,
    type: ExportReportType,
    startDate: Date,
    endDate: Date,
    months: number,
    canSeePrivate: boolean,
  ): Promise<string> {
    let rows: string[][];

    switch (type) {
      case "summary": {
        const data = await this.reportsService.getSummary(
          familyGroupId,
          "monthly",
          months,
          canSeePrivate,
        );
        rows = [
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
        break;
      }
      case "bank": {
        const data = await this.reportsService.getBankReport(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        rows = [
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
        break;
      }
      case "detail": {
        const data = await this.reportsService.getDetailReport(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        rows = [
          ["Tanggal", "Keterangan", "Kategori", "Akun", "Tipe", "Jumlah"],
          ...data.transactions.map((t) => [
            t.occurredAt.slice(0, 10),
            t.description ?? "",
            t.categoryName ?? "",
            t.accountName,
            t.type,
            String(t.amount),
          ]),
          [],
          ["Total Pemasukan", rupiah(data.totalIncome)],
          ["Total Pengeluaran", rupiah(data.totalExpense)],
          ["Jumlah Transaksi", String(data.count)],
        ];
        break;
      }
      case "pnl": {
        const data = await this.reportsService.getPnl(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        rows = [
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
        break;
      }
      case "balance-sheet": {
        const data = await this.reportsService.getBalanceSheet(
          familyGroupId,
          endDate,
          canSeePrivate,
        );
        rows = [
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
        break;
      }
      case "cashflow": {
        const data = await this.reportsService.getCashflowStatement(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        rows = [
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
        break;
      }
      default: {
        rows = [["No data available"]];
      }
    }

    const csv = formatCsv(rows);
    const b64 = Buffer.from(csv, "utf-8").toString("base64");
    return `data:text/csv;base64,${b64}`;
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
    const sections: { title: string; body: string }[] = [];

    switch (type) {
      case "summary": {
        const data = await this.reportsService.getSummary(
          familyGroupId,
          "monthly",
          months,
          canSeePrivate,
        );
        const lines = [
          `Total Pemasukan : ${rupiah(data.totalIncome)}`,
          `Total Pengeluaran: ${rupiah(data.totalExpense)}`,
          `Net Savings      : ${rupiah(data.netSavings)}`,
          `Savings Rate     : ${data.savingsRate}%`,
          "",
          "Tren Bulanan:",
          ...data.points.map(
            (p) =>
              `  ${p.label}: Masuk ${rupiah(p.income)} | Keluar ${rupiah(p.expense)} | Net ${rupiah(p.net)}`,
          ),
        ];
        sections.push({ title: "Ringkasan Keuangan", body: lines.join("\n") });
        break;
      }
      case "bank": {
        const data = await this.reportsService.getBankReport(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        const lines = [
          `Periode: ${periodLabel}`,
          "",
          ...data.banks.map(
            (b) =>
              `${b.accountName} (${b.institution ?? "-"}): Masuk ${rupiah(b.income)} | Keluar ${rupiah(b.expense)} | Saldo ${rupiah(b.balance)}`,
          ),
          "",
          `Total Pemasukan : ${rupiah(data.totalIncome)}`,
          `Total Pengeluaran: ${rupiah(data.totalExpense)}`,
        ];
        sections.push({ title: "Laporan Bank", body: lines.join("\n") });
        break;
      }
      case "detail": {
        const data = await this.reportsService.getDetailReport(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        const lines = [
          `Periode: ${periodLabel}`,
          `Jumlah Transaksi: ${data.count}`,
          "",
          ...data.transactions.map(
            (t) =>
              `${t.occurredAt.slice(0, 10)} | ${t.accountName} | ${t.categoryName ?? "-"} | ${t.type} | ${rupiah(t.amount)}${t.description ? ` | ${t.description}` : ""}`,
          ),
          "",
          `Total Pemasukan : ${rupiah(data.totalIncome)}`,
          `Total Pengeluaran: ${rupiah(data.totalExpense)}`,
        ];
        sections.push({ title: "Detail Transaksi", body: lines.join("\n") });
        break;
      }
      case "pnl": {
        const data = await this.reportsService.getPnl(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        const lines = [
          `Periode: ${periodLabel}`,
          "",
          `Revenue     : ${rupiah(data.revenue)} (growth: ${data.revenueGrowth}%)`,
          `Expenses    : ${rupiah(data.expenses)} (growth: ${data.expenseGrowth}%)`,
          `Net Profit  : ${rupiah(data.netProfit)} (growth: ${data.profitGrowth}%)`,
          "",
          "Breakdown Pendapatan:",
          ...data.revenueBreakdown.map(
            (b) =>
              `  ${b.categoryName}: ${rupiah(b.amount)} (${b.percentage}%)`,
          ),
          "",
          "Breakdown Pengeluaran:",
          ...data.expenseBreakdown.map(
            (b) =>
              `  ${b.categoryName}: ${rupiah(b.amount)} (${b.percentage}%)`,
          ),
        ];
        sections.push({
          title: "Profit & Loss Statement",
          body: lines.join("\n"),
        });
        break;
      }
      case "balance-sheet": {
        const data = await this.reportsService.getBalanceSheet(
          familyGroupId,
          endDate,
          canSeePrivate,
        );
        const assetLines = data.assets.flatMap((a) => [
          `  ${a.category}: ${rupiah(a.amount)}`,
          ...a.items.map((i) => `    - ${i.name}: ${rupiah(i.amount)}`),
        ]);
        const liabLines = data.liabilities.flatMap((l) => [
          `  ${l.category}: ${rupiah(l.amount)}`,
          ...l.items.map((i) => `    - ${i.name}: ${rupiah(i.amount)}`),
        ]);
        const lines = [
          `Per tanggal: ${endDate.toISOString().slice(0, 10)}`,
          "",
          "ASET:",
          ...assetLines,
          `  Total Aset: ${rupiah(data.totalAssets)}`,
          "",
          "LIABILITAS:",
          ...liabLines,
          `  Total Liabilitas: ${rupiah(data.totalLiabilities)}`,
          "",
          `NET WORTH: ${rupiah(data.netWorth)}`,
        ];
        sections.push({ title: "Balance Sheet", body: lines.join("\n") });
        break;
      }
      case "cashflow": {
        const data = await this.reportsService.getCashflowStatement(
          familyGroupId,
          startDate,
          endDate,
          canSeePrivate,
        );
        const lines = [
          `Periode: ${periodLabel}`,
          "",
          `Penerimaan Operasi   : ${rupiah(data.operatingInflows)}`,
          `Pengeluaran Operasi  : ${rupiah(data.operatingOutflows)}`,
          `Net Operasi          : ${rupiah(data.netOperating)}`,
          "",
          `Penerimaan Investasi : ${rupiah(data.investingInflows)}`,
          `Pengeluaran Investasi: ${rupiah(data.investingOutflows)}`,
          `Net Investasi        : ${rupiah(data.netInvesting)}`,
          "",
          `Saldo Awal           : ${rupiah(data.openingBalance)}`,
          `Saldo Akhir          : ${rupiah(data.closingBalance)}`,
          `Perubahan Bersih     : ${rupiah(data.netChange)}`,
        ];
        sections.push({ title: "Cashflow Statement", body: lines.join("\n") });
        break;
      }
      default: {
        sections.push({ title: "Laporan", body: "No data available." });
      }
    }

    const txt = formatTxt(sections);
    const b64 = Buffer.from(txt, "utf-8").toString("base64");
    return `data:text/plain;base64,${b64}`;
  }
}
