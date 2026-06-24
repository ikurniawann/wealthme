/* WealthMe UI-kit — Warisan (inheritance) screen. */
function ScreenWarisan() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { HeroCard, SectionCard, Switch, Button } = DS;
  const { rise, IconChip, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const W = WM.warisan;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={rise(0)}>
        <HeroCard gradient="gradient-wealth">
          <div
            style={{
              fontSize: 12,
              opacity: 0.85,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="Scroll" size={14} color="#fff" /> Total Nilai Warisan
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
            {WM.formatRupiah(W.total)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
            {W.assetCount} aset terdaftar · {W.heirs} ahli waris
          </div>
        </HeroCard>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Catatan aset warisan yang dapat dilihat seluruh ahli waris
        </span>
        <Button
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="Plus" size={14} color="#fff" />}
        >
          Tambah Aset Warisan
        </Button>
      </div>

      {W.groups.map((g, gi) => (
        <div key={g.type} style={rise(0.5 + gi * 0.3)}>
          <SectionCard
            title={
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <IconChip
                  name={g.icon}
                  bg={g.bg}
                  fg={g.fg}
                  size={24}
                  iconSize={13}
                  radius={7}
                />
                {g.type}
              </span>
            }
          >
            {g.items.map((it, i) => (
              <div
                key={it.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderTop: i ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {it.name}
                  </div>
                  <div
                    style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                  >
                    {it.sub}
                  </div>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 13.5, fontWeight: 700 }}
                >
                  {WM.formatRupiah(it.value)}
                </div>
                <Switch defaultChecked={it.visible} />
              </div>
            ))}
          </SectionCard>
        </div>
      ))}

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
          name="ShieldCheck"
          bg="var(--primary)"
          fg="#fff"
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
            Catatan Warisan Aman &amp; Transparan
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: "var(--muted-foreground)",
            }}
          >
            Seluruh ahli waris dapat melihat daftar ini kapan saja. Tambahkan
            dokumen pendukung (sertifikat, BPKB, polis) agar lebih lengkap.
          </div>
        </div>
        <Button variant="ghost" size="sm">
          Upload Dokumen →
        </Button>
      </div>
    </div>
  );
}
window.ScreenWarisan = ScreenWarisan;
