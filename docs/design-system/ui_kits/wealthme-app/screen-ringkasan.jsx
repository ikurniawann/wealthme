/* WealthMe UI-kit — Ringkasan screen. */
function ScreenRingkasan() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, StatusBadge, ProgressBar } = DS;
  const { rise, IconChip, AnimatedBar, panel } = window.WMKit;
  const WM = window.WM;
  const R = WM.ringkasan;

  // net-worth trend → smooth svg path
  const w = 320,
    h = 90,
    min = Math.min(...R.trend) - 0.2,
    max = Math.max(...R.trend) + 0.2;
  const pts = R.trend.map((v, i) => ({
    x: (i / (R.trend.length - 1)) * w,
    y: h - ((v - min) / (max - min)) * (h - 12) - 6,
  }));
  const line = pts
    .map((p, i) =>
      i
        ? `L${p.x.toFixed(1)},${p.y.toFixed(1)}`
        : `M${p.x.toFixed(1)},${p.y.toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
        }}
      >
        <div
          className="gradient-wealth"
          style={{
            borderRadius: "var(--radius-lg)",
            padding: 18,
            color: "#fff",
            ...rise(0),
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>
            Total Kekayaan Bersih
          </div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 900 }}>
            {WM.formatCompact(WM.netWorth)}
          </div>
          <div style={{ fontSize: 11, color: "#6ee7b7", marginTop: 4 }}>
            ▲ {WM.formatCompact(WM.monthNet)} bulan ini
          </div>
        </div>
        {[
          {
            label: "Total Aset",
            val: WM.formatCompact(R.totalAssets),
            color: "var(--success)",
            sub: "5 jenis akun",
          },
          {
            label: "Total Liabilitas",
            val: WM.formatCompact(R.totalLiabilities),
            color: "var(--muted-foreground)",
            sub: "Kewajiban",
          },
          {
            label: "Savings Rate",
            val: R.savingsRate + "%",
            color: "var(--primary)",
            sub: "Pengeluaran " + WM.formatCompact(WM.monthExpense),
          },
        ].map((c, i) => (
          <div
            key={c.label}
            style={{ ...panel(), padding: 18, ...rise(0.4 + i * 0.3) }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                marginBottom: 6,
              }}
            >
              {c.label}
            </div>
            <div
              className="mono"
              style={{ fontSize: 20, fontWeight: 900, color: c.color }}
            >
              {c.val}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                marginTop: 2,
              }}
            >
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Trend + composition */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={rise(1.2)}>
          <SectionCard title="Tren Kekayaan Bersih (6 Bulan)">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              width="100%"
              height={h}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="ngs" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--primary)"
                    stopOpacity="0.18"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--primary)"
                    stopOpacity="0.01"
                  />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#ngs)" />
              <path
                d={line}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={pts[pts.length - 1].x}
                cy={pts[pts.length - 1].y}
                r="4"
                fill="var(--primary)"
              />
            </svg>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 4,
                fontSize: 10,
                color: "var(--muted-foreground)",
              }}
            >
              {R.trendMonths.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </SectionCard>
        </div>
        <div style={rise(1.5)}>
          <SectionCard title="Komposisi Aset">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {WM.allocation.map((a) => (
                <div key={a.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: a.color,
                        }}
                      />
                      {a.label}
                    </span>
                    <span
                      className="mono"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {WM.formatCompact(a.amount)} · {a.value}%
                    </span>
                  </div>
                  <AnimatedBar value={a.value} color={a.color} height={6} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Cashflow + top expenses + health */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}
      >
        <div style={rise(1.8)}>
          <SectionCard title="Cash Flow Juni">
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Pemasukan
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--success)",
                }}
              >
                {WM.formatRupiah(WM.monthIncome)}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Pengeluaran
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--destructive)",
                }}
              >
                {WM.formatRupiah(WM.monthExpense)}
              </div>
            </div>
            <div
              style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}
            >
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Surplus
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--success)",
                }}
              >
                {WM.formatRupiah(WM.monthNet)}
              </div>
            </div>
          </SectionCard>
        </div>
        <div style={rise(2.1)}>
          <SectionCard title="Top Pengeluaran">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {R.topExpenses.map((t, i) => (
                <div
                  key={t.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderTop: i ? "1px solid var(--border)" : "none",
                  }}
                >
                  <IconChip
                    name={t.icon}
                    bg={t.bg}
                    fg={t.fg}
                    size={30}
                    iconSize={15}
                    radius={8}
                  />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                    {t.name}
                  </div>
                  <StatusBadge variant="gray">{t.pct}%</StatusBadge>
                  <div
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--destructive)",
                    }}
                  >
                    {WM.formatCompact(t.amt)}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
        <div style={rise(2.4)}>
          <SectionCard title="Health Score">
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <svg
                viewBox="0 0 120 70"
                width="150"
                height="86"
                style={{ margin: "0 auto", display: "block" }}
              >
                <path
                  d="M10,60 A50,50 0 0,1 110,60"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M10,60 A50,50 0 0,1 110,60"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="157"
                  strokeDashoffset={Math.round(157 - 0.82 * 157)}
                />
              </svg>
              <div
                style={{
                  marginTop: -16,
                  fontSize: 32,
                  fontWeight: 900,
                  color: "var(--primary)",
                }}
              >
                82
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Financial Health Score
              </div>
              <div style={{ marginTop: 8 }}>
                <StatusBadge variant="success">Sehat</StatusBadge>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
window.ScreenRingkasan = ScreenRingkasan;
