/* WealthMe UI-kit — Rekening (bank accounts) screen. */
function ScreenRekening() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { StatusBadge, Button } = DS;
  const { rise, lift, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const RK = WM.rekening;

  const actionBtn = (icon, label) => (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "8px 0",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--background)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--foreground)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "var(--background)")
      }
    >
      <Icon name={icon} size={14} color="currentColor" /> {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {RK.accounts.length} Rekening Terhubung
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--muted-foreground)" }}
          >
            Total: {WM.formatRupiah(RK.total)}{" "}
            <span style={{ opacity: 0.7 }}>
              ≈ USD {RK.usd.toLocaleString("en-US")}
            </span>
          </div>
        </div>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Tambah
        </Button>
      </div>

      {RK.accounts.map((a, i) => (
        <div
          key={a.name}
          onMouseEnter={(e) => lift(e, true)}
          onMouseLeave={(e) => lift(e, false)}
          style={{
            ...panel(),
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            transition: "transform .18s, box-shadow .18s",
            ...rise(i * 0.3),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 36,
                borderRadius: 8,
                background: a.logoBg,
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {a.logo}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</div>
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--muted-foreground)" }}
              >
                {a.number}
              </div>
            </div>
            <StatusBadge variant="success" dot>
              Aktif
            </StatusBadge>
            <Icon
              name="EllipsisVertical"
              size={16}
              color="var(--muted-foreground)"
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Saldo
            </div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 900 }}>
              {WM.formatRupiah(a.balance)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
              {a.type}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 8,
            }}
          >
            {actionBtn("ArrowUpRight", "Transfer")}
            {actionBtn("ArrowDownToLine", "Top Up")}
            {actionBtn("ListChecks", "Mutasi")}
          </div>
        </div>
      ))}
    </div>
  );
}
window.ScreenRekening = ScreenRekening;
