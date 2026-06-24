/* WealthMe UI-kit — Setup Master Data screen. */
function ScreenMasterdata() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, Button } = DS;
  const { rise } = window.WMKit;
  const WM = window.WM;

  return (
    <div>
      <div style={{ marginBottom: 18, ...rise(0) }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          🗄️ Setup Master Data
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Kelola data referensi yang dipakai di seluruh aplikasi
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 14,
        }}
      >
        {WM.masterGroups.map((g, gi) => (
          <div key={g.title} style={rise(gi * 0.2)}>
            <SectionCard
              title={g.title}
              action={
                <Button variant="link" size="sm">
                  + Tambah
                </Button>
              }
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {g.items.map((it) => (
                  <span
                    key={it}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 20,
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      padding: "6px 10px",
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {it}
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        color: "var(--muted-foreground)",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            </SectionCard>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          borderRadius: 12,
          border:
            "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
          background: "var(--accent)",
          padding: 14,
          fontSize: 12,
          color: "var(--muted-foreground)",
        }}
      >
        <strong>Kategori</strong> tersimpan ke server dan dipakai di transaksi
        &amp; laporan. Daftar lain (bank, jenis transaksi, dll.) adalah
        referensi sistem dan dikelola secara lokal.
      </div>
    </div>
  );
}
window.ScreenMasterdata = ScreenMasterdata;
