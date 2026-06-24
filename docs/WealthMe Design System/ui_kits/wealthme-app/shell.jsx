/* WealthMe UI-kit — app shell: Sidebar + Topbar. */
const { useState } = React;

const NAV = [
  {
    section: null,
    items: [
      { id: "beranda", label: "Beranda", icon: "Home" },
      { id: "ringkasan", label: "Ringkasan", icon: "PieChart" },
      { id: "transaksi", label: "Transaksi", icon: "ArrowUpDown" },
      { id: "anggaran", label: "Anggaran", icon: "ClipboardList" },
      { id: "laporan", label: "Laporan", icon: "LineChart" },
      { id: "tujuan", label: "Tujuan Keuangan", icon: "Target" },
      { id: "notifikasi", label: "Notifikasi", icon: "Bell" },
    ],
  },
  {
    section: "Keuangan",
    items: [
      { id: "dana", label: "Dana", icon: "Wallet" },
      { id: "rekening", label: "Rekening", icon: "Landmark" },
      { id: "investasi", label: "Investasi", icon: "BarChart3" },
      { id: "aset", label: "Aset", icon: "Briefcase" },
      { id: "liabilitas", label: "Liabilitas", icon: "ReceiptText" },
      { id: "asuransi", label: "Asuransi", icon: "ShieldCheck" },
      {
        id: "warisan",
        label: "Warisan",
        icon: "Scroll",
        badge: "New",
        badgeColor: "var(--brand-purple)",
      },
      {
        id: "donation",
        label: "Donasi & Zakat",
        icon: "HeartHandshake",
        badge: "New",
        badgeColor: "var(--success)",
      },
      {
        id: "tax",
        label: "Tax Center",
        icon: "FileText",
        badge: "New",
        badgeColor: "var(--success)",
      },
    ],
  },
  {
    section: "Alat",
    items: [
      {
        id: "splitbill",
        label: "Split Bill",
        icon: "Receipt",
        badge: "New",
        badgeColor: "var(--success)",
      },
      {
        id: "rekonsiliasi",
        label: "Rekonsiliasi Bank",
        icon: "GitCompareArrows",
      },
      { id: "ai", label: "AI Advisor", icon: "Bot" },
      { id: "kalkulator", label: "Kalkulator", icon: "Calculator" },
      {
        id: "quickinput",
        label: "Quick Input",
        icon: "Zap",
        badge: "New",
        badgeColor: "var(--success)",
      },
      { id: "masterdata", label: "Setup Master Data", icon: "Database" },
    ],
  },
];

const PAGE_TITLES = {
  beranda: "Beranda",
  ringkasan: "Ringkasan",
  transaksi: "Transaksi",
  anggaran: "Anggaran",
  laporan: "Laporan",
  tujuan: "Tujuan Keuangan",
  notifikasi: "Notifikasi",
  dana: "Dana",
  rekening: "Rekening",
  investasi: "Investasi",
  aset: "Aset Saya",
  liabilitas: "Liabilitas",
  asuransi: "Asuransi",
  warisan: "Warisan",
  donation: "Donasi & Zakat",
  tax: "Tax Center",
  splitbill: "Split Bill",
  rekonsiliasi: "Rekonsiliasi Bank",
  ai: "AI Advisor",
  kalkulator: "Kalkulator",
  quickinput: "Quick Input",
  masterdata: "Setup Master Data",
  akun: "Akun",
};

function Sidebar({ active, onNavigate, onAddTxn }) {
  const Icon = window.WMIcon;
  return (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--card)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          W
        </div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>
          Wealth<span style={{ color: "var(--primary)" }}>Me</span>
        </div>
        <button
          onClick={onAddTxn}
          title="Tambah Transaksi"
          style={{
            marginLeft: "auto",
            width: 32,
            height: 32,
            borderRadius: 9,
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-primary)",
          }}
        >
          <Icon name="Plus" size={15} color="#fff" />
        </button>
      </div>
      {/* Nav */}
      <nav
        className="hide-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}
      >
        {NAV.map((sec, si) => (
          <div key={si}>
            {sec.section && (
              <div
                style={{
                  margin: "6px 16px 4px",
                  paddingTop: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "var(--muted-foreground)",
                }}
              >
                {sec.section}
              </div>
            )}
            {sec.items.map((it) => {
              const on = active === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => onNavigate(it.id)}
                  style={{
                    margin: "1px 8px",
                    width: "calc(100% - 16px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: on ? 600 : 500,
                    background: on ? "var(--accent)" : "transparent",
                    color: on ? "var(--primary)" : "var(--muted-foreground)",
                    transition: "background .12s, color .12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!on) {
                      e.currentTarget.style.background = "var(--secondary)";
                      e.currentTarget.style.color = "var(--foreground)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!on) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--muted-foreground)";
                    }
                  }}
                >
                  <Icon name={it.icon} size={18} color="currentColor" />
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#fff",
                        background: it.badgeColor,
                        borderRadius: 999,
                        padding: "1px 7px",
                      }}
                    >
                      {it.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      {/* User */}
      <div style={{ borderTop: "1px solid var(--border)", padding: 12 }}>
        <button
          onClick={() => onNavigate("akun")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg,var(--primary),var(--brand-purple))",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {window.WM.user.initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {window.WM.user.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {window.WM.user.email}
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}

function Topbar({ active, onSearch, onToggleTheme, dark, onLogout }) {
  const Icon = window.WMIcon;
  const btn = {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "none",
    background: "var(--secondary)",
    color: "var(--muted-foreground)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 24px",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800 }}>
        {PAGE_TITLES[active] || "WealthMe"}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={onSearch}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 260,
          flex: 1,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--background)",
          color: "var(--muted-foreground)",
          fontSize: 12.5,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <Icon name="Search" size={13} color="currentColor" />
        <span style={{ flex: 1, textAlign: "left" }}>
          Cari transaksi, rekening...
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            background: "var(--border)",
            borderRadius: 4,
            padding: "1px 6px",
          }}
        >
          ⌘K
        </span>
      </button>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={btn} onClick={onToggleTheme} title="Ganti tema">
          <Icon name={dark ? "Sun" : "Moon"} size={15} color="currentColor" />
        </button>
        <button style={btn} title="Notifikasi">
          <Icon name="Bell" size={15} color="currentColor" />
        </button>
        <button style={btn} onClick={onLogout} title="Keluar">
          <Icon name="LogOut" size={15} color="currentColor" />
        </button>
      </div>
    </header>
  );
}

window.WMShell = { Sidebar, Topbar };
