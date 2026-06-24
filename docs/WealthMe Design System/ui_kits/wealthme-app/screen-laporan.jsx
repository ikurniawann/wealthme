/* WealthMe UI-kit — Laporan (reports hub, 16 report tabs). */
const LAP_TABS = [
  { id: "rsum", label: "Ringkasan" },
  { id: "rharian", label: "Laporan Harian" },
  { id: "rbulanan", label: "Laporan Bulanan" },
  { id: "rtahunan", label: "Laporan Tahunan" },
  { id: "rfamily", label: "Group Family" },
  { id: "rbank", label: "Laporan Bank" },
  { id: "rdetail", label: "Laporan Detail" },
  { id: "raliran", label: "Aliran Dana" },
  { id: "rpnl", label: "PNL" },
  { id: "rbalance", label: "Balance Sheet" },
  { id: "rcashflow", label: "Cashflow" },
  { id: "rkas", label: "Arus Kas" },
  { id: "rinv", label: "Investasi" },
  { id: "rasl", label: "Aset & Liabilitas" },
  { id: "rperf", label: "Performa" },
  { id: "rpajak", label: "Pajak" },
];

function ScreenLaporan() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, BarChart, Button, StatusBadge } = DS;
  const { rise, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const L = WM.laporan;
  const [tab, setTab] = React.useState("rsum");
  const fmt = WM.formatRupiah,
    fc = WM.formatCompact;

  const totIncome = L.monthly.reduce((a, m) => a + m.income, 0);
  const totExpense = L.monthly.reduce((a, m) => a + m.expense, 0);

  const Row = ({ k, v, color, bold }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "9px 0",
        borderTop: "1px solid var(--border)",
        fontSize: 13,
        fontWeight: bold ? 800 : 500,
      }}
    >
      <span
        style={{
          color: bold ? "var(--foreground)" : "var(--muted-foreground)",
        }}
      >
        {k}
      </span>
      <span
        className="mono"
        style={{
          color: color || "var(--foreground)",
          fontWeight: bold ? 800 : 600,
        }}
      >
        {fmt(v)}
      </span>
    </div>
  );

  function report() {
    if (
      tab === "rbulanan" ||
      tab === "rtahunan" ||
      tab === "rharian" ||
      tab === "rdetail" ||
      tab === "rfamily" ||
      tab === "rbank"
    ) {
      return (
        <SectionCard title="Laporan Bulanan — 2026">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--muted-foreground)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "8px 0", fontWeight: 700 }}>Bulan</th>
                <th
                  style={{
                    padding: "8px 0",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  Pemasukan
                </th>
                <th
                  style={{
                    padding: "8px 0",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  Pengeluaran
                </th>
                <th
                  style={{
                    padding: "8px 0",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  Surplus
                </th>
              </tr>
            </thead>
            <tbody>
              {L.monthly.map((m) => (
                <tr
                  key={m.month}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "10px 0", fontWeight: 600 }}>
                    {m.month}
                  </td>
                  <td
                    className="mono"
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      color: "var(--success)",
                    }}
                  >
                    {fc(m.income)}
                  </td>
                  <td
                    className="mono"
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      color: "var(--destructive)",
                    }}
                  >
                    {fc(m.expense)}
                  </td>
                  <td
                    className="mono"
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    {fc(m.income - m.expense)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td style={{ padding: "10px 0", fontWeight: 800 }}>Total</td>
                <td
                  className="mono"
                  style={{
                    padding: "10px 0",
                    textAlign: "right",
                    fontWeight: 800,
                    color: "var(--success)",
                  }}
                >
                  {fc(totIncome)}
                </td>
                <td
                  className="mono"
                  style={{
                    padding: "10px 0",
                    textAlign: "right",
                    fontWeight: 800,
                    color: "var(--destructive)",
                  }}
                >
                  {fc(totExpense)}
                </td>
                <td
                  className="mono"
                  style={{
                    padding: "10px 0",
                    textAlign: "right",
                    fontWeight: 800,
                  }}
                >
                  {fc(totIncome - totExpense)}
                </td>
              </tr>
            </tbody>
          </table>
        </SectionCard>
      );
    }
    if (tab === "rpnl") {
      const inc = L.pnl.income.reduce((a, x) => a + x.v, 0),
        exp = L.pnl.expense.reduce((a, x) => a + x.v, 0);
      return (
        <SectionCard title="Laporan Laba Rugi (PNL) — Juni 2026">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".05em",
              color: "var(--success)",
              margin: "4px 0",
            }}
          >
            Pemasukan
          </div>
          {L.pnl.income.map((x) => (
            <Row key={x.k} k={x.k} v={x.v} color="var(--success)" />
          ))}
          <Row k="Total Pemasukan" v={inc} color="var(--success)" bold />
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".05em",
              color: "var(--destructive)",
              margin: "14px 0 4px",
            }}
          >
            Pengeluaran
          </div>
          {L.pnl.expense.map((x) => (
            <Row key={x.k} k={x.k} v={x.v} color="var(--destructive)" />
          ))}
          <Row k="Total Pengeluaran" v={exp} color="var(--destructive)" bold />
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              background: "var(--accent)",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
              Laba Bersih
            </div>
            <div
              className="mono"
              style={{ fontSize: 24, fontWeight: 900, color: "var(--primary)" }}
            >
              {fmt(inc - exp)}
            </div>
          </div>
        </SectionCard>
      );
    }
    if (tab === "rbalance" || tab === "rasl") {
      const a = L.balance.assets.reduce((s, x) => s + x.v, 0),
        li = L.balance.liabilities.reduce((s, x) => s + x.v, 0);
      return (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <SectionCard title="Aset">
            {L.balance.assets.map((x) => (
              <Row key={x.k} k={x.k} v={x.v} />
            ))}
            <Row k="Total Aset" v={a} color="var(--success)" bold />
          </SectionCard>
          <SectionCard title="Liabilitas & Ekuitas">
            {L.balance.liabilities.map((x) => (
              <Row key={x.k} k={x.k} v={x.v} color="var(--destructive)" />
            ))}
            <Row k="Total Liabilitas" v={li} color="var(--destructive)" bold />
            <Row
              k="Ekuitas (Net Worth)"
              v={a - li}
              color="var(--primary)"
              bold
            />
          </SectionCard>
        </div>
      );
    }
    if (tab === "rcashflow" || tab === "rkas" || tab === "raliran") {
      return (
        <SectionCard title="Arus Kas — 6 Bulan Terakhir">
          <BarChart
            months={L.monthly.map((m) => m.month.slice(0, 3))}
            income={L.monthly.map((m) => m.income / 1e6)}
            expense={L.monthly.map((m) => m.expense / 1e6)}
            max={20}
            height={160}
          />
        </SectionCard>
      );
    }
    // default: Ringkasan + others
    return (
      <React.Fragment>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 14,
          }}
        >
          {[
            {
              label: "Total Pemasukan",
              val: totIncome,
              color: "var(--success)",
            },
            {
              label: "Total Pengeluaran",
              val: totExpense,
              color: "var(--destructive)",
            },
            {
              label: "Surplus",
              val: totIncome - totExpense,
              color: "var(--primary)",
            },
            {
              label: "Rata-rata / Bulan",
              val: Math.round((totIncome - totExpense) / 6),
              color: "var(--foreground)",
            },
          ].map((c) => (
            <div key={c.label} style={{ ...panel(), padding: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                  marginBottom: 4,
                }}
              >
                {c.label}
              </div>
              <div
                className="mono"
                style={{ fontSize: 18, fontWeight: 900, color: c.color }}
              >
                {fc(c.val)}
              </div>
            </div>
          ))}
        </div>
        <SectionCard
          title="Tren Pemasukan vs Pengeluaran"
          style={{ marginTop: 14 }}
        >
          <BarChart
            months={L.monthly.map((m) => m.month.slice(0, 3))}
            income={L.monthly.map((m) => m.income / 1e6)}
            expense={L.monthly.map((m) => m.expense / 1e6)}
            max={20}
            height={150}
          />
        </SectionCard>
      </React.Fragment>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Analisis lengkap keuanganmu — pilih jenis laporan
        </span>
        <Button
          style={{ marginLeft: "auto" }}
          variant="outline"
          size="sm"
          iconStart={<Icon name="Download" size={14} />}
        >
          Unduh PDF
        </Button>
      </div>
      <div
        style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}
        className="hide-scrollbar"
      >
        {LAP_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0,
              borderRadius: 999,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-sans)",
              background: tab === t.id ? "var(--primary)" : "var(--secondary)",
              color: tab === t.id ? "#fff" : "var(--muted-foreground)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={rise(0)} key={tab}>
        {report()}
      </div>
    </div>
  );
}
window.ScreenLaporan = ScreenLaporan;
