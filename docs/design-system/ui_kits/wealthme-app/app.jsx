/* WealthMe UI-kit — root app: login gate + shell + screen routing. */
function App() {
  const { Sidebar, Topbar } = window.WMShell;
  const [authed, setAuthed] = React.useState(true);
  const [active, setActive] = React.useState("beranda");
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (!authed) return <window.ScreenLogin onLogin={() => setAuthed(true)} />;

  const SCREENS = {
    beranda: window.ScreenBeranda,
    ringkasan: window.ScreenRingkasan,
    laporan: window.ScreenLaporan,
    transaksi: window.ScreenTransaksi,
    anggaran: window.ScreenAnggaran,
    tujuan: window.ScreenTujuan,
    dana: window.ScreenDana,
    rekening: window.ScreenRekening,
    investasi: window.ScreenInvestasi,
    aset: window.ScreenAset,
    liabilitas: window.ScreenLiabilitas,
    asuransi: window.ScreenAsuransi,
    warisan: window.ScreenWarisan,
    donation: window.ScreenDonation,
    tax: window.ScreenTax,
    splitbill: window.ScreenSplitbill,
    rekonsiliasi: window.ScreenRekonsiliasi,
    kalkulator: window.ScreenKalkulator,
    notifikasi: window.ScreenNotifikasi,
    quickinput: window.ScreenQuickinput,
    masterdata: window.ScreenMasterdata,
    akun: window.ScreenAkun,
    ai: window.ScreenAI,
  };
  const Screen = SCREENS[active] || Placeholder;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--background)",
      }}
    >
      <Sidebar
        active={active}
        onNavigate={(id) => setActive(id)}
        onAddTxn={() => setActive("quickinput")}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Topbar
          active={active}
          dark={dark}
          onToggleTheme={() => setDark((d) => !d)}
          onSearch={() => {}}
          onLogout={() => setAuthed(false)}
        />
        <main
          className="hide-scrollbar"
          style={{ flex: 1, overflowY: "auto", padding: 24 }}
        >
          <Screen
            onNavigate={(id) => setActive(id)}
            onLogout={() => setAuthed(false)}
          />
        </main>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);

/* Friendly placeholder for nav items not recreated in this UI kit. */
function Placeholder() {
  const Icon = window.WMIcon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "80px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: "var(--accent)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="LayoutDashboard" size={28} color="var(--primary)" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>
        Halaman ini belum direkreasi di UI kit
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--muted-foreground)",
          maxWidth: 360,
        }}
      >
        Semua menu utama sudah tersedia. Jika kamu melihat ini, halaman tersebut
        memang sengaja dibiarkan kosong.
      </div>
    </div>
  );
}
