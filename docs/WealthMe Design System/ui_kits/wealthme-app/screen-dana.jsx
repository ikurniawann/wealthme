/* WealthMe UI-kit — Dana (cash & e-wallet) screen. */
function ScreenDana() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { HeroCard, SectionCard, Button } = DS;
  const { rise, IconChip, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const D = WM.dana;

  const Row = ({ a, border }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: border ? "1px solid var(--border)" : "none",
      }}
    >
      <IconChip
        name={a.icon}
        bg={a.bg}
        fg={a.fg}
        size={40}
        iconSize={18}
        radius={10}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}</div>
        <div
          className="mono"
          style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
        >
          {a.sub}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 800 }}>
        {WM.formatRupiah(a.balance)}
      </div>
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
            <Icon name="Banknote" size={14} color="#fff" /> Total Dana Tunai
            &amp; E-Wallet
          </div>
          <div
            className="mono"
            style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}
          >
            {WM.formatRupiah(D.total)}
          </div>
          <div style={{ fontSize: 12, color: "#bbf7d0", marginTop: 6 }}>
            {D.cash.length + D.ewallet.length} akun terhubung
          </div>
        </HeroCard>
      </div>

      <div style={rise(0.5)}>
        <SectionCard title="Dompet &amp; Cash">
          {D.cash.map((a, i) => (
            <Row key={a.name} a={a} border={i < D.cash.length - 1} />
          ))}
        </SectionCard>
      </div>

      <div style={rise(0.9)}>
        <SectionCard
          title="E-Wallet"
          action={
            <Button
              variant="secondary"
              size="sm"
              iconStart={<Icon name="Plus" size={13} />}
            >
              Tambah
            </Button>
          }
        >
          {D.ewallet.map((a, i) => (
            <Row key={a.name} a={a} border={i < D.ewallet.length - 1} />
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
window.ScreenDana = ScreenDana;
