/* WealthMe UI-kit — Asuransi (insurance) screen. */
function ScreenAsuransi() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { StatusBadge, Button } = DS;
  const { rise, IconChip, lift, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const A = WM.asuransi;

  const Field = ({ label, value, sub, color }) => (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "var(--muted-foreground)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: color || "var(--foreground)",
        }}
      >
        {value}
        {sub && (
          <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {A.activePolicies} Polis Aktif
          </div>
          <div
            className="mono"
            style={{ fontSize: 12, color: "var(--muted-foreground)" }}
          >
            Total premi: {WM.formatRupiah(A.totalMonthlyPremium)}/bln
          </div>
        </div>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Tambah
        </Button>
      </div>

      {A.policies.map((p, i) => (
        <div
          key={p.name}
          onMouseEnter={(e) => lift(e, true)}
          onMouseLeave={(e) => lift(e, false)}
          style={{
            ...panel(),
            padding: 18,
            transition: "transform .18s, box-shadow .18s",
            ...rise(i * 0.3),
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
              name={p.icon}
              bg={p.bg}
              fg={p.fg}
              size={38}
              iconSize={18}
              radius={10}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {p.provider} · {p.typeLabel}
              </div>
            </div>
            <StatusBadge variant={p.statusVar} dot>
              {p.status}
            </StatusBadge>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 14,
            }}
          >
            <Field
              label="Uang Pertanggungan"
              value={WM.formatCompact(p.coverage)}
            />
            <Field
              label="Premi"
              value={WM.formatRupiah(p.premium)}
              sub={p.period}
            />
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                  marginBottom: 3,
                }}
              >
                Jatuh Tempo
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {p.renewal}
                </span>
                <StatusBadge variant={p.daysVar}>{p.days} hari</StatusBadge>
              </div>
            </div>
            <Field label="No. Polis" value={p.policyNo} />
          </div>
        </div>
      ))}
    </div>
  );
}
window.ScreenAsuransi = ScreenAsuransi;
