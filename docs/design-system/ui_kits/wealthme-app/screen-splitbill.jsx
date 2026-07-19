/* WealthMe UI-kit — Split Bill screen (interactive settle). */
function ScreenSplitbill() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, StatusBadge, Button, ProgressBar } = DS;
  const { rise, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const S = WM.splitbill;
  const [splits, setSplits] = React.useState(S.splits);
  const [openIdx, setOpenIdx] = React.useState(null);
  const AV = [
    "linear-gradient(135deg,#10B981,#06B6D4)",
    "linear-gradient(135deg,#F59E0B,#FBBF24)",
    "linear-gradient(135deg,#6366F1,#8B5CF6)",
    "linear-gradient(135deg,#EC4899,#F43F5E)",
    "linear-gradient(135deg,#06B6D4,#3B82F6)",
  ];

  const settle = (si, pi) =>
    setSplits((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const parts = s.parts.map((p, j) =>
          j === pi ? { ...p, paid: true } : p,
        );
        const paid = parts.filter((p) => p.paid).length;
        return {
          ...s,
          parts,
          paid,
          pct: Math.round((paid / parts.length) * 100),
        };
      }),
    );

  const totalDit = splits.reduce((a, s) => a + s.total, 0);
  const totalCol = splits.reduce(
    (a, s) => a + s.parts.filter((p) => p.paid).reduce((b, p) => b + p.amt, 0),
    0,
  );
  const belumCount = splits.reduce(
    (a, s) => a + s.parts.filter((p) => !p.paid).length,
    0,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Patungan jadi gampang — kamu nalangin, mereka bayar balik
        </span>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Buat Split Bill
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 14,
        }}
      >
        {[
          {
            label: "Total Ditalangin",
            val: totalDit,
            color: "var(--primary)",
            sub: splits.length + " split aktif",
          },
          {
            label: "Sudah Dibayar",
            val: totalCol,
            color: "var(--success)",
            sub: Math.round((totalCol / totalDit) * 100) + "% terkumpul",
          },
          {
            label: "Belum Dibayar",
            val: totalDit - totalCol,
            color: "var(--destructive)",
            sub: belumCount + " orang belum bayar",
          },
        ].map((c, i) => (
          <div
            key={c.label}
            style={{ ...panel(), padding: 16, ...rise(i * 0.3) }}
          >
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
              style={{ fontSize: 20, fontWeight: 900, color: c.color }}
            >
              {WM.formatCompact(c.val)}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={rise(1)}>
        <SectionCard title="Split Bill Aktif">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {splits.map((s, si) => {
              const barColor =
                s.pct >= 75 ? "var(--success)" : "var(--warning)";
              const open = openIdx === si;
              return (
                <div
                  key={si}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {s.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {s.date} · {s.people} orang
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        className="mono"
                        style={{ fontSize: 15, fontWeight: 800 }}
                      >
                        {WM.formatRupiah(s.total)}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {WM.formatCompact(Math.round(s.total / s.people))}/org
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <ProgressBar value={s.pct} color={barColor} />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                    >
                      <span style={{ fontWeight: 700, color: barColor }}>
                        {s.paid} dari {s.people}
                      </span>{" "}
                      sudah bayar
                    </div>
                    <button
                      onClick={() => setOpenIdx(open ? null : si)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 8,
                        border: "none",
                        background: "var(--accent)",
                        color: "var(--primary)",
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      <Icon name="Users" size={13} color="currentColor" />{" "}
                      Detail
                    </button>
                  </div>
                  {open && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      {s.parts.map((p, pi) => (
                        <div
                          key={pi}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 0",
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: AV[pi % AV.length],
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {p.name[0]}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                              {p.name}
                            </div>
                            <div
                              className="mono"
                              style={{
                                fontSize: 11,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              {WM.formatRupiah(p.amt)}
                            </div>
                          </div>
                          {p.paid ? (
                            <StatusBadge variant="success" dot>
                              Lunas
                            </StatusBadge>
                          ) : (
                            <button
                              onClick={() => settle(si, pi)}
                              style={{
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                                background: "transparent",
                                color: "var(--muted-foreground)",
                                padding: "4px 12px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "var(--font-sans)",
                              }}
                            >
                              Tandai Lunas
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
window.ScreenSplitbill = ScreenSplitbill;
