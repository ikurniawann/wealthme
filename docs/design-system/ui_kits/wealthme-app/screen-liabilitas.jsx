/* WealthMe UI-kit — Liabilitas (debts) screen. */
function ScreenLiabilitas() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { StatusBadge, Button, ProgressBar } = DS;
  const { rise, IconChip, AnimatedBar, lift, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const L = WM.liabilities;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div
          style={{
            borderRadius: "var(--radius-lg)",
            border: "1px solid #FECACA",
            background: "#FEE2E2",
            padding: 16,
            ...rise(0),
          }}
        >
          <div style={{ fontSize: 11, color: "#B91C1C" }}>Total Liabilitas</div>
          <div
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "var(--destructive)",
            }}
          >
            {WM.formatRupiah(L.totalRemaining)}
          </div>
          <div style={{ fontSize: 11, color: "#B91C1C" }}>
            Sisa tagihan aktif
          </div>
        </div>
        <div style={{ ...panel(), padding: 16, ...rise(0.4) }}>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Rasio Utang terhadap Aset
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: L.dtaColor }}>
            {L.dtaRatio.toFixed(1).replace(".", ",")}%
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: L.dtaColor }}>
            {L.dtaLabel}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button iconStart={<Icon name="Plus" size={14} color="#fff" />}>
          Tambah Liabilitas
        </Button>
      </div>

      {/* Liability cards */}
      {L.items.map((it, i) => {
        const color =
          it.progress >= 80
            ? "var(--destructive)"
            : it.progress >= 50
              ? "var(--warning)"
              : "var(--success)";
        return (
          <div
            key={it.name}
            onMouseEnter={(e) => lift(e, true)}
            onMouseLeave={(e) => lift(e, false)}
            style={{
              ...panel(),
              padding: 18,
              transition: "transform .18s, box-shadow .18s",
              ...rise(0.8 + i * 0.3),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <IconChip
                name={it.isCC ? "CreditCard" : "FileText"}
                bg="#FEE2E2"
                fg="#DC2626"
                size={38}
                iconSize={18}
                radius={10}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{it.name}</div>
                <div
                  style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                >
                  {it.inst}
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <StatusBadge variant={it.status.variant} dot>
                  {it.status.text}
                </StatusBadge>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 14,
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    marginBottom: 3,
                  }}
                >
                  {it.isCC ? "Tagihan Berjalan" : "Sisa Pokok"}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--destructive)",
                  }}
                >
                  {WM.formatRupiah(it.remaining)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    marginBottom: 3,
                  }}
                >
                  {it.isCC ? "Limit Kredit" : "Total Pinjaman"}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 13.5, fontWeight: 700 }}
                >
                  {WM.formatRupiah(it.total)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    marginBottom: 3,
                  }}
                >
                  {it.isCC ? "Minimum Bayar" : "Cicilan/Bulan"}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 13.5, fontWeight: 700 }}
                >
                  {WM.formatRupiah(it.minPay)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    marginBottom: 3,
                  }}
                >
                  {it.isCC ? "Bunga/Bulan" : "Bunga/Tahun"}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--destructive)",
                  }}
                >
                  {it.interest}%
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>
                {it.progressLabel}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>
                {it.progress}%
              </span>
            </div>
            <AnimatedBar value={it.progress} color={color} />
          </div>
        );
      })}
    </div>
  );
}
window.ScreenLiabilitas = ScreenLiabilitas;
