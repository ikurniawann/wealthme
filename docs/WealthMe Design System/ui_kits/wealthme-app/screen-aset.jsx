/* WealthMe UI-kit — Aset (assets) screen: KPI strip + sortable-looking table. */
function ScreenAset() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SummaryCard, StatusBadge, Button, Donut, DonutLegend, SectionCard } =
    DS;
  const WM = window.WM;
  const Icon = window.WMIcon;
  const [filter, setFilter] = React.useState("Semua");
  const total = WM.assets.reduce((s, a) => s + a.value, 0);
  const filters = ["Semua", "Properti", "Investasi", "Kas & Bank", "Komoditas"];
  const rows =
    filter === "Semua" ? WM.assets : WM.assets.filter((a) => a.type === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>Aset Saya</div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12.5,
              color: "var(--muted-foreground)",
            }}
          >
            {WM.assets.length} aset · total {WM.formatCompact(total)}
          </div>
        </div>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Tambah Aset
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
        }}
      >
        <SummaryCard
          icon="🏠"
          iconBg="#FEF9C3"
          label="Properti"
          amount={WM.formatCompact(2170000000)}
          delta="5,1%"
          deltaUp
        />
        <SummaryCard
          icon="📈"
          iconBg="#EDE9FE"
          label="Investasi"
          amount={WM.formatCompact(969375000)}
          delta="6,8%"
          deltaUp
        />
        <SummaryCard
          icon="🪙"
          iconBg="#FEF3C7"
          label="Komoditas"
          amount={WM.formatCompact(312500000)}
          delta="3,1%"
          deltaUp
        />
        <SummaryCard
          icon="🏦"
          iconBg="#DBEAFE"
          label="Kas & Bank"
          amount={WM.formatCompact(200000000)}
          delta="0,5%"
          deltaUp
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* Table card */}
        <div
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--ring-card)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              flexWrap: "wrap",
            }}
          >
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  borderRadius: 999,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  border:
                    "1px solid " +
                    (filter === f ? "transparent" : "var(--border)"),
                  background: filter === f ? "var(--primary)" : "transparent",
                  color: filter === f ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-sans)",
            }}
          >
            <thead>
              <tr
                style={{
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--muted-foreground)",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 16px",
                    fontWeight: 700,
                  }}
                >
                  Aset
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    fontWeight: 700,
                  }}
                >
                  Kategori
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    fontWeight: 700,
                  }}
                >
                  Nilai
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 16px",
                    fontWeight: 700,
                  }}
                >
                  Perubahan
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr
                  key={a.name}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "11px 16px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "var(--secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 15,
                        }}
                      >
                        {a.icon}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {a.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 8px" }}>
                    <StatusBadge variant={a.typeColor}>{a.type}</StatusBadge>
                  </td>
                  <td
                    style={{
                      padding: "11px 8px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                    className="mono"
                  >
                    {WM.formatCompact(a.value)}
                  </td>
                  <td
                    style={{
                      padding: "11px 16px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontSize: 12.5,
                      color: a.up ? "var(--success)" : "var(--destructive)",
                    }}
                  >
                    {(a.up ? "▲ " : "▼ ") + Math.abs(a.change).toFixed(1) + "%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Allocation card */}
        <SectionCard title="Komposisi Aset">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Donut
              segments={WM.allocation}
              size={150}
              thickness={22}
              centerValue={WM.formatCompact(total)}
              centerLabel="Total Aset"
            />
            <div style={{ width: "100%" }}>
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
    </div>
  );
}
window.ScreenAset = ScreenAset;
