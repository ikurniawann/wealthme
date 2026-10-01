"use client";

// G7 (hardening batch, user request 2026-09-29) — the server PDF export
// (pdf-lib, plain tables) "masih jelek banget"; this is a print-optimized
// HTML report instead: reachable inside the authenticated app but rendered
// WITHOUT the app shell (this route lives outside the `(app)` group, so no
// sidebar/topbar), styled for @media print / @page A4, and downloaded as a
// PDF via the browser's own "Save as PDF" print target (no server
// Chromium — staging has 1.9 GB RAM, too little for a headless browser).
// The server PDF endpoint (apps/api/src/exports) keeps working unchanged
// for API consumers; only the /laporan header's "Unduh PDF" button now
// opens this page instead of calling that job.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReportSummaryDto } from "@wealthme/contracts";

import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";

type FamilyGroupMine = { id: string; name: string };

const CHART_HEIGHT = 160;
const CHART_BAR_GAP = 6;

function wibNow(): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

function MonthlyBarChart({ points }: { points: ReportSummaryDto["points"] }) {
  const withData = points.filter((p) => p.income > 0 || p.expense > 0);
  if (withData.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expense)));
  const barWidth = 100 / points.length;

  return (
    <svg
      viewBox={`0 0 100 ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="chart-svg"
      role="img"
      aria-label="Grafik tren bulanan pemasukan vs pengeluaran"
    >
      {points.map((p, i) => {
        const x = i * barWidth;
        const incomeH = (p.income / max) * (CHART_HEIGHT - 20);
        const expenseH = (p.expense / max) * (CHART_HEIGHT - 20);
        const w = (barWidth - CHART_BAR_GAP / points.length) / 2;
        return (
          <g key={p.label}>
            <rect
              x={x + 1}
              y={CHART_HEIGHT - 20 - incomeH}
              width={w}
              height={incomeH}
              fill="#0f766e"
            />
            <rect
              x={x + 1 + w}
              y={CHART_HEIGHT - 20 - expenseH}
              width={w}
              height={expenseH}
              fill="#b91c1c"
            />
            <text
              x={x + barWidth / 2}
              y={CHART_HEIGHT - 6}
              fontSize="4"
              textAnchor="middle"
              fill="#475569"
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LaporanCetakContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isSessionPending = sessionStatus === "loading";
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? "";

  const months = Number(params.get("months") ?? "6") || 6;
  const endDate =
    params.get("endDate") ?? new Date().toISOString().slice(0, 10);

  const [summary, setSummary] = useState<ReportSummaryDto | null>(null);
  const [familyName, setFamilyName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [generatedAt] = useState<string>(() => wibNow());

  useEffect(() => {
    if (!isSessionPending && !token) {
      router.replace("/login");
    }
  }, [isSessionPending, token, router]);

  useEffect(() => {
    if (!token || !familyGroupId) return;
    let cancelled = false;
    (async () => {
      try {
        const [summaryRes, groups] = await Promise.all([
          apiFetch<ReportSummaryDto>(
            `/family-groups/${familyGroupId}/reports/summary?months=${months}&endDate=${endDate}`,
            { token },
          ),
          apiFetch<FamilyGroupMine[]>("/family-groups/mine", { token }),
        ]);
        if (cancelled) return;
        setSummary(summaryRes);
        setFamilyName(groups.find((g) => g.id === familyGroupId)?.name ?? "");
      } catch {
        if (!cancelled) setError("Gagal memuat data laporan.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, familyGroupId, months, endDate]);

  const monthsWithData = useMemo(
    () =>
      summary?.points.filter((p) => p.income > 0 || p.expense > 0).length ?? 0,
    [summary],
  );

  if (error) {
    return <div className="cetak-shell cetak-error">{error}</div>;
  }
  if (!summary) {
    return <div className="cetak-shell cetak-loading">Menyiapkan laporan…</div>;
  }

  const periodLabel = `${months} bulan terakhir hingga ${new Date(
    endDate,
  ).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  return (
    <div className="cetak-shell">
      <div className="cetak-toolbar no-print">
        <button type="button" onClick={() => window.print()}>
          Unduh PDF
        </button>
        <button type="button" onClick={() => router.back()}>
          Kembali
        </button>
      </div>

      <header className="cetak-header">
        <div className="cetak-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- print page, no next/image optimization needed */}
          <img src="/brand/wealthme-mark.png" alt="" className="cetak-logo" />
          <div>
            <div className="cetak-brand-name">WealthMe</div>
            <div className="cetak-report-title">Ringkasan Keuangan</div>
          </div>
        </div>
        <div className="cetak-meta">
          {familyName && <div>Keluarga {familyName}</div>}
          <div>Periode: {periodLabel}</div>
          <div>Dibuat: {generatedAt} WIB</div>
        </div>
      </header>

      <section className="cetak-kpis">
        <div className="cetak-kpi">
          <div className="cetak-kpi-label">Pemasukan</div>
          <div className="cetak-kpi-value cetak-kpi-positive">
            {formatRupiah(summary.totalIncome ?? 0)}
          </div>
        </div>
        <div className="cetak-kpi">
          <div className="cetak-kpi-label">Pengeluaran</div>
          <div className="cetak-kpi-value cetak-kpi-negative">
            {formatRupiah(summary.totalExpense ?? 0)}
          </div>
        </div>
        <div className="cetak-kpi">
          <div className="cetak-kpi-label">Tabungan Bersih</div>
          <div className="cetak-kpi-value">
            {formatRupiah(summary.netSavings ?? 0)}
          </div>
        </div>
        <div className="cetak-kpi">
          <div className="cetak-kpi-label">Savings Rate</div>
          <div className="cetak-kpi-value">{summary.savingsRate}%</div>
        </div>
      </section>

      <section className="cetak-section">
        <h2>Tren Bulanan</h2>
        {monthsWithData === 0 ? (
          <p className="cetak-muted">
            Belum ada data transaksi pada periode ini.
          </p>
        ) : (
          <>
            {monthsWithData === 1 && (
              <p className="cetak-muted">
                Baru satu bulan yang punya data, tren belum bisa dibandingkan.
              </p>
            )}
            <MonthlyBarChart points={summary.points} />
            <table className="cetak-table">
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th>Pemasukan</th>
                  <th>Pengeluaran</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {summary.points.map((p) => {
                  const hasData = p.income > 0 || p.expense > 0;
                  return (
                    <tr key={p.label}>
                      <td>{p.label}</td>
                      <td>{hasData ? formatRupiah(p.income) : "—"}</td>
                      <td>{hasData ? formatRupiah(p.expense) : "—"}</td>
                      <td>{hasData ? formatRupiah(p.net) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="cetak-section">
        <h2>Kategori Pengeluaran Terbesar</h2>
        {summary.topExpenseCategories.length === 0 ? (
          <p className="cetak-muted">Belum ada pengeluaran tercatat.</p>
        ) : (
          <div className="cetak-bars">
            {summary.topExpenseCategories.map((c) => (
              <div className="cetak-bar-row" key={c.categoryName}>
                <span className="cetak-bar-label">{c.categoryName}</span>
                <span className="cetak-bar-track">
                  <span
                    className="cetak-bar-fill"
                    style={{ width: `${Math.min(100, c.percentage)}%` }}
                  />
                </span>
                <span className="cetak-bar-value">
                  {formatRupiah(c.amount)} ({c.percentage}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="cetak-footer">
        Dibuat dengan WealthMe · Laporan ini adalah ringkasan, bukan nasihat
        keuangan atau pajak resmi.
      </footer>

      <style>{`
        body {
          background: #f8fafc;
          font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            "Segoe UI",
            sans-serif;
          color: #0f172a;
        }
        .cetak-shell {
          max-width: 800px;
          margin: 24px auto;
          padding: 32px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
        }
        .cetak-loading,
        .cetak-error {
          text-align: center;
          padding: 64px 24px;
          color: #475569;
        }
        .cetak-toolbar {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-bottom: 16px;
        }
        .cetak-toolbar button {
          border: 1px solid #cbd5e1;
          background: #0f766e;
          color: #fff;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .cetak-toolbar button:last-child {
          background: #fff;
          color: #0f172a;
        }
        .cetak-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .cetak-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cetak-logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }
        .cetak-brand-name {
          font-weight: 800;
          font-size: 16px;
        }
        .cetak-report-title {
          font-size: 20px;
          font-weight: 800;
        }
        .cetak-meta {
          text-align: right;
          font-size: 11px;
          color: #475569;
          line-height: 1.6;
        }
        .cetak-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .cetak-kpi {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          break-inside: avoid;
        }
        .cetak-kpi-label {
          font-size: 10.5px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .cetak-kpi-value {
          font-size: 17px;
          font-weight: 800;
        }
        .cetak-kpi-positive {
          color: #0f766e;
        }
        .cetak-kpi-negative {
          color: #b91c1c;
        }
        .cetak-section {
          margin-bottom: 24px;
          break-inside: avoid;
        }
        .cetak-section h2 {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #334155;
          margin-bottom: 10px;
        }
        .cetak-muted {
          color: #64748b;
          font-size: 12.5px;
        }
        .chart-svg {
          width: 100%;
          height: 160px;
        }
        .cetak-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
          margin-top: 10px;
        }
        .cetak-table th,
        .cetak-table td {
          text-align: right;
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .cetak-table th:first-child,
        .cetak-table td:first-child {
          text-align: left;
        }
        .cetak-table thead {
          display: table-header-group;
        }
        .cetak-bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cetak-bar-row {
          display: grid;
          grid-template-columns: 130px 1fr 160px;
          align-items: center;
          gap: 8px;
          font-size: 11.5px;
        }
        .cetak-bar-track {
          background: #e2e8f0;
          border-radius: 6px;
          height: 10px;
          overflow: hidden;
        }
        .cetak-bar-fill {
          display: block;
          height: 100%;
          background: #0f766e;
        }
        .cetak-bar-value {
          text-align: right;
          color: #334155;
        }
        .cetak-footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
          font-size: 10px;
          color: #94a3b8;
        }

        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #fff;
          }
          .cetak-shell {
            margin: 0;
            box-shadow: none;
            border-radius: 0;
            max-width: none;
          }
          @page {
            size: A4;
            margin: 16mm 14mm;
          }
          .cetak-footer::after {
            content: "Dibuat dengan WealthMe · halaman " counter(page) " dari "
              counter(pages);
          }
        }
      `}</style>
    </div>
  );
}

export default function LaporanCetakPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Memuat…</div>}>
      <LaporanCetakContent />
    </Suspense>
  );
}
