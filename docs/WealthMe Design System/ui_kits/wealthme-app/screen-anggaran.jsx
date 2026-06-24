/* WealthMe UI-kit — Anggaran (budget) screen. */
function ScreenAnggaran() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, Button } = DS;
  const { rise, IconChip, AnimatedBar, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const B = WM.budget;
  const overItem = B.items.find((b) => b.over);
  const nearItem = B.items.find((b) => b.near && !b.over);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            Anggaran {B.month}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Total budget: {WM.formatRupiah(B.totalLimit)}
          </div>
        </div>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Tambah Kategori
        </Button>
      </div>

      {/* Summary tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 14,
        }}
      >
        <div
          style={{
            borderRadius: "var(--radius-lg)",
            border: "1px solid #86EFAC",
            background: "#DCFCE7",
            padding: 16,
            ...rise(0),
          }}
        >
          <div style={{ fontSize: 11, color: "#15803D" }}>Budget Tersisa</div>
          <div
            className="mono"
            style={{ fontSize: 22, fontWeight: 800, color: "#15803D" }}
          >
            {WM.formatRupiah(B.totalRemaining)}
          </div>
          <div style={{ fontSize: 11, color: "#15803D" }}>
            {100 - B.usagePct}% dari budget
          </div>
        </div>
        <div style={{ ...panel(), padding: 16, ...rise(0.4) }}>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Total Terpakai
          </div>
          <div
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "var(--destructive)",
            }}
          >
            {WM.formatRupiah(B.totalSpent)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {B.usagePct}% dari budget
          </div>
        </div>
        <div style={{ ...panel(), padding: 16, ...rise(0.8) }}>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Hari Tersisa
          </div>
          <div
            className="mono"
            style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)" }}
          >
            {B.daysLeft} Hari
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            dari {B.daysInMonth} hari
          </div>
        </div>
      </div>

      <div style={rise(1.4)}>
        <SectionCard title="Rincian Anggaran per Kategori">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {B.items.map((b) => {
              const color = b.over
                ? "var(--destructive)"
                : b.near
                  ? "var(--warning)"
                  : "var(--success)";
              return (
                <div
                  key={b.name}
                  style={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <IconChip
                      name={b.icon}
                      bg={b.bg}
                      fg={b.fg}
                      size={34}
                      iconSize={16}
                      radius={9}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {b.name}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {WM.formatRupiah(b.spent)} dari{" "}
                        {WM.formatRupiah(b.limit)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>
                      {b.pct}%{b.over ? " ⚠️" : ""}
                    </div>
                  </div>
                  <AnimatedBar value={Math.min(b.pct, 100)} color={color} />
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {(overItem || nearItem) && (
        <div
          style={{
            ...rise(2),
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderRadius: 14,
            border:
              "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
            background: "var(--accent)",
            padding: 16,
          }}
        >
          <IconChip
            name="TriangleAlert"
            bg="var(--warning-soft)"
            fg="#b45309"
            size={40}
            iconSize={20}
            radius={11}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--primary-strong)",
              }}
            >
              {overItem
                ? `${overItem.name} melebihi budget ${overItem.pct - 100}%!`
                : `${nearItem.name} mendekati batas budget (${nearItem.pct}%)`}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: "var(--muted-foreground)",
              }}
            >
              Pantau pengeluaran agar tidak melebihi anggaran bulan ini.
            </div>
          </div>
          <Button variant="ghost" size="sm">
            Tips Hemat →
          </Button>
        </div>
      )}
    </div>
  );
}
window.ScreenAnggaran = ScreenAnggaran;
