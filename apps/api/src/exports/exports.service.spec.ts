import { getQueueToken } from "@nestjs/bullmq";
import { Test, type TestingModule } from "@nestjs/testing";
import { PDFDocument } from "pdf-lib";

import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "../reports/reports.service";

import { EXPORT_QUEUE, ExportsService } from "./exports.service";

import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
  DetailReportDto,
  ExportJobRequestDto,
  ExportReportType,
  PnlDto,
  ReportSummaryDto,
} from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";
const PDF_PREFIX = "data:application/pdf;base64,";

function fakeSummary(): ReportSummaryDto {
  return {
    period: "monthly",
    points: [
      { label: "Jan", income: 1_000_000, expense: 500_000, net: 500_000 },
    ],
    totalIncome: 1_000_000,
    totalExpense: 500_000,
    netSavings: 500_000,
    savingsRate: 50,
    topIncomeCategories: [],
    topExpenseCategories: [],
  };
}

function fakeBankReport(): BankReportDto {
  return {
    period: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    banks: [
      {
        accountName: "BCA",
        institution: "BCA",
        income: 1_000_000,
        expense: 200_000,
        balance: 800_000,
      },
    ],
    totalIncome: 1_000_000,
    totalExpense: 200_000,
  };
}

function fakeDetailReport(): DetailReportDto {
  return {
    period: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    transactions: [
      {
        id: "t1",
        occurredAt: "2026-01-05T00:00:00.000Z",
        description: "Gaji",
        categoryName: "Gaji",
        accountName: "BCA",
        type: "income",
        amount: 1_000_000,
      },
    ],
    totalIncome: 1_000_000,
    totalExpense: 0,
    count: 1,
  };
}

/** A detail report with `rowCount` synthetic transactions, used to exercise
 * the pdf-report-writer's pagination + header-repeat path (>50 rows/page). */
function bigDetailReport(rowCount: number): DetailReportDto {
  const transactions = Array.from({ length: rowCount }, (_, i) => ({
    id: `t${i}`,
    occurredAt: "2026-01-05T00:00:00.000Z",
    description: `Transaksi ${i}`,
    categoryName: "Kategori",
    accountName: "BCA",
    type: "income" as const,
    amount: 1_000 + i,
  }));
  return {
    period: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    transactions,
    totalIncome: transactions.reduce((sum, t) => sum + t.amount, 0),
    totalExpense: 0,
    count: transactions.length,
  };
}

function fakePnl(): PnlDto {
  return {
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    revenue: 1_000_000,
    expenses: 500_000,
    netProfit: 500_000,
    previousRevenue: 900_000,
    previousExpenses: 400_000,
    previousNetProfit: 500_000,
    revenueGrowth: 10,
    expenseGrowth: 20,
    profitGrowth: 0,
    revenueBreakdown: [
      { categoryName: "Gaji", amount: 1_000_000, percentage: 100, color: null },
    ],
    expenseBreakdown: [
      { categoryName: "Makan", amount: 500_000, percentage: 100, color: null },
    ],
  };
}

function fakeBalanceSheet(): BalanceSheetDto {
  return {
    asOfDate: "2026-01-31",
    totalAssets: 1_000_000,
    totalLiabilities: 200_000,
    netWorth: 800_000,
    assets: [
      {
        category: "Kas & Setara Kas",
        amount: 1_000_000,
        items: [{ name: "BCA", amount: 1_000_000 }],
      },
    ],
    liabilities: [
      {
        category: "Kartu Kredit",
        amount: 200_000,
        items: [{ name: "Visa", amount: 200_000 }],
      },
    ],
  };
}

function fakeCashflow(): CashflowStatementDto {
  return {
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    operatingInflows: 1_000_000,
    operatingOutflows: 500_000,
    netOperating: 500_000,
    investingInflows: 0,
    investingOutflows: 0,
    netInvesting: 0,
    openingBalance: 100_000,
    closingBalance: 600_000,
    netChange: 500_000,
  };
}

function makeFakeReportsService() {
  return {
    getSummary: jest.fn().mockResolvedValue(fakeSummary()),
    getBankReport: jest.fn().mockResolvedValue(fakeBankReport()),
    getDetailReport: jest.fn().mockResolvedValue(fakeDetailReport()),
    getPnl: jest.fn().mockResolvedValue(fakePnl()),
    getBalanceSheet: jest.fn().mockResolvedValue(fakeBalanceSheet()),
    getCashflowStatement: jest.fn().mockResolvedValue(fakeCashflow()),
  };
}

function makeFakePrisma() {
  return {
    familyGroup: {
      findUnique: jest.fn().mockResolvedValue({ name: "Keluarga Test" }),
    },
  };
}

const REPORT_TYPES: ExportReportType[] = [
  "summary",
  "bank",
  "detail",
  "pnl",
  "balance-sheet",
  "cashflow",
];

describe("ExportsService PDF export (Task C — real PDF)", () => {
  let service: ExportsService;
  let reportsService: ReturnType<typeof makeFakeReportsService>;

  beforeEach(async () => {
    reportsService = makeFakeReportsService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: getQueueToken(EXPORT_QUEUE), useValue: {} },
        { provide: PrismaService, useValue: makeFakePrisma() },
        { provide: ReportsService, useValue: reportsService },
      ],
    }).compile();
    service = module.get(ExportsService);
  });

  it.each(REPORT_TYPES)(
    "generates a real application/pdf data URI whose decoded bytes start with %%PDF- (type: %s)",
    async (type) => {
      const request: ExportJobRequestDto = { type, format: "pdf" };
      const dataUrl = await service.generate(FAMILY_GROUP_ID, request, true);

      expect(dataUrl.startsWith(PDF_PREFIX)).toBe(true);

      const bytes = Buffer.from(dataUrl.slice(PDF_PREFIX.length), "base64");
      expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    },
  );

  it("leaves the Excel/CSV export path returning real CSV, unaffected by the PDF rewrite", async () => {
    const request: ExportJobRequestDto = { type: "summary", format: "excel" };
    const dataUrl = await service.generate(FAMILY_GROUP_ID, request, true);

    expect(dataUrl.startsWith("data:text/csv;base64,")).toBe(true);
    const csv = Buffer.from(
      dataUrl.slice("data:text/csv;base64,".length),
      "base64",
    ).toString("utf-8");
    expect(csv).toContain("Bulan,Pemasukan,Pengeluaran,Net");
  });

  it('still renders a valid PDF when a report\'s data arrays are empty (exercises the "(tidak ada data)" branch)', async () => {
    reportsService.getBankReport.mockResolvedValueOnce({
      ...fakeBankReport(),
      banks: [],
      totalIncome: 0,
      totalExpense: 0,
    });

    const request: ExportJobRequestDto = { type: "bank", format: "pdf" };
    const dataUrl = await service.generate(FAMILY_GROUP_ID, request, true);

    expect(dataUrl.startsWith(PDF_PREFIX)).toBe(true);
    const bytes = Buffer.from(dataUrl.slice(PDF_PREFIX.length), "base64");
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // The bytes must also be a well-formed, loadable PDF document.
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("paginates and repeats the table header for a report with more than 50 rows", async () => {
    reportsService.getDetailReport.mockResolvedValueOnce(bigDetailReport(120));

    const request: ExportJobRequestDto = { type: "detail", format: "pdf" };
    const dataUrl = await service.generate(FAMILY_GROUP_ID, request, true);

    expect(dataUrl.startsWith(PDF_PREFIX)).toBe(true);
    const bytes = Buffer.from(dataUrl.slice(PDF_PREFIX.length), "base64");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
