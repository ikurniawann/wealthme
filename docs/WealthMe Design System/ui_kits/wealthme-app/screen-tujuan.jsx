/* WealthMe UI-kit — Tujuan Keuangan (goals) screen. */
function ScreenTujuan() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { StatusBadge, Button } = DS;
  const { rise, IconChip, AnimatedBar, lift, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const goals = WM.goalsFull;
  const onTrack = goals.filter((g) => g.status === "On Track").length;
  const boost = goals.filter((g) => g.status === "Perlu Boost").length;
  const risk = goals.filter((g) => g.status === "Berisiko").length;
  const allocated = goals.reduce((s, g) => s + g.current, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {goals.length} Tujuan Aktif
          </div>
          <div
            className="mono"
            style={{ fontSize: 12, color: "var(--muted-foreground)" }}
          >
            Total dialokasikan: {WM.formatRupiah(allocated)}
          </div>
        </div>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Tambah Tujuan
        </Button>
      </div>

      {/* Status tiles */}
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
          <div style={{ fontSize: 10.5, color: "#15803D" }}>On Track</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#15803D" }}>
            {onTrack}
          </div>
          <div style={{ fontSize: 11, color: "#15803D" }}>
            tujuan berjalan baik
          </div>
        </div>
        <div style={{ ...panel(), padding: 16, ...rise(0.4) }}>
          <div style={{ fontSize: 10.5, color: "var(--warning)" }}>
            Perlu Boost
          </div>
          <div
            style={{ fontSize: 22, fontWeight: 800, color: "var(--warning)" }}
          >
            {boost}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            tujuan perlu percepatan
          </div>
        </div>
        <div style={{ ...panel(), padding: 16, ...rise(0.8) }}>
          <div style={{ fontSize: 10.5, color: "var(--brand-purple)" }}>
            Berisiko
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "var(--brand-purple)",
            }}
          >
            {risk}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            tujuan berisiko tidak tercapai
          </div>
        </div>
      </div>

      {/* Goal cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {goals.map((g, i) => (
          <div
            key={g.name}
            onMouseEnter={(e) => lift(e, true)}
            onMouseLeave={(e) => lift(e, false)}
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--ring-card)",
              overflow: "hidden",
              transition: "transform .18s, box-shadow .18s",
              ...rise(1.2 + i * 0.3),
            }}
          >
            <div style={{ height: 3, background: g.color }} />
            <div style={{ padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <IconChip
                  name={g.icon}
                  bg={g.bg}
                  fg={g.fg}
                  size={40}
                  iconSize={19}
                  radius={11}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</div>
                  <div
                    style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                  >
                    Target: {g.targetDate}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <StatusBadge variant={g.variant}>{g.status}</StatusBadge>
                </div>
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: g.color,
                  marginBottom: 8,
                }}
              >
                {g.pct}%
              </div>
              <AnimatedBar value={g.pct} color={g.color} height={9} />
              <div
                className="mono"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 10,
                  fontSize: 11.5,
                  color: "var(--muted-foreground)",
                }}
              >
                <span>{WM.formatRupiah(g.current)} terkumpul</span>
                <span>Target {WM.formatCompact(g.target)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span className="mono">
                  Sisa: {WM.formatCompact(g.remaining)}
                </span>
                <span style={{ color: "var(--muted-foreground)" }}>
                  {g.autoDebit
                    ? `Auto-debit ${WM.formatCompact(g.autoDebit)}/bln`
                    : "Tanpa auto-debit"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.ScreenTujuan = ScreenTujuan;
