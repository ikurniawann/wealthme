/* WealthMe UI-kit — Investasi (portfolio) screen. */
function ScreenInvestasi() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, StatusBadge, Button } = DS;
  const { rise, useCountUp, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const I = WM.invest;
  const total = useCountUp(I.totalValue, 1200, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ ...panel(), padding: 20, ...rise(0) }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              marginBottom: 4,
            }}
          >
            Total Nilai Investasi
          </div>
          <div
            className="mono"
            style={{ fontSize: 24, fontWeight: 900, color: "var(--primary)" }}
          >
            {WM.formatRupiah(Math.round(total))}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Icon name="ArrowUp" size={12} color="currentColor" stroke={2.5} />{" "}
            +{I.totalReturnPct.toFixed(2).replace(".", ",")}% ·{" "}
            {WM.formatCompact(I.totalReturnRp)} total return
          </div>
        </div>
        <div style={{ ...panel(), padding: 20, ...rise(0.4) }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              marginBottom: 4,
            }}
          >
            Return Hari Ini
          </div>
          <div
            className="mono"
            style={{ fontSize: 24, fontWeight: 900, color: "var(--success)" }}
          >
            {WM.formatRupiah(I.todayRp)}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--success)" }}>
            +{I.todayPct.toFixed(2).replace(".", ",")}% dari kemarin
          </div>
        </div>
      </div>

      <div style={rise(0.9)}>
        <SectionCard
          title="Portofolio"
          action={
            <Button
              variant="link"
              size="sm"
              iconStart={<Icon name="Plus" size={13} color="var(--primary)" />}
            >
              Tambah Investasi
            </Button>
          }
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 560,
                borderCollapse: "collapse",
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
              }}
            >
              <thead>
                <tr
                  style={{
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    color: "var(--muted-foreground)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "8px 12px 8px 0", fontWeight: 700 }}>
                    Nama
                  </th>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>
                    Jenis
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      fontWeight: 700,
                      textAlign: "right",
                    }}
                  >
                    Modal
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      fontWeight: 700,
                      textAlign: "right",
                    }}
                  >
                    Nilai
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      fontWeight: 700,
                      textAlign: "right",
                    }}
                  >
                    Return
                  </th>
                  <th
                    style={{
                      padding: "8px 0",
                      fontWeight: 700,
                      textAlign: "right",
                    }}
                  >
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {I.holdings.map((h) => (
                  <tr
                    key={h.ticker}
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "11px 12px 11px 0" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: h.logoBg,
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {h.ticker.slice(0, 4)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {h.name}
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                            }}
                          >
                            {h.ticker}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <StatusBadge variant={h.badgeVar}>{h.badge}</StatusBadge>
                    </td>
                    <td
                      className="mono"
                      style={{
                        padding: "11px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {WM.formatCompact(h.modal)}
                    </td>
                    <td
                      className="mono"
                      style={{
                        padding: "11px 12px",
                        textAlign: "right",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {WM.formatCompact(h.nilai)}
                    </td>
                    <td
                      className="mono"
                      style={{
                        padding: "11px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        color: h.up ? "var(--success)" : "var(--destructive)",
                      }}
                    >
                      {(h.up ? "+" : "−") +
                        WM.formatCompact(Math.abs(h.returnRp))}
                    </td>
                    <td
                      style={{
                        padding: "11px 0",
                        textAlign: "right",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        color: h.up ? "var(--success)" : "var(--destructive)",
                      }}
                    >
                      {(h.up ? "+" : "") +
                        h.returnPct.toFixed(1).replace(".", ",")}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
window.ScreenInvestasi = ScreenInvestasi;
