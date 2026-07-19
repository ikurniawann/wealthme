/* WealthMe UI-kit — Beranda wrapper: greeting + Klasik/Baru toggle. */
function ScreenBeranda() {
  const [view, setView] = React.useState("baru");
  const Icon = window.WMIcon;
  const tab = (id, label, icon) => (
    <button
      onClick={() => setView(id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 14px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        fontWeight: 600,
        background: view === id ? "var(--card)" : "transparent",
        color: view === id ? "var(--primary)" : "var(--muted-foreground)",
        boxShadow: view === id ? "var(--ring-card)" : "none",
        transition: "all .15s",
      }}
    >
      {icon && <Icon name={icon} size={13} color="currentColor" />}
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>
            Selamat pagi, Andra 👋
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12.5,
              color: "var(--muted-foreground)",
            }}
          >
            Ini ringkasan kekayaanmu hari ini.
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 3,
            padding: 3,
            borderRadius: 999,
            background: "var(--secondary)",
          }}
        >
          {tab("klasik", "Klasik", null)}
          {tab("baru", "Baru", "Sparkles")}
        </div>
      </div>
      {view === "baru" ? <window.ScreenBerandaEnhanced /> : <BerandaClassic />}
    </div>
  );
}
window.ScreenBeranda = ScreenBeranda;

/* Original (classic) dashboard body. */
function BerandaClassic() {
  const DS = window.WealthMeDesignSystem_6818de;
  const {
    HeroCard,
    SectionCard,
    SummaryCard,
    Donut,
    DonutLegend,
    Sparkline,
    BarChart,
    ProgressBar,
    Button,
  } = DS;
  const WM = window.WM;
  const [period, setPeriod] = React.useState("1M");
  const PERIODS = ["1M", "3M", "6M", "1Y", "All"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 14 }}
      >
        {/* Hero */}
        <HeroCard gradient="gradient-wealth">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            💎 Total Kekayaan
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-.02em",
            }}
          >
            {WM.formatRupiah(WM.netWorth)}
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            <span style={{ fontWeight: 600, color: "#6ee7b7" }}>
              ▲ {WM.formatRupiah(WM.monthNet)} bulan ini
            </span>
            <span style={{ opacity: 0.6 }}>
              {" "}
              · saving rate {WM.savingsRate}%
            </span>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: period === p ? "#fff" : "rgba(255,255,255,.15)",
                  color: period === p ? "var(--primary)" : "#fff",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Sparkline points={WM.sparkline} height={56} />
          </div>
        </HeroCard>

        {/* Allocation */}
        <SectionCard
          title="Rincian Kekayaan"
          action={
            <Button variant="link" size="sm">
              Lihat detail
            </Button>
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Donut
              segments={WM.allocation}
              size={112}
              thickness={17}
              centerValue="Rp 2,4M"
              centerLabel="Total"
            />
            <div style={{ flex: 1, minWidth: 130 }}>
              <DonutLegend
                segments={WM.allocation.map((a) => ({
                  ...a,
                  sub: WM.formatCompact(a.amount),
                }))}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Summary tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 12,
        }}
      >
        {WM.summary.map((s) => (
          <SummaryCard
            key={s.label}
            icon={s.icon}
            iconBg={s.iconBg}
            label={s.label}
            amount={WM.formatCompact(s.amount)}
            delta={s.delta}
            deltaUp={s.up}
          />
        ))}
      </div>

      {/* Row 3 */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}
      >
        <SectionCard title="Arus Kas">
          <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
                Pemasukan
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "var(--success)",
                }}
              >
                {WM.formatCompact(WM.monthIncome)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
                Pengeluaran
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "var(--destructive)",
                }}
              >
                {WM.formatCompact(WM.monthExpense)}
              </div>
            </div>
          </div>
          <BarChart
            months={WM.cashflow.months}
            income={WM.cashflow.income}
            expense={WM.cashflow.expense}
            max={WM.cashflow.max}
            height={86}
          />
        </SectionCard>

        <SectionCard
          title="Transaksi Terbaru"
          action={
            <Button variant="link" size="sm">
              Semua
            </Button>
          }
        >
          <div>
            {WM.activities.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 0",
                  borderTop: i ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    background: a.iconBg,
                  }}
                >
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                  >
                    {a.cat}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: a.inc ? "var(--success)" : "var(--destructive)",
                    }}
                  >
                    {(a.inc ? "+" : "-") + WM.formatCompact(a.amt)}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                  >
                    {a.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Tujuan Keuangan"
          action={
            <Button variant="link" size="sm">
              Semua
            </Button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {WM.goals.map((g) => (
              <div key={g.name}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      background: g.iconBg,
                    }}
                  >
                    {g.icon}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                    {g.name}
                  </div>
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: g.color }}
                  >
                    {g.pct}%
                  </div>
                </div>
                <ProgressBar value={g.pct} color={g.color} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    fontSize: 10.5,
                    color: "var(--muted-foreground)",
                  }}
                >
                  <span>{WM.formatCompact(g.now)}</span>
                  <span>{WM.formatCompact(g.target)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* AI banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderRadius: 14,
          background: "var(--accent)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 24 }}>📊</div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--primary-strong)",
            }}
          >
            Insight dari AI Advisor
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: "var(--muted-foreground)",
            }}
          >
            Porsi properti (30%) sedikit di atas ideal. Pertimbangkan
            rebalancing ke instrumen yang lebih likuid.
          </div>
        </div>
        <Button>Tanya AI</Button>
      </div>
    </div>
  );
}
