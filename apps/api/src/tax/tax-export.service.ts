import { Injectable } from "@nestjs/common";

import { renderPdfReport } from "../exports/pdf-report-writer.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TaxSummaryService } from "./tax-summary.service";

import type { PdfReportContent } from "../exports/pdf-report-writer.util";
import type { TaxAnnualSummaryDto } from "@wealthme/contracts";

function rupiah(digits: string): string {
  const n = Number(digits);
  return Number.isFinite(n) ? `Rp ${n.toLocaleString("id-ID")}` : digits;
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

/** Shared row layout for both the CSV and PDF tax-summary exports. */
function summaryRows(summary: TaxAnnualSummaryDto): string[][] {
  return [
    ["Item", "Nilai"],
    [
      "PPh OP (mode)",
      summary.pphOp ? `${summary.pphOp.tax} (${summary.pphOp.calcMode})` : "-",
    ],
    ["Pajak Final (jumlah baris)", String(summary.finalTax.lineCount)],
    ["Pajak Final (total)", rupiah(summary.finalTax.totalTax)],
    ["UMKM PP 55 (total)", summary.umkm ? rupiah(summary.umkm.totalTax) : "-"],
    ["Total Estimasi Pajak", rupiah(summary.totalEstimatedTax)],
    ["Status SPT", summary.spt.status ?? "-"],
    ["Batas Waktu SPT", summary.spt.deadline],
    ["Tanggal Lapor", summary.spt.filedAt ?? "-"],
  ];
}

/**
 * Hardening batch G2 — tax's "Unduh Ringkasan" used to only toast
 * "belum tersedia". Real CSV + PDF exports of the same TaxAnnualSummaryDto
 * already computed for the on-page summary, reusing the exports module's
 * renderPdfReport (pdf-lib is already a project dependency).
 */
@Injectable()
export class TaxExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly summaryService: TaxSummaryService,
  ) {}

  async csv(familyGroupId: string, taxYear: number): Promise<string> {
    const summary = await this.summaryService.summary(familyGroupId, taxYear);
    return formatCsv(summaryRows(summary));
  }

  async pdf(familyGroupId: string, taxYear: number): Promise<Uint8Array> {
    const [summary, familyGroup] = await Promise.all([
      this.summaryService.summary(familyGroupId, taxYear),
      this.prisma.familyGroup.findUnique({
        where: { id: familyGroupId },
        select: { name: true },
      }),
    ]);
    const generatedAt = new Date().toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const content: PdfReportContent = {
      title: `Ringkasan Pajak ${taxYear}`,
      meta: [
        `Keluarga: ${familyGroup?.name ?? "-"}`,
        `Dibuat pada: ${generatedAt}`,
      ],
      sections: [
        { header: ["Item", "Nilai"], rows: summaryRows(summary).slice(1) },
      ],
    };
    return renderPdfReport(content);
  }
}
