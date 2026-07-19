/* WealthMe UI-kit — Donasi & Zakat screen (live zakat calculator). */
function ScreenDonation() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { HeroCard, SectionCard, StatusBadge, Button, Input } = DS;
  const { rise, IconChip } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const D = WM.donation;
  const [cash, setCash] = React.useState(D.calc.cash);
  const [gold, setGold] = React.useState(D.calc.gold);
  const [invest, setInvest] = React.useState(D.calc.invest);
  const [debt, setDebt] = React.useState(D.calc.debt);

  const harta = cash + gold + invest - debt;
  const reached = harta >= D.calc.nisab;
  const zakat = reached ? Math.round(harta * 0.025) : 0;

  const numField = (label, value, setter) => (
    <div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--muted-foreground)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <input
        type="text"
        value={value.toLocaleString("id-ID")}
        onChange={(e) =>
          setter(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
        }
        className="mono"
        style={{
          width: "100%",
          height: 38,
          padding: "0 12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--input)",
          background: "var(--card)",
          color: "var(--foreground)",
          fontSize: 13,
          outline: "none",
        }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={rise(0)}>
        <HeroCard gradient="gradient-emerald">
          <div
            style={{
              fontSize: 12,
              opacity: 0.85,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="HandHeart" size={14} color="#fff" /> Total Donasi &amp;
            Zakat
          </div>
          <div
            className="mono"
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "-1px",
              marginTop: 4,
            }}
          >
            {WM.formatRupiah(D.total)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
            {D.txns.length} transaksi tercatat
          </div>
        </HeroCard>
      </div>

      <div style={rise(0.5)}>
        <SectionCard title="🕌 Kalkulator Zakat Maal">
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginBottom: 14,
            }}
          >
            Zakat 2,5% dari total harta yang mencapai nisab &amp; haul (1 tahun)
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            {numField("Tabungan & Kas (Rp)", cash, setCash)}
            {numField("Emas & Perak (Rp)", gold, setGold)}
            {numField("Investasi & Saham (Rp)", invest, setInvest)}
            {numField("Utang Jatuh Tempo (Rp)", debt, setDebt)}
          </div>
          <div
            style={{
              marginTop: 16,
              borderRadius: 12,
              border:
                "1px solid color-mix(in oklab, var(--primary) 15%, transparent)",
              background: "var(--accent)",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
              Zakat yang Wajib Ditunaikan (2,5%)
            </div>
            <div
              className="mono"
              style={{
                marginTop: 4,
                fontSize: 24,
                fontWeight: 900,
                color: "var(--primary)",
              }}
            >
              {WM.formatRupiah(zakat)}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: reached ? "var(--success)" : "var(--warning)",
              }}
            >
              {reached
                ? "✅ Harta sudah mencapai nisab (≈ Rp 102 jt)"
                : "⚠️ Harta belum mencapai nisab (Rp 102 jt) — belum wajib zakat"}
            </div>
          </div>
          <Button
            style={{ marginTop: 14 }}
            iconStart={<Icon name="HandHeart" size={14} color="#fff" />}
          >
            Tunaikan Zakat Sekarang
          </Button>
        </SectionCard>
      </div>

      <div style={rise(1)}>
        <SectionCard title="Riwayat Donasi & Zakat">
          {D.txns.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderTop: i ? "1px solid var(--border)" : "none",
              }}
            >
              <IconChip
                name={d.icon}
                bg={d.bg}
                fg={d.fg}
                size={34}
                iconSize={16}
                radius={9}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {d.type} — {d.recipient}
                </div>
                <div
                  style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                >
                  {d.date}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--destructive)",
                  }}
                >
                  -{WM.formatRupiah(d.amt)}
                </div>
                {d.taxDeduct && (
                  <StatusBadge
                    variant="success"
                    style={{ marginTop: 2, fontSize: 10 }}
                  >
                    Pengurang Pajak
                  </StatusBadge>
                )}
              </div>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
window.ScreenDonation = ScreenDonation;
