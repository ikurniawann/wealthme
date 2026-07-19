/* WealthMe UI-kit — Quick Input screen. */
function ScreenQuickinput({ onNavigate }) {
  const { rise, IconChip } = window.WMKit;
  const WM = window.WM;
  const MAP = {
    Transaksi: "transaksi",
    Investasi: "investasi",
    Rekening: "rekening",
    "E-Wallet": "dana",
    Aset: "aset",
    Liabilitas: "liabilitas",
    Asuransi: "asuransi",
    Tujuan: "tujuan",
    Anggaran: "anggaran",
    "Aset Warisan": "warisan",
    Donasi: "donation",
  };
  const go = (name) => onNavigate && MAP[name] && onNavigate(MAP[name]);

  return (
    <div>
      <div style={{ marginBottom: 18, ...rise(0) }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>⚡ Quick Input</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Pilih jenis data yang ingin kamu input — langsung isi via popup
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 12,
        }}
      >
        {WM.quickCards.map((c, i) => (
          <button
            key={c.name}
            onClick={() => go(c.name)}
            style={{
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--card)",
              padding: 18,
              textAlign: "center",
              cursor: "pointer",
              transition: "transform .15s, box-shadow .15s, border-color .15s",
              ...rise(i * 0.25),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.boxShadow =
                "0 8px 24px rgba(79,70,229,.14)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ margin: "0 auto 12px" }}>
              <IconChip
                name={c.icon}
                bg={c.bg}
                fg={c.fg}
                size={48}
                iconSize={22}
                radius={14}
              />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.name}</div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                lineHeight: 1.4,
                color: "var(--muted-foreground)",
              }}
            >
              {c.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
window.ScreenQuickinput = ScreenQuickinput;
