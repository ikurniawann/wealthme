/* WealthMe UI-kit — Transaksi screen (faithful recreation, enhanced). */
function ScreenTransaksi() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { MoneyStat, Button } = DS;
  const { rise, IconChip, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const [filter, setFilter] = React.useState("Semua");
  const [sort, setSort] = React.useState("Terbaru");

  const groups =
    sort === "Terlama" ? [...WM.txn.groups].reverse() : WM.txn.groups;
  const matches = (r) =>
    filter === "Semua" ||
    (filter === "Masuk" && r.inc) ||
    (filter === "Keluar" && r.type === "expense") ||
    (filter === "Transfer" && r.type === "transfer") ||
    (filter === "Kartu Kredit" && r.type === "credit");

  const ICON = {
    income: { name: "ArrowDownLeft", bg: "#DCFCE7", fg: "#16A34A" },
    expense: { name: "CreditCard", bg: "#FEE2E2", fg: "#DC2626" },
    transfer: { name: "ArrowLeftRight", bg: "#EDE9FE", fg: "#7C3AED" },
    credit: { name: "CreditCard", bg: "#FEF3C7", fg: "#CA8A04" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Catat &amp; kelola semua transaksimu
        </span>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Tambah Transaksi
        </Button>
      </div>

      {/* Summary bar */}
      <div style={{ ...panel(), padding: 16, ...rise(0) }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
          }}
        >
          <MoneyStat
            label="Total Pemasukan"
            value={WM.formatRupiah(WM.txn.income)}
            valueColor="var(--success)"
          />
          <MoneyStat
            label="Total Pengeluaran"
            value={WM.formatRupiah(WM.txn.expense)}
            valueColor="var(--destructive)"
          />
          <MoneyStat
            label="Selisih"
            value={WM.formatRupiah(WM.txn.net)}
            valueColor="var(--success)"
          />
        </div>
      </div>

      {/* Filters + sort */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {WM.txn.filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                background:
                  filter === f ? "var(--primary)" : "var(--secondary)",
                color: filter === f ? "#fff" : "var(--muted-foreground)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            marginLeft: "auto",
            appearance: "none",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--card)",
            padding: "7px 28px 7px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--foreground)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          <option>Terbaru</option>
          <option>Terlama</option>
        </select>
      </div>

      {/* Grouped list */}
      {groups.map((g, gi) => {
        const rows = g.rows.filter(matches);
        if (!rows.length) return null;
        return (
          <div key={g.day} style={rise(1 + gi * 0.5)}>
            <div
              style={{
                marginBottom: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".05em",
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
              }}
            >
              {g.day}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rows.map((r, i) => {
                const ic = ICON[r.type] || ICON.expense;
                return (
                  <div
                    key={i}
                    style={{
                      ...panel(),
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      transition: "background .12s",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--accent)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--card)")
                    }
                  >
                    <IconChip
                      name={ic.name}
                      bg={ic.bg}
                      fg={ic.fg}
                      size={38}
                      iconSize={17}
                      radius={999}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {r.sub}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        className="mono"
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: r.inc
                            ? "var(--success)"
                            : "var(--destructive)",
                        }}
                      >
                        {(r.inc ? "+" : "-") + WM.formatRupiah(r.amt)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {r.time}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
window.ScreenTransaksi = ScreenTransaksi;
